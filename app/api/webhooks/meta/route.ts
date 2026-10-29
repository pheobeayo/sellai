import { after, NextResponse } from "next/server";
import { transcribe } from "@/ai/transcribe";
import type { Enquiry } from "@/domain/types";
import { ingest } from "@/inbox/pipeline";
import { normalizeWebhook, verifySignature } from "@/integrations/meta-webhook";
import { downloadWhatsAppMedia } from "@/integrations/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Meta calls this once when you register the webhook URL in the app dashboard. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/**
 * Instagram comments, Facebook Page comments and WhatsApp messages all arrive here.
 * Meta expects a quick 200, so the work (transcribe → save → triage → draft) runs after the response.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), process.env.META_APP_SECRET)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const { enquiries, voiceNotes } = normalizeWebhook(payload as never);

  after(async () => {
    const all: Enquiry[] = [...enquiries];
    for (const v of voiceNotes) {
      try {
        const { bytes } = await downloadWhatsAppMedia(v.mediaId);
        const { text } = await transcribe(bytes);
        if (text) {
          all.push({ id: `wa_${v.messageId}`, channel: "whatsapp", text, authorHandle: v.from, authorName: v.fromName, receivedAt: v.receivedAt, transcribedFromVoice: true });
        }
      } catch (e) {
        console.error("[webhook] voice note failed", v.mediaId, (e as Error).message);
      }
    }
    if (all.length === 0) return;
    const r = await ingest(all);
    console.log(
      `[webhook] saved ${r.inserted.length} (dupes ${r.duplicates}) · triaged ${r.triaged} · drafted ${r.drafted.length} · orders confirmed ${r.confirmedOrders.join(", ") || "none"}` +
        (r.errors.length ? ` · errors: ${r.errors.join("; ")}` : ""),
    );
  });

  return NextResponse.json({ received: enquiries.length + voiceNotes.length });
}
