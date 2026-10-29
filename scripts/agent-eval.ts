import "dotenv/config";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { scenarios, type Expectation, type Scenario } from "../eval/agent-scenarios";
import { setAutopilot } from "@/inbox/autopilot";
import { draftReplyFor, ingest } from "@/inbox/pipeline";
import { approveAndSend } from "@/inbox/send";
import { MODELS } from "@/lib/meta";
import { store } from "@/store/store";

/**
 * Runs every scenario in eval/agent-scenarios.ts through the real pipeline (triage → agent → checks
 * → autopilot decision) on a throwaway in-memory database, and scores the final reply.
 *
 *   npm run agent:eval                 all scenarios
 *   npm run agent:eval -- S15 S21      only these
 *   npm run agent:eval -- --save       also write eval/agent-results.json (commit it for the README)
 */

const args = process.argv.slice(2);
const only = args.filter((a) => /^S\d+$/i.test(a)).map((a) => a.toUpperCase());
const save = args.includes("--save");
const list = only.length ? scenarios.filter((s) => only.includes(s.id)) : scenarios;

// Keep the report readable: drop the pipeline's per-draft log lines.
const log = console.log;
console.log = (...a: unknown[]) => {
  if (typeof a[0] === "string" && a[0].startsWith("[draft]")) return;
  log(...a);
};

await setAutopilot(true); // so each draft records whether autopilot would send it (nothing is sent: no WhatsApp here)

interface Outcome {
  id: string;
  name: string;
  tests: Scenario["tests"];
  passed: boolean;
  failures: string[];
  reply: string;
  tools: string[];
  orderTotal?: number;
  checksPassed?: boolean;
  checksClean?: boolean;
  autopilot?: boolean;
  intent?: string;
  ms: number;
  tokens: number;
  error?: string;
}

async function runScenario(s: Scenario): Promise<Outcome> {
  const started = Date.now();
  const handle = `23480${randomBytes(4).readUInt32BE() % 100_000_000}`.padEnd(13, "0");
  const channel = s.channel ?? "whatsapp";
  let tokens = 0;
  let lastId = "";

  for (const [i, text] of s.turns.entries()) {
    const id = `${s.id}_${i}_${randomBytes(2).toString("hex")}`;
    lastId = id;
    const r = await ingest(
      [{ id, channel, text, authorHandle: handle, postId: i === 0 ? s.postId : undefined, receivedAt: new Date(Date.now() + i * 1000).toISOString() }],
      { triage: true, autoDraft: false },
    );
    if (r.errors.length) throw new Error(r.errors.join("; "));
    const rec = await draftReplyFor(id);
    tokens += (rec.draftMeta?.usage.prompt_tokens ?? 0) + (rec.draftMeta?.usage.completion_tokens ?? 0);
    // Earlier turns: send the agent's own draft back as our reply, so the next turn has a real conversation.
    if (i < s.turns.length - 1 && rec.draftReply) await approveAndSend(id, rec.draftReply, { force: true });
  }

  const final = (await store.enquiry(lastId))!;
  const meta = final.draftMeta!;
  const reply = final.draftReply ?? "";
  const tools = meta.steps.map((st) => st.tool);
  const order = meta.orderRefs[0] ? await store.order(meta.orderRefs[0]) : undefined;

  const failures = score(s.expect, {
    reply, tools, hasOrder: meta.orderRefs.length > 0, orderTotal: order?.totalNaira, escalated: meta.escalated,
    checksPassed: meta.checks?.passed, checksClean: meta.checks?.clean, autopilot: meta.autopilot?.eligible, intent: final.intent,
  });
  if (meta.checks && !meta.checks.clean) {
    for (const c of meta.checks.checks.filter((c) => !c.ok)) failures.push(`(info) check ${c.severity === "block" ? "failed" : "warned"}: ${c.label}${c.detail ? `: ${c.detail}` : ""}`);
  }
  const hard = failures.filter((f) => !f.startsWith("(info)"));

  return {
    id: s.id, name: s.name, tests: s.tests, passed: hard.length === 0, failures, reply, tools,
    orderTotal: order?.totalNaira, checksPassed: meta.checks?.passed, checksClean: meta.checks?.clean,
    autopilot: meta.autopilot?.eligible, intent: final.intent, ms: Date.now() - started, tokens,
  };
}

