import { store } from "@/store/store";
import { toTranscribableWav } from "./audio";

/**
 * Muse Voice Transcribe, recording endpoint.
 * POST /v1/asr/transcribe, multipart: `request` (JSON settings) + `audio` (WAV file).
 * Docs: https://dev.meta.ai/docs/speech-to-text
 */

export const TRANSCRIBE_MODEL = process.env.MODEL_TRANSCRIBE || "muse-voice-transcribe-1.0";

export interface Transcript {
  text: string;
  durationMs?: number;
  keywordsUsed: number;
}

/**
 * Words the recogniser should expect: product names, styles and delivery cities from the vendor's own data.
 * This is what keeps "bone straight" from becoming "bone strait" in a noisy voice note.
 */
export async function catalogueKeywords(limit = 60): Promise<string[]> {
  const words = new Set<string>();
  for (const p of await store.products()) {
    words.add(p.name);
    p.tags.forEach((t) => words.add(t));
    p.variants.forEach((v) => words.add(v.label));
  }
  for (const z of store.deliveryZones()) words.add(z.city);
  return [...words].filter((w) => w.length > 1).slice(0, limit);
}

export async function transcribe(audio: Buffer): Promise<Transcript> {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) throw new Error("MODEL_API_KEY is not set");
  const base = (process.env.META_BASE_URL || "https://api.meta.ai/v1").replace(/\/+$/, "");

  const wav = await toTranscribableWav(audio); // always normalise: OGG/Opus, MP3, M4A, odd sample rates
  const keywords = await catalogueKeywords();

  const form = new FormData();
  form.append(
    "request",
    JSON.stringify({
      model: TRANSCRIBE_MODEL,
      mode: "PUSH_TO_TALK",
      audioEncoding: "WAV",
      // Hint only. Yoruba, Igbo and Hausa are not in the supported list; Nigerian English and Pidgin come through as English.
      languageBias: ["English"],
      keywords,
    }),
  );
  form.append("audio", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "voice.wav");

  const res = await fetch(`${base}/asr/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    body: form,
    signal: AbortSignal.timeout(90_000),
  });
  const body = (await res.json().catch(() => ({}))) as { transcript?: string; audioDurationMs?: number; error?: { message?: string } };
  if (!res.ok) throw new Error(`Transcription failed (${res.status}): ${body.error?.message ?? JSON.stringify(body)}`);
  return { text: (body.transcript ?? "").trim(), durationMs: body.audioDurationMs, keywordsUsed: keywords.length };
}
