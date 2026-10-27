import "dotenv/config";
import { runSalesAgent } from "@/agent/sales-agent";
import { store } from "@/store/store";

// Runs the sales agent on a few realistic messages and prints each draft with its tool trace.
const cases = [
  { message: "abeg how much be the bone straight 24 inches? una dey deliver Abuja?", postId: "post_ig_bs01" },
  { message: "I want 2 of the body wave 18 inches, deliver to Ikeja. How I go pay?", postId: "post_fb_bw01" },
  { message: "E dey for 26 inches?", postId: "post_ig_bs01" },
  { message: "I paid since Monday, my wig never reach o", postId: undefined },
];

for (const c of cases) {
  console.log("\n" + "─".repeat(72));
  console.log(`CUSTOMER: ${c.message}`);
  const run = await runSalesAgent({ message: c.message, channel: "instagram_comment", postId: c.postId, customerHandle: "demo_buyer" });
  for (const s of run.steps) console.log(`  → ${s.tool}(${JSON.stringify(s.args)})`);
  console.log(`DRAFT: ${run.draftReply}`);
  console.log(
    `grounding: ${run.grounding.ok ? "OK" : "FLAGGED " + run.grounding.ungrounded.join(", ")}` +
      `${run.repaired ? " (self-repaired)" : ""} · orders: ${run.orderRefs.join(", ") || "none"} · escalated: ${run.escalated}` +
      ` · tokens: ${run.usage.prompt_tokens}+${run.usage.completion_tokens}`,
  );
}

console.log(`\nDraft orders created: ${store.orders().length}`);
