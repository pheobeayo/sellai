import { completeJSON, triageClient } from "@/lib/meta";
import {
  BatchClassificationSchema,
  INTENT_GUIDE,
  INTENT_PRIORITY,
  INTENTS,
  LANGUAGES,
  type Classification,
} from "./intents";

const SYSTEM = `You triage social-media comments and DMs for a small Nigerian online vendor.
Customers write in English, Nigerian Pidgin, Yoruba, Igbo, Hausa, or a mix, often with slang and shorthand
(e.g. "HM" = how much, "DM price", "abeg", "una dey deliver?", "elo ni", "nawa ne", "ego ole").

Classify each message into exactly one intent:
${INTENTS.map((i) => `- ${i}: ${INTENT_GUIDE[i]}`).join("\n")}

Rules:
- If a message mixes intents, pick the one closest to a purchase (ready_to_buy > price/delivery/availability > product_question).
- complaint always wins over other intents.
- Fixed specs of the product (lace size, hair type/origin, material, care) are product_question.
  Options the customer chooses between or that can run out (length, colour, size, stock, restock) are availability_or_variant.
- Short expressions of wanting the item ("I need this!", "Interested", "I want it") count as ready_to_buy: a missed buyer costs more than a false alarm.
- language is one of: ${LANGUAGES.join(", ")}. Use "mixed" for code-switching between two or more.
- Never invent details that are not in the message; use null for product_hint or city when absent.

Return ONLY JSON: {"results":[{"id","intent","language","product_hint","city","english_gloss","confidence"}]}
with one result per input message, in the same order, echoing each id.`;

export interface TriageInput {
  id: string;
  text: string;
  postCaption?: string;
}

export interface TriagedMessage extends Classification {
  text: string;
  priority: number;
}

/** Classify up to ~25 messages in one call. Batching keeps cost low and latency predictable. */
export async function classifyBatch(items: TriageInput[]): Promise<{ results: TriagedMessage[]; provider: string; model: string }> {
  if (items.length === 0) return { results: [], provider: "none", model: "none" };
  const { client, model, provider } = triageClient();

  const user = JSON.stringify(
    items.map((m) => ({ id: m.id, text: m.text, ...(m.postCaption ? { post: m.postCaption } : {}) })),
  );
  const { data } = await completeJSON({ client, model, system: SYSTEM, user, schema: BatchClassificationSchema });

  const byId = new Map(data.results.map((r) => [r.id, r]));
  const results: TriagedMessage[] = items.map((m) => {
    const r = byId.get(m.id);
    if (!r) {
      // Model dropped an item: mark it for manual review instead of guessing.
      return {
        id: m.id, text: m.text, intent: "product_question", language: "other", product_hint: null, city: null,
        english_gloss: "(not classified, needs review)", confidence: 0, priority: INTENT_PRIORITY.product_question,
      };
    }
    return { ...r, text: m.text, priority: INTENT_PRIORITY[r.intent] };
  });

  results.sort((a, b) => b.priority - a.priority || b.confidence - a.confidence);
  return { results, provider, model };
}

export async function classifyAll(items: TriageInput[], batchSize = 20) {
  const all: TriagedMessage[] = [];
  let meta = { provider: "", model: "" };
  for (let i = 0; i < items.length; i += batchSize) {
    const { results, provider, model } = await classifyBatch(items.slice(i, i + batchSize));
    all.push(...results);
    meta = { provider, model };
  }
  all.sort((a, b) => b.priority - a.priority || b.confidence - a.confidence);
  return { results: all, ...meta };
}
