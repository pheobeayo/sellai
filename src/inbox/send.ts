import type { CheckResult } from "@/agent/checks";
import { sendWhatsAppText } from "@/integrations/whatsapp";
import { store } from "@/store/store";
import { checkReply } from "./verify";

export interface SendResult {
  delivered: boolean;
  via: "whatsapp" | "manual";
  auto: boolean;
  messageId?: string;
  note?: string;
}

/** The reply failed one or more blocking checks. The vendor can still send it with `force`. */
export class ReplyCheckError extends Error {
  constructor(public failed: CheckResult[]) {
    super(`Reply held: ${failed.map((c) => `${c.label}${c.detail ? ` (${c.detail})` : ""}`).join("; ")}`);
  }
  get ungrounded(): number[] {
    const d = this.failed.find((c) => c.id === "amounts_grounded")?.detail ?? "";
    return [...d.matchAll(/₦([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, "")));
  }
}
/** Kept for older imports. */
export const UngroundedReplyError = ReplyCheckError;

/**
 * Send an approved reply (possibly edited by the vendor, or approved by autopilot).
 * The same independent checks run again on the final text, so an edit can't slip in an
 * invented price, an account number or a promise the business can't keep.
 */
export async function approveAndSend(id: string, text: string, opts: { force?: boolean; auto?: boolean } = {}): Promise<SendResult> {
  const e = await store.enquiry(id);
  if (!e) throw new Error(`Enquiry ${id} not found`);
  const body = text.trim();
  if (!body) throw new Error("Reply is empty");
  const auto = opts.auto ?? false;

  const meta = e.draftMeta ?? { groundedAmounts: [], orderRefs: [], escalated: false };
  const report = await checkReply(e, body, meta);
  const blocking = report.checks.filter((c) => !c.ok && c.severity === "block");
  if (blocking.length && !opts.force) throw new ReplyCheckError(blocking);
  if (auto && !report.clean) throw new ReplyCheckError(report.checks.filter((c) => !c.ok)); // autopilot never overrides

  if (e.channel === "whatsapp" && e.authorHandle) {
    if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
      await store.markReplied(id, body, { auto });
      return { delivered: false, via: "manual", auto, note: "WhatsApp API isn't configured, so the reply was copied for you to send." };
    }
    const { messageId } = await sendWhatsAppText(e.authorHandle, body);
    await store.markReplied(id, body, { auto });
    return { delivered: true, via: "whatsapp", auto, messageId };
  }

  await store.markReplied(id, body, { auto });
  return { delivered: false, via: "manual", auto, note: "Copied. Paste it as a reply in the Instagram or Facebook app." };
}
