import assert from "node:assert/strict";
import { checkGrounding, extractNairaAmounts } from "@/agent/grounding";
import { runTool } from "@/agent/tools";
import { normalizeWebhook } from "@/integrations/meta-webhook";
import { parseAttribution, whatsappCheckoutLink } from "@/integrations/attribution";
import { store } from "@/store/store";

// Offline checks: no API key needed. Run with `npm run selftest`.

assert.deepEqual(extractNairaAmounts("It's ₦75,000 and delivery is N5000").sort(), [5000, 75000]);
assert.deepEqual(extractNairaAmounts("na 98k for 24 inches"), [98000]);
assert.deepEqual(extractNairaAmounts("Total: 103,000 naira"), [103000]);
assert.equal(checkGrounding("Price is ₦75,000", [75000]).ok, true);
assert.equal(checkGrounding("Price is ₦70,000", [75000]).ok, false);

const ctx = { channel: "instagram_comment" as const, postId: "post_ig_bs01", customerHandle: "t" };
const p = await runTool("get_product", JSON.stringify({ product_id: "p_bone_straight" }), ctx);
assert.ok(p.ok && p.groundedAmounts?.includes(98000));

const d = await runTool("get_delivery_quote", JSON.stringify({ city: "wuse" }), ctx);
assert.ok(d.ok && (d.data as { served: boolean; city: string }).city === "Abuja");

const oos = await runTool("create_order_draft", JSON.stringify({ product_id: "p_bone_straight", variant_id: "v_bs_26" }), ctx);
assert.equal(oos.ok, false, "out-of-stock variant must be rejected");

const ord = await runTool("create_order_draft", JSON.stringify({ product_id: "p_bone_straight", variant_id: "v_bs_24", quantity: 1, city: "Abuja" }), ctx);
assert.ok(ord.ok);
const od = ord.data as { order_ref: string; total: string; checkout_link: string };
assert.match(od.total, /103,000/);
assert.equal(od.checkout_link, `http://localhost:3000/o/${od.order_ref}`, "agent gets a short tracked link");

// search_catalogue now returns variants with ids, prices and stock
const s = await runTool("search_catalogue", JSON.stringify({ query: "body wave" }), ctx);
const sm = (s.data as { matches: Array<{ product_id: string; variants: Array<{ variant_id: string; in_stock: boolean }> }> }).matches;
assert.equal(sm[0].product_id, "p_body_wave");
assert.ok(sm[0].variants.some((v) => v.variant_id === "v_bw_18" && v.in_stock));

// Click tracking + the WhatsApp link the short link redirects to
assert.equal(store.recordClick(od.order_ref)?.linkClicks, 1);
assert.equal(store.recordClick(od.order_ref)?.linkClicks, 2);
assert.equal(store.recordClick("SA-NOPE"), undefined);
const wa = whatsappCheckoutLink({ vendorNumber: "2348000000000", orderRef: od.order_ref, productName: "Bone Straight 24 inches", postId: "post_ig_bs01" });
const back = parseAttribution(decodeURIComponent(wa.split("text=")[1]));
assert.equal(back.orderRef, od.order_ref);
assert.equal(back.postId, "post_ig_bs01");

const ev = normalizeWebhook({
  object: "whatsapp_business_account",
  entry: [{ changes: [{ field: "messages", value: { messages: [
    { id: "m1", from: "2348011111111", timestamp: "1793000000", type: "text", text: { body: "Una dey deliver Ibadan?" } },
    { id: "m2", from: "2348011111111", timestamp: "1793000001", type: "audio", audio: { id: "media123" } },
  ] } }] }],
});
assert.equal(ev.enquiries.length, 1);
assert.equal(ev.voiceNotes[0].mediaId, "media123");

console.log("selftest: all checks passed");
