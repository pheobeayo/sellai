import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { TRANSCRIBE_MODEL, transcribe } from "@/ai/transcribe";
import { ingest } from "@/inbox/pipeline";
import { store } from "@/store/store";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 16 * 1024 * 1024;

/**
 * Voice note upload: the same path a WhatsApp voice note takes through the webhook.
 * Muse Voice Transcribe → save → triage → draft. The result lands in the inbox.
 * multipart/form-data: audio (file: .ogg/.opus/.m4a/.mp3/.wav), postId (optional)
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File)) return NextResponse.json({ error: { code: "bad_request", message: "Attach an audio file in the 'audio' field" } }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: { code: "too_large", message: "Audio must be under 16 MB" } }, { status: 413 });
  const postId = (form?.get("postId") as string | null) || undefined;

  const timings: Record<string, number> = {};
  try {
    let t = Date.now();
    const transcript = await transcribe(Buffer.from(await audio.arrayBuffer()));
    timings.transcribe = Date.now() - t;
    if (!transcript.text) return NextResponse.json({ error: { code: "empty_transcript", message: "No speech detected in the voice note" } }, { status: 422 });

    t = Date.now();
    const id = `voice_${Date.now()}_${randomBytes(2).toString("hex")}`;
    const r = await ingest(
      [{ id, channel: "manual_import", text: transcript.text, postId, receivedAt: new Date().toISOString(), transcribedFromVoice: true }],
      { triage: true, autoDraft: true, maxDrafts: 1 },
    );
    timings.triageAndDraft = Date.now() - t;
    if (r.errors.length) throw new Error(r.errors.join("; "));

    return NextResponse.json({ transcript: { ...transcript, model: TRANSCRIBE_MODEL }, enquiry: await store.enquiry(id), timings });
  } catch (e) {
    return NextResponse.json({ error: { code: "voice_failed", message: (e as Error).message }, timings }, { status: 502 });
  }
}
