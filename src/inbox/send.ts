import { checkGrounding } from "@/agent/grounding";
import { sendWhatsAppText } from "@/integrations/whatsapp";
import { store } from "@/store/store";

export interface SendResult {
  delivered: boolean;
  via: "whatsapp" | "manual";
  messageId?: string;
  note?: string;
}

export class UngroundedReplyError extends Error {
  constructor(public ungrounded: number[]) {
    super(`Reply mentions amounts not verified against your catalogue: ${ungrounded.map((n) => `₦${n.toLocaleString("en-NG")}`).join(", ")}`);
  }
}

/**
 * The vendor approved a reply (possibly edited). Re-check the ₦ amounts against what the tools
 * returned for this draft, then send it: through the WhatsApp Cloud API for WhatsApp messages,
 * or mark it replied for comments the vendor answers in the Instagram/Facebook app.
 */
export async function approveAndSend(id: string, text: string, opts: { force?: boolean } = {}): Promise<SendResult> {
  const e = await store.enquiry(id);
  if (!e) throw new Error(`Enquiry ${id} not found`);
  const body = text.trim();
  if (!body) throw new Error("Reply is empty");

  const g = checkGrounding(body, e.draftMeta?.groundedAmounts ?? []);
  if (!g.ok && !opts.force) throw new UngroundedReplyError(g.ungrounded);

  if (e.channel === "whatsapp" && e.authorHandle) {
    if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
      await store.markReplied(id, body);
      return { delivered: false, via: "manual", note: "WhatsApp API isn't configured, so the reply was copied for you to send." };
    }
    const { messageId } = await sendWhatsAppText(e.authorHandle, body);
    await store.markReplied(id, body);
    return { delivered: true, via: "whatsapp", messageId };
  }

  await store.markReplied(id, body);
  return { delivered: false, via: "manual", note: "Copied. Paste it as a reply in the Instagram or Facebook app." };
}
