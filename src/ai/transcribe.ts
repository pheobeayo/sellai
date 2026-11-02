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
    asKeywords(p.name).forEach((w) => words.add(w));
    p.tags.forEach((t) => asKeywords(t).forEach((w) => words.add(w)));
    p.variants.forEach((v) => asKeywords(v.label).forEach((w) => words.add(w)));
  }
  for (const z of store.deliveryZones()) asKeywords(z.city).forEach((w) => words.add(w));
  return [...words].slice(0, limit);
}

/** The ASR API rejects any keyword over 30 characters, so long product names are shortened or dropped. */
export const MAX_KEYWORD_CHARS = 30;
export function asKeywords(phrase: string): string[] {
  const p = phrase.trim().replace(/\s+/g, " ");
  if (p.length < 2) return [];
  if (p.length <= MAX_KEYWORD_CHARS) return [p];
  // "Long Black Loose Wave Wig with Middle Part" → "Long Black Loose Wave Wig" → "Loose Wave Wig"
  const head = p.split(/\s+(?:with|for|and|in|-|–|,)\s+/i)[0].trim();
  if (head.length >= 2 && head.length <= MAX_KEYWORD_CHARS) return [head];
  const words = head.split(" ");
  while (words.length > 1 && words.join(" ").length > MAX_KEYWORD_CHARS) words.shift();
  const tail = words.join(" ");
  return tail.length >= 2 && tail.length <= MAX_KEYWORD_CHARS ? [tail] : [];
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
