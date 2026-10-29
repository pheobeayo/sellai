import { classifyBatch } from "@/agent/classify";
import { checkGrounding } from "@/agent/grounding";
import { INTENT_PRIORITY } from "@/agent/intents";
import { runSalesAgent } from "@/agent/sales-agent";
import type { DraftMeta, Enquiry, EnquiryRecord, Order } from "@/domain/types";
import { parseAttribution } from "@/integrations/attribution";
import { store } from "@/store/store";

/**
 * Every incoming message takes the same path, whether it came from the Meta webhook,
 * a voice note, or a pasted import:
 *   1. save (idempotent: Meta retries webhooks)
 *   2. WhatsApp message carrying an order ref (SA-XXXX)? → confirm the order, draft a confirmation
 *   3. triage everything else (intent, language, priority)
 *   4. auto-draft replies for messages that need one
 */

const NO_REPLY_NEEDED = new Set(["casual_engagement", "spam_or_irrelevant"]);
const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

export interface IngestOptions {
  triage?: boolean;
  autoDraft?: boolean;
  /** Cap on agent runs per call, so a burst of comments can't run up the bill. */
  maxDrafts?: number;
}

export interface IngestResult {
  inserted: string[];
  duplicates: number;
  confirmedOrders: string[];
  triaged: number;
  drafted: string[];
  errors: string[];
}

export async function ingest(items: Enquiry[], opts: IngestOptions = {}): Promise<IngestResult> {
  const { triage = true, autoDraft = true, maxDrafts = 5 } = opts;
  const out: IngestResult = { inserted: [], duplicates: 0, confirmedOrders: [], triaged: 0, drafted: [], errors: [] };

  const fresh: Enquiry[] = [];
  for (const e of items) {
    if (await store.addEnquiry(e)) {
      fresh.push(e);
      out.inserted.push(e.id);
    } else out.duplicates++;
  }

  // Order confirmations: the buyer tapped the checkout link and sent the prefilled WhatsApp message.
  const handled = new Set<string>();
  for (const e of fresh) {
    if (e.channel !== "whatsapp") continue;
    const { orderRef } = parseAttribution(e.text);
    if (!orderRef) continue;
    const order = await store.confirmOrder(orderRef, e.authorHandle);
    if (!order) continue; // unknown ref, or already confirmed: treat as a normal message
    await confirmationDraft(e, order);
    handled.add(e.id);
    out.confirmedOrders.push(order.ref);
  }

  const rest = fresh.filter((e) => !handled.has(e.id));
  if (!triage || rest.length === 0) return out;

  const posts = await store.posts();
  const caption = (id?: string) => posts.find((p) => p.id === id)?.caption || undefined;

  let results;
  try {
    ({ results } = await classifyBatch(rest.map((e) => ({ id: e.id, text: e.text, postCaption: caption(e.postId) }))));
  } catch (err) {
    out.errors.push(`triage: ${(err as Error).message}`);
    return out;
  }
  for (const r of results) {
    await store.saveTriage(r.id, {
      intent: r.intent,
      language: r.language,
      englishGloss: r.english_gloss,
      confidence: r.confidence,
      priority: r.priority,
      status: NO_REPLY_NEEDED.has(r.intent) ? "ignored" : "new",
    });
    out.triaged++;
  }

  if (!autoDraft) return out;
  const toDraft = results.filter((r) => !NO_REPLY_NEEDED.has(r.intent)).slice(0, maxDrafts); // already sorted by priority
  for (const r of toDraft) {
    try {
      await draftReplyFor(r.id);
      out.drafted.push(r.id);
    } catch (err) {
      out.errors.push(`draft ${r.id}: ${(err as Error).message}`);
    }
  }
  return out;
}

/** Run the sales agent for one stored enquiry and save the draft on it. */
export async function draftReplyFor(id: string): Promise<EnquiryRecord> {
  const e = await store.enquiry(id);
  if (!e) throw new Error(`Enquiry ${id} not found`);
  const run = await runSalesAgent({
    message: e.text,
    channel: e.channel,
    postId: e.postId,
    customerHandle: e.authorHandle,
    enquiryId: e.id,
  });
  const meta: DraftMeta = {
    steps: run.steps,
    groundedAmounts: run.groundedAmounts,
    grounding: { ok: run.grounding.ok, ungrounded: run.grounding.ungrounded },
    repaired: run.repaired,
    orderRefs: run.orderRefs,
    escalated: run.escalated,
    model: run.model,
    usage: run.usage,
    source: "agent",
  };
  await store.saveDraft(id, run.draftReply, meta, run.escalated ? "escalated" : "drafted");
  return (await store.enquiry(id))!;
}

/** Deterministic reply for a confirmed order: every figure comes straight from the order row. */
async function confirmationDraft(e: Enquiry, order: Order): Promise<void> {
  const product = await store.product(order.productId);
  const variant = product?.variants.find((v) => v.id === order.variantId);
  const item = `${product?.name ?? "your item"}${variant ? ` (${variant.label})` : ""} x${order.quantity}`;
  const delivery = order.deliveryFeeNaira ? ` including ${naira(order.deliveryFeeNaira)} delivery${order.city ? ` to ${order.city}` : ""}` : "";
  const reply = `Thank you! We've received your order ${order.ref}: ${item}, total ${naira(order.totalNaira)}${delivery}. ${store.vendor().paymentNote}`;
  const amounts = [order.unitPriceNaira, order.unitPriceNaira * order.quantity, order.deliveryFeeNaira, order.totalNaira];

  await store.linkEnquiryToOrder(e.id, order.ref);
  await store.saveTriage(e.id, {
    intent: "ready_to_buy",
    language: "english",
    englishGloss: `Buyer opened checkout for order ${order.ref}`,
    confidence: 1,
    priority: INTENT_PRIORITY.ready_to_buy + 10,
  });
  const g = checkGrounding(reply, amounts);
  await store.saveDraft(e.id, reply, {
    steps: [],
    groundedAmounts: amounts,
    grounding: { ok: g.ok, ungrounded: g.ungrounded },
    repaired: false,
    orderRefs: [order.ref],
    escalated: false,
    model: "template",
    usage: { prompt_tokens: 0, completion_tokens: 0 },
    source: "template",
  });
}
