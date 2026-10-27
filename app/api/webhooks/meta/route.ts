import { NextResponse } from "next/server";
import { normalizeWebhook, verifySignature } from "@/integrations/meta-webhook";
import { downloadWhatsAppMedia, transcribeVoiceNote } from "@/integrations/whatsapp";
import { store } from "@/store/store";

export const runtime = "nodejs";

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

/** Instagram comments, Facebook Page comments and WhatsApp messages all arrive here. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), process.env.META_APP_SECRET)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const { enquiries, voiceNotes } = normalizeWebhook(JSON.parse(raw));
  enquiries.forEach((e) => store.addEnquiry(e));

  // Voice notes: download, transcribe, then treat like a text message.
  // In production move this to a queue; Meta expects a fast 200.
  for (const v of voiceNotes) {
    try {
      const { bytes, mimeType } = await downloadWhatsAppMedia(v.mediaId);
      const text = await transcribeVoiceNote(bytes, mimeType);
      store.addEnquiry({ id: `wa_voice_${v.mediaId}`, channel: "whatsapp", text, authorHandle: v.from, receivedAt: v.receivedAt, transcribedFromVoice: true });
    } catch (e) {
      console.error("voice note failed", v.mediaId, (e as Error).message);
    }
  }

  return NextResponse.json({ received: enquiries.length + voiceNotes.length });
}
