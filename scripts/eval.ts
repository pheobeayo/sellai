import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { classifyAll } from "@/agent/classify";
import { INTENTS, type Intent } from "@/agent/intents";

/**
 * Scores the comment classifier against eval/comments.jsonl.
 * Usage: npm run eval            (all examples)
 *        npm run eval -- --save  (also writes eval/results-<timestamp>.json)
 */

interface Labelled {
  id: string;
  text: string;
  intent: Intent;
  language: string;
  ambiguous?: boolean;
}

const rows: Labelled[] = readFileSync("eval/comments.jsonl", "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

const started = Date.now();
const { results, provider, model } = await classifyAll(rows.map((r) => ({ id: r.id, text: r.text })));
const seconds = (Date.now() - started) / 1000;

const predicted = new Map(results.map((r) => [r.id, r]));
const clear = rows.filter((r) => !r.ambiguous);

let correct = 0;
let langCorrect = 0;
const confusion: Record<string, Record<string, number>> = {};
const misses: Array<{ id: string; text: string; expected: string; got: string }> = [];

for (const r of clear) {
  const p = predicted.get(r.id);
  const got = p?.intent ?? "missing";
  confusion[r.intent] ??= {};
  confusion[r.intent][got] = (confusion[r.intent][got] ?? 0) + 1;
  if (got === r.intent) correct++;
  else misses.push({ id: r.id, text: r.text, expected: r.intent, got });
  if (p && (p.language === r.language || (r.language === "mixed" && p.language !== "english"))) langCorrect++;
}

const perIntent = INTENTS.map((intent) => {
  const tp = clear.filter((r) => r.intent === intent && predicted.get(r.id)?.intent === intent).length;
  const fn = clear.filter((r) => r.intent === intent && predicted.get(r.id)?.intent !== intent).length;
  const fp = clear.filter((r) => r.intent !== intent && predicted.get(r.id)?.intent === intent).length;
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  return { intent, support: tp + fn, precision, recall };
});

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const buyer = perIntent.find((p) => p.intent === "ready_to_buy")!;

console.log(`\nSellAI classifier eval  ·  ${provider} / ${model}  ·  ${rows.length} messages in ${seconds.toFixed(1)}s\n`);
console.log(`Intent accuracy (unambiguous, n=${clear.length}): ${pct(correct / clear.length)}`);
console.log(`Ready-to-buy recall (buyers we must not miss):   ${pct(buyer.recall)}`);
console.log(`Language accuracy:                               ${pct(langCorrect / clear.length)}\n`);
console.table(perIntent.map((p) => ({ intent: p.intent, n: p.support, precision: pct(p.precision), recall: pct(p.recall) })));

if (misses.length) {
  console.log("\nMisclassified:");
  console.table(misses);
}

console.log("\nAmbiguous examples (not scored, for inspection):");
console.table(rows.filter((r) => r.ambiguous).map((r) => ({ text: r.text, labelled: r.intent, got: predicted.get(r.id)?.intent })));

if (process.argv.includes("--save")) {
  const file = `eval/results-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify({ provider, model, seconds, accuracy: correct / clear.length, perIntent, confusion, misses, results }, null, 2));
  console.log(`\nSaved ${file}`);
}
