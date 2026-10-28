import "dotenv/config";
import { readFileSync } from "node:fs";
import { classifyBatch } from "@/agent/classify";
import { runSalesAgent } from "@/agent/sales-agent";
import { catalogueKeywords, TRANSCRIBE_MODEL, transcribe } from "@/ai/transcribe";

// Usage: npm run voice:demo -- path/to/voice-note.ogg
// Record a WhatsApp voice note asking about a product, export it, and pass the file here.
const path = process.argv[2];
if (!path) {
  console.error("Usage: npm run voice:demo -- path/to/voice-note.(ogg|opus|m4a|mp3|wav)");
  process.exit(1);
}

let t = Date.now();
const transcript = await transcribe(readFileSync(path));
console.log(`\n🎙  ${TRANSCRIBE_MODEL} · ${((Date.now() - t) / 1000).toFixed(1)}s · ${transcript.durationMs ?? "?"}ms audio · ${transcript.keywordsUsed} catalogue keywords`);
console.log(`TRANSCRIPT: ${transcript.text || "(empty)"}`);
if (!transcript.text) process.exit(0);

t = Date.now();
const { results } = await classifyBatch([{ id: "v", text: transcript.text }]);
console.log(`INTENT: ${results[0].intent} (${results[0].language}) · ${((Date.now() - t) / 1000).toFixed(1)}s`);

t = Date.now();
const run = await runSalesAgent({ message: transcript.text, channel: "whatsapp", postId: "post_ig_bs01" });
for (const s of run.steps) console.log(`  → ${s.tool}(${JSON.stringify(s.args)})`);
console.log(`DRAFT: ${run.draftReply}`);
console.log(`grounding: ${run.grounding.ok ? "OK" : "FLAGGED"} · ${((Date.now() - t) / 1000).toFixed(1)}s`);

console.log(`\n(keywords sent: ${catalogueKeywords().slice(0, 8).join(", ")}…)`);
