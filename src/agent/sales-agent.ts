import type OpenAI from "openai";
import { MODELS, meta } from "@/lib/meta";
import { store } from "@/store/store";
import { checkGrounding, type GroundingReport } from "./grounding";
import { runTool, toolDefinitions, type ToolContext } from "./tools";

const MAX_STEPS = 6;

function systemPrompt(postCaption?: string): string {
  const v = store.vendor();
  return `You write replies on behalf of "${v.businessName}", a Nigerian online vendor.
You draft replies to customer comments and DMs. The vendor reviews every draft before it is sent.

Voice: speak AS the business, in the first person plural ("we", "our"). Never refer to "the vendor" or "our vendor" in a reply.
Style: ${v.tone}
Keep replies under 60 words. Reply in the customer's own language and register.

Hard rules:
1. Every price, stock level and delivery fee you mention MUST come from a tool result in this conversation. Never guess.
2. search_catalogue already returns each variant's id, price and stock. Only call get_product if you need the full description.
   Call independent tools in the same turn (e.g. search_catalogue and get_delivery_quote together).
3. If a variant is out of stock, say so and offer one that is in stock.
4. If the customer is ready to buy and has chosen a variant, call create_order_draft and include its checkout_link exactly as returned.
5. Only offer actions you have a tool for. You cannot reserve, hold, discount or set aside items. To move a sale forward, ask if they want to order.
6. Never share or invent bank account details. Payment: ${v.paymentNote}
7. Complaints, refunds, custom requests or anything the tools can't answer: call escalate_to_vendor and tell the customer we will reply personally soon.
8. If the customer hasn't said which variant or city, ask one short question instead of assuming.
9. Earlier messages in this chat are the conversation so far. When the customer confirms something already discussed
   ("yes", "I wan order one", "send am"), act on it with the product, variant and city from earlier: don't ask again.
   Still look the figures up again with the tools, because stock and prices can change.
${postCaption ? `\nThe customer is responding to this post: "${postCaption}"` : ""}

When you are done, reply with only the message text to send to the customer.`;
}

export interface AgentStep {
  tool: string;
  args: unknown;
  result: unknown;
}

export interface AgentRun {
  draftReply: string;
  steps: AgentStep[];
  orderRefs: string[];
  escalated: boolean;
  grounding: GroundingReport;
  repaired: boolean;
  /** Every ₦ amount the tools returned in this run; lets the UI re-check a draft after the vendor edits it. */
  groundedAmounts: number[];
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number };
}

export async function runSalesAgent(input: {
  message: string;
  channel: ToolContext["channel"];
  postId?: string;
  customerHandle?: string;
  enquiryId?: string;
  history?: OpenAI.ChatCompletionMessageParam[];
}): Promise<AgentRun> {
  const client = meta();
  const post = input.postId ? await store.post(input.postId) : undefined;
  const ctx: ToolContext = { channel: input.channel, postId: input.postId, customerHandle: input.customerHandle, enquiryId: input.enquiryId };

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt(post?.caption || undefined) },
    ...(input.history ?? []),
    { role: "user", content: input.message },
  ];

  const steps: AgentStep[] = [];
  const grounded = new Set<number>();
  const orderRefs: string[] = [];
  let escalated = false;
  let repaired = false;
  const usage = { prompt_tokens: 0, completion_tokens: 0 };

  for (let step = 0; step < MAX_STEPS + 1; step++) {
    const res = await client.chat.completions.create({
      model: MODELS.agent,
      messages,
      tools: toolDefinitions,
      tool_choice: "auto",
      temperature: 0.3,
    });
    usage.prompt_tokens += res.usage?.prompt_tokens ?? 0;
    usage.completion_tokens += res.usage?.completion_tokens ?? 0;

    const msg = res.choices[0]?.message;
    if (!msg) throw new Error("Empty response from model");
    messages.push(msg);

    const calls = msg.tool_calls ?? [];
    if (calls.length > 0) {
      // Muse Spark supports parallel tool calls, so run them together.
      const results = await Promise.all(
        calls.map(async (call) => {
          const r = await runTool(call.function.name, call.function.arguments, ctx);
          r.groundedAmounts?.forEach((a) => grounded.add(a));
          if (call.function.name === "create_order_draft" && r.ok) orderRefs.push((r.data as { order_ref: string }).order_ref);
          if (call.function.name === "escalate_to_vendor" && r.ok) escalated = true;
          steps.push({ tool: call.function.name, args: safeParse(call.function.arguments), result: r.ok ? r.data : { error: r.error } });
          return { id: call.id, r };
        }),
      );
      for (const { id, r } of results) {
        messages.push({ role: "tool", tool_call_id: id, content: JSON.stringify(r.ok ? r.data : { error: r.error }) });
      }
      continue;
    }

    const draft = (msg.content ?? "").trim();
    const report = checkGrounding(draft, grounded);

    // One self-repair attempt if the draft mentions an amount no tool returned.
    if (!report.ok && !repaired) {
      repaired = true;
      messages.push({
        role: "user",
        content: `SYSTEM CHECK: your draft mentions amounts not returned by any tool: ${report.ungrounded
          .map((n) => `₦${n.toLocaleString("en-NG")}`)
          .join(", ")}. Use the tools to get the correct figures, or remove them, then give the corrected reply only.`,
      });
      continue;
    }

    return { draftReply: draft, steps, orderRefs, escalated, grounding: report, repaired, groundedAmounts: [...grounded], model: MODELS.agent, usage };
  }

  throw new Error(`Agent did not finish within ${MAX_STEPS} steps`);
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
