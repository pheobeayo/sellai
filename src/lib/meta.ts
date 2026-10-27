import OpenAI from "openai";
import type { z } from "zod";

/**
 * Meta Model API is OpenAI-compatible, so the official OpenAI SDK works
 * with a different base URL and key.
 */
export const MODELS = {
  agent: process.env.MODEL_AGENT || "muse-spark-1.1",
  triage: process.env.MODEL_TRIAGE || "muse-spark-1.1",
};

let metaClient: OpenAI | null = null;
let triageClientCache: { client: OpenAI; model: string; provider: string } | null = null;

export function meta(): OpenAI {
  if (!metaClient) {
    const apiKey = process.env.MODEL_API_KEY;
    if (!apiKey) throw new Error("MODEL_API_KEY is not set. Copy .env.example to .env and add your key.");
    metaClient = new OpenAI({ apiKey, baseURL: process.env.META_BASE_URL || "https://api.meta.ai/v1" });
  }
  return metaClient;
}

/**
 * High-volume comment triage. Uses Muse Spark Open on Baseten when TRIAGE_* is set
 * (cheap, open weights), otherwise falls back to Meta Model API.
 */
export function triageClient(): { client: OpenAI; model: string; provider: string } {
  if (triageClientCache) return triageClientCache;
  const baseURL = process.env.TRIAGE_BASE_URL;
  const apiKey = process.env.TRIAGE_API_KEY;
  triageClientCache =
    baseURL && apiKey
      ? {
          client: new OpenAI({ baseURL, apiKey }),
          model: process.env.TRIAGE_MODEL || "meta-models/muse-spark-open-1026",
          provider: "open-weights",
        }
      : { client: meta(), model: MODELS.triage, provider: "meta-model-api" };
  return triageClientCache;
}

/** Pull the first JSON object or array out of a model reply (handles ```json fences and stray prose). */
export function extractJSON(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("No JSON found in model output");
  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  const end = candidate.lastIndexOf(close);
  if (end <= start) throw new Error("Unterminated JSON in model output");
  return JSON.parse(candidate.slice(start, end + 1));
}

export interface JSONCallResult<T> {
  data: T;
  raw: string;
  usage?: OpenAI.CompletionUsage;
  attempts: number;
}

/**
 * Ask for JSON, validate it with zod, and retry once with the validation
 * error fed back to the model if the output doesn't match the schema.
 */
export async function completeJSON<T>(opts: {
  client: OpenAI;
  model: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxRetries?: number;
  temperature?: number;
}): Promise<JSONCallResult<T>> {
  const { client, model, system, user, schema, maxRetries = 1, temperature = 0.2 } = opts;
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  const jsonMode = process.env.META_JSON_MODE === "json_object";

  let lastError = "";
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const res = await client.chat.completions.create({
      model,
      messages,
      temperature,
      ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    });
    const raw = res.choices[0]?.message?.content ?? "";
    try {
      const parsed = schema.safeParse(extractJSON(raw));
      if (parsed.success) return { data: parsed.data, raw, usage: res.usage, attempts: attempt };
      lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch (e) {
      lastError = (e as Error).message;
    }
    messages.push({ role: "assistant", content: raw });
    messages.push({
      role: "user",
      content: `Your last reply did not match the required JSON schema (${lastError}). Reply again with only valid JSON.`,
    });
  }
  throw new Error(`Model output failed validation after ${maxRetries + 1} attempts: ${lastError}`);
}