function score(
  x: Expectation,
  got: { reply: string; tools: string[]; hasOrder: boolean; orderTotal?: number; escalated: boolean; checksPassed?: boolean; checksClean?: boolean; autopilot?: boolean; intent?: string },
): string[] {
  const f: string[] = [];
  for (const re of x.mention ?? []) if (!re.test(got.reply)) f.push(`should mention ${re}`);
  for (const re of x.notMention ?? []) if (re.test(got.reply)) f.push(`should not mention ${re}`);
  for (const t of x.tools ?? []) if (!got.tools.includes(t)) f.push(`should call ${t}`);
  for (const t of x.notTools ?? []) if (got.tools.includes(t)) f.push(`should not call ${t}`);
  if (x.order !== undefined && got.hasOrder !== x.order) f.push(x.order ? "should create an order" : "should not create an order");
  if (x.orderTotal !== undefined && got.orderTotal !== x.orderTotal) f.push(`order total should be ₦${x.orderTotal.toLocaleString("en-NG")}, got ${got.orderTotal ?? "none"}`);
  if (x.escalated !== undefined && got.escalated !== x.escalated) f.push(x.escalated ? "should escalate" : "should not escalate");
  if (x.checksPass && !got.checksPassed) f.push("a blocking check failed");
  if (x.checksClean && !got.checksClean) f.push("a check failed or warned");
  if (x.autopilot !== undefined && got.autopilot !== x.autopilot) f.push(x.autopilot ? "autopilot should be able to send this" : "autopilot must not send this");
  if (x.intent && got.intent !== x.intent) f.push(`intent should be ${x.intent}, got ${got.intent}`);
  return f;
}

console.log(`\nSellAI agent eval · ${MODELS.agent} · ${list.length} scenarios\n`);
const outcomes: Outcome[] = [];
for (const s of list) {
  process.stdout.write(`${s.id} ${s.name.padEnd(52)} `);
  try {
    const o = await runScenario(s);
    outcomes.push(o);
    console.log(`${o.passed ? "PASS" : "FAIL"}  ${(o.ms / 1000).toFixed(1)}s`);
    for (const fl of o.failures) console.log(`     ${fl.startsWith("(info)") ? "·" : "✗"} ${fl.replace("(info) ", "")}`);
    if (!o.passed) console.log(`     reply: ${o.reply.replace(/\s+/g, " ").slice(0, 220)}`);
  } catch (e) {
    const err = e as Error;
    outcomes.push({ id: s.id, name: s.name, tests: s.tests, passed: false, failures: [], reply: "", tools: [], ms: 0, tokens: 0, error: err.message });
    console.log(`ERROR ${err.message}`);
  }
}

const passed = outcomes.filter((o) => o.passed).length;
const byArea = [...new Set(outcomes.map((o) => o.tests))].map((t) => {
  const g = outcomes.filter((o) => o.tests === t);
  return { area: t, passed: `${g.filter((o) => o.passed).length}/${g.length}` };
});
const ran = outcomes.filter((o) => !o.error);
const avg = (n: number[]) => (n.length ? n.reduce((a, b) => a + b, 0) / n.length : 0);

console.log(`\n${passed}/${outcomes.length} scenarios passed (${Math.round((passed / outcomes.length) * 100)}%)`);
console.table(byArea);
console.log(
  `checks clean on ${ran.filter((o) => o.checksClean).length}/${ran.length} final replies · ` +
    `autopilot-eligible ${ran.filter((o) => o.autopilot).length}/${ran.length} · ` +
    `avg ${(avg(ran.map((o) => o.ms)) / 1000).toFixed(1)}s and ${Math.round(avg(ran.map((o) => o.tokens)))} tokens per scenario`,
);

if (save) {
  writeFileSync(
    "eval/agent-results.json",
    JSON.stringify({ model: MODELS.agent, ranAt: new Date().toISOString(), passed, total: outcomes.length, byArea, outcomes }, null, 2) + "\n",
  );
  console.log("\nSaved eval/agent-results.json");
}
process.exit(passed === outcomes.length ? 0 : 1);
