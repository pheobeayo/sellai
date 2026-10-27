import { createHmac, timingSafeEqual } from "node:crypto";
import type { Enquiry } from "@/domain/types";

/** Verify Meta's X-Hub-Signature-256 header against the raw request body. */
export function verifySignature(rawBody: string, header: string | null, appSecret: string | undefined): boolean {
  if (!appSecret) return process.env.NODE_ENV !== "production"; // allow unsigned payloads only in local dev
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from("sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex"));
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** A WhatsApp voice note that still needs downloading and transcribing. */
export interface PendingVoiceNote {
  mediaId: string;
  from: string;
  receivedAt: string;
}

export interface NormalizedEvents {
  enquiries: Enquiry[];
  voiceNotes: PendingVoiceNote[];
}

/* Loose payload shapes: only the fields we read. Check them against real payloads in the Meta app dashboard. */
interface WebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    time?: number;
    changes?: Array<{ field?: string; value?: Record<string, any> }>;
  }>;
}

/**
 * Turns Instagram comment, Facebook Page feed and WhatsApp Cloud API webhooks
 * into one Enquiry shape the rest of the app understands.
 */
export function normalizeWebhook(body: WebhookPayload): NormalizedEvents {
  const out: NormalizedEvents = { enquiries: [], voiceNotes: [] };

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};

      // Instagram: field "comments"
      if (body.object === "instagram" && change.field === "comments" && v.text) {
        out.enquiries.push({
          id: `ig_${v.id}`,
          channel: "instagram_comment",
          text: v.text,
          authorHandle: v.from?.username,
          postId: v.media?.id,
          receivedAt: new Date().toISOString(),
        });
      }

      // Facebook Page: field "feed", item "comment"
      if (body.object === "page" && change.field === "feed" && v.item === "comment" && v.verb === "add" && v.message) {
        out.enquiries.push({
          id: `fb_${v.comment_id}`,
          channel: "facebook_comment",
          text: v.message,
          authorHandle: v.from?.name,
          postId: v.post_id,
          receivedAt: new Date((v.created_time ?? Date.now() / 1000) * 1000).toISOString(),
        });
      }

      // WhatsApp Cloud API: field "messages"
      if (body.object === "whatsapp_business_account" && change.field === "messages") {
        for (const m of (v.messages ?? []) as Array<Record<string, any>>) {
          const receivedAt = new Date(Number(m.timestamp ?? Date.now() / 1000) * 1000).toISOString();
          if (m.type === "text" && m.text?.body) {
            out.enquiries.push({ id: `wa_${m.id}`, channel: "whatsapp", text: m.text.body, authorHandle: m.from, receivedAt });
          } else if (m.type === "audio" && m.audio?.id) {
            out.voiceNotes.push({ mediaId: m.audio.id, from: m.from, receivedAt });
          }
        }
      }
    }
  }
  return out;
}
