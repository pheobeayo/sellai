import type { DraftMeta, EnquiryRecord } from "@/domain/types";
import { store } from "@/store/store";

/**
 * Autopilot: which drafts may send themselves.
 * Only low-risk questions (price, delivery, stock, product facts) on WhatsApp, with every check passing.
 * Orders, complaints, uncertain triage and anything a check flagged always wait for the vendor.
 */

export const AUTOPILOT_INTENTS = new Set(["price_enquiry", "delivery_enquiry", "availability_or_variant", "product_question"]);
export const MIN_TRIAGE_CONFIDENCE = 0.8;
const SETTING_KEY = "autopilot";

const INTENT_NAMES: Record<string, string> = {
  ready_to_buy: "Ready-to-buy",
  complaint: "Complaint",
  casual_engagement: "Casual",
  spam_or_irrelevant: "Spam",
};

export async function isAutopilotOn(): Promise<boolean> {
  return store.getSetting<boolean>(SETTING_KEY, false);
}

export async function setAutopilot(on: boolean): Promise<void> {
  await store.setSetting(SETTING_KEY, on);
}

export interface AutopilotDecision {
  eligible: boolean;
  reason: string;
}

export function decideAutopilot(
  e: Pick<EnquiryRecord, "channel" | "authorHandle" | "intent" | "confidence">,
  meta: Pick<DraftMeta, "orderRefs" | "escalated" | "checks" | "source">,
  enabled: boolean,
): AutopilotDecision {
  if (!enabled) return { eligible: false, reason: "Autopilot is off" };
  if (meta.source !== "agent") return { eligible: false, reason: "Order confirmations wait for you" };
  if (e.channel !== "whatsapp" || !e.authorHandle) return { eligible: false, reason: "Only WhatsApp replies can be sent automatically" };
  if (!e.intent || !AUTOPILOT_INTENTS.has(e.intent)) return { eligible: false, reason: `${INTENT_NAMES[e.intent ?? ""] ?? "These"} messages always wait for you` };
  if ((e.confidence ?? 0) < MIN_TRIAGE_CONFIDENCE) return { eligible: false, reason: "Not sure enough what the customer wants" };
  if (meta.orderRefs.length) return { eligible: false, reason: "Creates an order, so you confirm it" };
  if (meta.escalated) return { eligible: false, reason: "Escalated to you" };
  const failed = meta.checks?.checks.find((c) => !c.ok);
  if (!meta.checks || failed) return { eligible: false, reason: `Held: ${failed ? failed.label.toLowerCase() : "not checked"}` };
  return { eligible: true, reason: "Low-risk answer and every check passed" };
}
