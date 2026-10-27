import type OpenAI from "openai";
import { MODELS, meta } from "@/lib/meta";
import { store } from "@/store/store";
import { checkGrounding, type GroundingReport } from "./grounding";
import { runTool, toolDefinitions, type ToolContext } from "./tools";

const MAX_STEPS = 6;

function systemPrompt(postCaption?: string): string {
  const v = store.vendor();
  return `You are the sales assistant for "${v.businessName}", a Nigerian online vendor.
You draft replies to customer comments and DMs. The vendor reviews every draft before it is sent.

Style: ${v.tone}
Keep replies under 60 words. Reply in the customer's own language and register.

Hard rules:
1. Every price, stock level and delivery fee you mention MUST come from a tool result in this conversation. Never guess.
2. Look products up with search_catalogue / get_product before quoting. If a variant is out of stock, say so and offer one that is in stock.
3. If the customer is ready to buy and has chosen a variant, call create_order_draft and include the checkout link in your reply.
4. Never share or invent bank account details. Payment: ${v.paymentNote}
5. Complaints, refunds, custom requests or anything the tools can't answer: call escalate_to_vendor and tell the customer the vendor will reply personally.
6. If the customer hasn't said which variant or city, ask one short question instead of assuming.
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
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number };
}

export async function runSalesAgent(input: {
  message: string;
  channel: ToolContext["channel"];
  postId?: string;
  customerHandle?: string;
  history?: OpenAI.ChatCompletionMessageParam[];
}): Promise<AgentRun> {
  const client = meta();
  const post = input.postId ? store.post(input.postId) : undefined;
  const ctx: ToolContext = { channel: input.channel, postId: input.postId, customerHandle: input.customerHandle };

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt(post?.caption) },
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

    return { draftReply: draft, steps, orderRefs, escalated, grounding: report, repaired, model: MODELS.agent, usage };
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
