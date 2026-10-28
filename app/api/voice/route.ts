import { NextResponse } from "next/server";
import { classifyBatch } from "@/agent/classify";
import { runSalesAgent } from "@/agent/sales-agent";
import { TRANSCRIBE_MODEL, transcribe } from "@/ai/transcribe";
import { store } from "@/store/store";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 16 * 1024 * 1024;

/**
 * Voice note → reply draft, the same path a WhatsApp voice note takes:
 * Muse Voice Transcribe → triage → sales agent.
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
    const { results } = await classifyBatch([{ id: "voice", text: transcript.text, postCaption: postId ? store.post(postId)?.caption : undefined }]);
    timings.triage = Date.now() - t;

    t = Date.now();
    const run = await runSalesAgent({ message: transcript.text, channel: "whatsapp", postId });
    timings.agent = Date.now() - t;

    store.addEnquiry({ id: `voice_${Date.now()}`, channel: "whatsapp", text: transcript.text, postId, receivedAt: new Date().toISOString(), transcribedFromVoice: true });
    return NextResponse.json({ transcript: { ...transcript, model: TRANSCRIBE_MODEL }, classification: results[0], run, timings });
  } catch (e) {
    return NextResponse.json({ error: { code: "voice_failed", message: (e as Error).message }, timings }, { status: 502 });
  }
}
