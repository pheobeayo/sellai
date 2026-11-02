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
assert.equal((await store.recordClick(od.order_ref))?.linkClicks, 1);
assert.equal((await store.recordClick(od.order_ref))?.linkClicks, 2);
assert.equal(await store.recordClick("SA-NOPE"), undefined);
const wa = whatsappCheckoutLink({ vendorNumber: "2348000000000", orderRef: od.order_ref, productName: "Bone Straight 24 inches", postId: "post_ig_bs01" });
const back = parseAttribution(decodeURIComponent(wa.split("text=")[1]));
assert.equal(back.orderRef, od.order_ref);
assert.equal(back.postId, "post_ig_bs01");

const ev = normalizeWebhook({
  object: "whatsapp_business_account",
  entry: [{ changes: [{ field: "messages", value: { contacts: [{ wa_id: "2348011111111", profile: { name: "Ada" } }], messages: [
    { id: "m1", from: "2348011111111", timestamp: "1793000000", type: "text", text: { body: "Una dey deliver Ibadan?" } },
    { id: "m2", from: "2348011111111", timestamp: "1793000001", type: "audio", audio: { id: "media123" } },
  ] } }] }],
});
assert.equal(ev.enquiries.length, 1);
assert.equal(ev.voiceNotes[0].mediaId, "media123");
assert.equal(ev.enquiries[0].authorName, "Ada", "WhatsApp sender name comes from contacts");

// ── Media pipeline (offline) ──────────────────────────────────────────────

// 1. Voice notes: OGG/Opus (what WhatsApp sends) → 24 kHz mono 16-bit WAV (what Muse Voice Transcribe accepts)
const ffmpeg = (await import("ffmpeg-static")).default as unknown as string;
const { execFileSync } = await import("node:child_process");
const ogg = execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-ac", "2", "-ar", "48000", "-c:a", "libopus", "-f", "ogg", "pipe:1"]);
const { toTranscribableWav, isWav } = await import("@/ai/audio");
assert.equal(isWav(ogg), false);
const wav = await toTranscribableWav(ogg);
assert.ok(isWav(wav), "converted output is RIFF/WAVE");
assert.equal(wav.readUInt16LE(22), 1, "mono");
assert.equal(wav.readUInt32LE(24), 24000, "24 kHz");
assert.equal(wav.readUInt16LE(34), 16, "16-bit");

// 2. Cut-out: mask raster becomes the alpha channel, cropped to bounds, padded
const sharp = (await import("sharp")).default;
const { cutoutWithMask } = await import("@/ai/image-utils");
const photo = await sharp({ create: { width: 100, height: 80, channels: 3, background: { r: 200, g: 30, b: 60 } } }).png().toBuffer();
const raster = new Uint8Array(10 * 10).map((_, i) => (Math.floor(i / 10) < 5 ? 1 : 0)); // top half of the box is "product"
const cut = await cutoutWithMask(photo, 100, 80, { left: 20, top: 20, right: 30, bottom: 30 }, raster, 10, 10, 4);
const meta = await sharp(cut).metadata();
assert.equal(meta.width, 18);
assert.equal(meta.height, 18);
assert.equal(meta.channels, 4, "has alpha");
const px = await sharp(cut).raw().toBuffer();
const alphaAt = (x: number, y: number) => px[(y * 18 + x) * 4 + 3];
assert.equal(alphaAt(6, 6), 255, "inside mask is opaque");
assert.equal(alphaAt(6, 12), 0, "outside mask is transparent");
assert.equal(alphaAt(1, 1), 0, "padding is transparent");
// Mask smaller than its bounds gets resized to fit
const cut2 = await cutoutWithMask(photo, 100, 80, { left: 0, top: 0, right: 40, bottom: 40 }, raster, 10, 10, 0);
const px2 = await sharp(cut2).raw().toBuffer();
assert.equal(px2[(5 * 40 + 20) * 4 + 3], 255, "resized mask: top half opaque");
assert.equal(px2[(35 * 40 + 20) * 4 + 3], 0, "resized mask: bottom half transparent");

// 3. Muse Image output type detection
const { sniffImageMime } = await import("@/ai/product-image");
assert.equal(sniffImageMime(await sharp(photo).webp().toBuffer()), "image/webp");
assert.equal(sniffImageMime(photo), "image/png");

// 4. SAM output parsing: a malformed record (box without its mask) is skipped and reported, not thrown
const { parseSegmentation } = await import("@/ai/segment");
async function* samEvents() {
  const text = "<0f>0<|box;x1=10;y1=20;x2=110;y2=220;w=400;h=300|>\n";
  yield { type: "response.output_text.delta", item_id: "m", output_index: 0, content_index: 0, delta: text } as const;
  yield { type: "response.output_text.done", item_id: "m", output_index: 0, content_index: 0, text } as const;
  yield { type: "response.completed" } as const;
}
const segOut = await parseSegmentation(samEvents() as never);
assert.equal(segOut.outcome, "completed");
assert.equal(segOut.objects.length, 0);
assert.ok(segOut.diagnostics.some((d) => d.startsWith("malformed_record")));

// 5. Publishing a listing makes it sellable by the agent's tools
const { publishListing } = await import("@/catalogue/listing");
const pub = await publishListing({ name: "Burgundy Bob Wig", category: "Wigs", description: "Short burgundy bob.", tags: ["bob", "burgundy"], variants: [{ label: "10 inches", priceNaira: 45000, stock: 3 }] });
const found = await runTool("search_catalogue", JSON.stringify({ query: "burgundy bob" }), ctx);
assert.equal((found.data as { matches: Array<{ product_id: string }> }).matches[0].product_id, pub.id);
assert.ok(found.groundedAmounts?.includes(45000));

// ── WhatsApp loop and dashboard (offline: no model calls) ─────────────────
const { ingest } = await import("@/inbox/pipeline");
const { approveAndSend, UngroundedReplyError } = await import("@/inbox/send");
const { getDashboard } = await import("@/dashboard/metrics");

// The agent created a draft order for an Instagram comment (simulated here with the tool directly)
await store.addEnquiry({ id: "t_ig_1", channel: "instagram_comment", text: "I want the 20 inches, I'm in Wuse", postId: "post_ig_bs01", receivedAt: new Date(Date.now() - 600_000).toISOString() });
const ord2 = await runTool("create_order_draft", JSON.stringify({ product_id: "p_bone_straight", variant_id: "v_bs_20", city: "Wuse" }), { ...ctx, enquiryId: "t_ig_1" });
const ref2 = (ord2.data as { order_ref: string }).order_ref;
assert.equal((await store.enquiry("t_ig_1"))?.orderRef, ref2, "order links back to its enquiry");
assert.equal((await store.order(ref2))?.sourceEnquiryId, "t_ig_1");

// Buyer taps the link, then WhatsApp delivers the prefilled message: the order confirms itself
await store.recordClick(ref2);
const waText = decodeURIComponent(whatsappCheckoutLink({ vendorNumber: "234", orderRef: ref2, productName: "Bone Straight 20 inches", postId: "post_ig_bs01" }).split("text=")[1]);
const r1 = await ingest([{ id: "wa_t1", channel: "whatsapp", text: waText, authorHandle: "2348011111111", authorName: "Ada", receivedAt: new Date().toISOString() }], { triage: false });
assert.deepEqual(r1.confirmedOrders, [ref2]);
const confirmed = await store.order(ref2);
assert.equal(confirmed?.status, "confirmed");
assert.equal(confirmed?.customerHandle, "2348011111111");
const conf = await store.enquiry("wa_t1");
assert.equal(conf?.status, "drafted");
assert.equal(conf?.draftMeta?.source, "template");
assert.equal(conf?.postId, "post_ig_bs01", "the WhatsApp confirmation is credited to the order's post");
assert.match(conf?.draftReply ?? "", new RegExp(`${ref2}.*₦80,000`), "confirmation quotes the order total (75,000 + 5,000 Abuja delivery)");
assert.ok(conf?.draftMeta?.grounding.ok);

// Webhook retries are idempotent
const r2 = await ingest([{ id: "wa_t1", channel: "whatsapp", text: waText, receivedAt: new Date().toISOString() }], { triage: false });
assert.equal(r2.duplicates, 1);
assert.equal(r2.confirmedOrders.length, 0);

// Approving: an edited reply with an invented price is blocked; the real one goes through
await assert.rejects(approveAndSend("wa_t1", "Total na ₦70,000"), UngroundedReplyError);
const sent = await approveAndSend("wa_t1", conf!.draftReply!);
assert.equal(sent.via, "manual", "without WhatsApp credentials the reply is marked replied for manual sending");
assert.equal((await store.enquiry("wa_t1"))?.status, "replied");
await approveAndSend("t_ig_1", "Yes o! We go send your checkout link.");

// Vendor marks it paid: stock goes down by one
const stockBefore = (await store.product("p_bone_straight"))!.variants.find((v) => v.id === "v_bs_20")!.stock;
const paid = await store.setOrderStatus(ref2, "paid");
assert.equal(paid.order?.status, "paid");
assert.equal((await store.product("p_bone_straight"))!.variants.find((v) => v.id === "v_bs_20")!.stock, stockBefore - 1);
assert.match((await store.setOrderStatus(ref2, "cancelled")).warning ?? "", /can't be cancelled/);

// Dashboard attributes it all to the Instagram post
const dash = await getDashboard(30);
const igPost = dash.posts.find((p) => p.postId === "post_ig_bs01")!;
assert.ok(igPost.paid >= 1 && igPost.revenueNaira >= 80_000);
assert.ok(igPost.linksClicked >= 1);
assert.equal(dash.totals.paid, dash.posts.reduce((n, p) => n + p.paid, 0));
assert.ok(dash.totals.avgReplyMinutes !== null && dash.totals.avgReplyMinutes >= 0);
assert.ok(!dash.posts.some((p) => p.postId === "(no post)"), "no unattributed messages in this test");
assert.equal(dash.hasDemoData, false);

// ── Conversation history for multi-message sales ──────────────────────────
const { buildHistory } = await import("@/inbox/pipeline");
const t0 = Date.now() - 3600_000;
const at = (min: number) => new Date(t0 + min * 60_000).toISOString();
await store.addEnquiry({ id: "conv_1", channel: "whatsapp", text: "how much be the body wave 18 inches? I dey Lekki", authorHandle: "2348099990000", postId: "post_fb_bw01", receivedAt: at(0) });
await approveAndSend("conv_1", "Body wave 18 inches na ₦52,000, delivery to Lekki na ₦3,500. You wan order?", { force: true });
await store.addEnquiry({ id: "conv_other", channel: "whatsapp", text: "someone else's message", authorHandle: "2348011110000", receivedAt: at(1) });
await store.addEnquiry({ id: "conv_old", channel: "whatsapp", text: "two days ago", authorHandle: "2348099990000", receivedAt: new Date(t0 - 48 * 3600_000).toISOString() });
await store.addEnquiry({ id: "conv_2", channel: "whatsapp", text: "yes o, I wan order one", authorHandle: "2348099990000", receivedAt: at(2) });

const follow = (await store.enquiry("conv_2"))!;
const earlier = await store.conversationBefore(follow);
assert.deepEqual(earlier.map((m) => m.id), ["conv_1"], "same customer, same channel, last 24h only");
const hist = buildHistory(earlier);
assert.equal(hist.length, 2);
assert.equal(hist[0].role, "user");
assert.equal(hist[1].role, "assistant");
assert.match(String(hist[1].content), /₦52,000/, "history carries what we actually sent");
assert.equal((await store.conversationBefore({ id: "x", channel: "whatsapp", receivedAt: at(3) })).length, 0, "no handle, no history");

// ── Independent reply checks ──────────────────────────────────────────────
const { runChecks } = await import("@/agent/checks");
const base = { groundedAmounts: [52000, 3500, 55500], orderRefs: ["SA-ABCD"], escalated: false, appUrl: "http://localhost:3000", customerLanguage: "pidgin", intent: "price_enquiry" };
const ok = runChecks({ ...base, reply: "Body wave 18 inches na ₦52,000, Lekki delivery na ₦3,500. Order here: http://localhost:3000/o/SA-ABCD" });
assert.ok(ok.clean, JSON.stringify(ok.checks.filter((c) => !c.ok)));
const failIds = (reply: string, extra: object = {}) => runChecks({ ...base, ...extra, reply }).checks.filter((c) => !c.ok).map((c) => c.id);
assert.deepEqual(failIds("E na ₦45,000 for you"), ["amounts_grounded"]);
assert.deepEqual(failIds("Pay into 0123456789 abeg"), ["no_bank_details"]);
assert.deepEqual(failIds("Send am to GTBank 012 345 6789 na"), ["no_bank_details"]);
assert.deepEqual(failIds("No wahala, we go reserve am for you"), ["no_unsupported_promises"]);
assert.deepEqual(failIds("I go keep am for you till Friday, e dey"), ["no_unsupported_promises"]);
assert.deepEqual(failIds("We fit give you discount, e dey"), ["no_unsupported_promises"]);
assert.deepEqual(failIds("Pay here na: https://paystack.com/pay/xyz"), ["links_valid"]);
assert.deepEqual(failIds("Order here na: http://localhost:3000/o/SA-ZZZZ"), ["links_valid"]);
assert.deepEqual(failIds("Sorry, we go check am", { intent: "complaint" }), ["complaint_escalated"]);
assert.deepEqual(failIds("Sorry, we go check am", { intent: "complaint", escalated: true }), []);
assert.deepEqual(failIds("The price is ₦52,000 and delivery is ₦3,500."), ["language_match"], "Pidgin customer, English reply: warning");
assert.ok(runChecks({ ...base, reply: "The price is ₦52,000 and delivery is ₦3,500." }).passed, "a warning doesn't block");
assert.deepEqual(failIds("Body wave 18 na ₦52,000", { orderStock: [{ ref: "SA-ABCD", quantity: 5, stock: 2 }] }), ["stock_available"]);
assert.deepEqual(failIds("Call us on 08031234567, e dey"), [], "an 11-digit phone number is not an account number");

// ── Autopilot policy ──────────────────────────────────────────────────────
const { decideAutopilot, isAutopilotOn, setAutopilot } = await import("@/inbox/autopilot");
const waE = { channel: "whatsapp" as const, authorHandle: "234801", intent: "price_enquiry", confidence: 0.95 };
const cleanMeta = { orderRefs: [], escalated: false, checks: ok, source: "agent" as const };
assert.equal(decideAutopilot(waE, cleanMeta, false).eligible, false, "off by default");
assert.equal(decideAutopilot(waE, cleanMeta, true).eligible, true);
assert.equal(decideAutopilot({ ...waE, intent: "ready_to_buy" }, cleanMeta, true).eligible, false);
assert.equal(decideAutopilot({ ...waE, intent: "complaint" }, cleanMeta, true).eligible, false);
assert.equal(decideAutopilot({ ...waE, channel: "instagram_comment" }, cleanMeta, true).eligible, false);
assert.equal(decideAutopilot({ ...waE, confidence: 0.6 }, cleanMeta, true).eligible, false);
assert.equal(decideAutopilot(waE, { ...cleanMeta, orderRefs: ["SA-ABCD"] }, true).eligible, false);
assert.equal(decideAutopilot(waE, { ...cleanMeta, checks: runChecks({ ...base, reply: "E na ₦45,000" }) }, true).eligible, false);
assert.equal(await isAutopilotOn(), false);
await setAutopilot(true);
assert.equal(await isAutopilotOn(), true);
await setAutopilot(false);

// Sending re-runs the checks: an edited-in account number is held, the vendor can override
await store.addEnquiry({ id: "chk_1", channel: "whatsapp", text: "how I go pay?", authorHandle: "2348077770000", receivedAt: new Date().toISOString() });
const { ReplyCheckError } = await import("@/inbox/send");
await assert.rejects(approveAndSend("chk_1", "Pay into 0123456789"), ReplyCheckError);
assert.equal((await approveAndSend("chk_1", "Pay into 0123456789", { force: true })).auto, false);

// Funnel: a confirmed order counts as an opened link even if the click wasn't recorded
const f = await getDashboard(30);
assert.ok(f.totals.linksClicked >= f.totals.confirmed, "funnel never widens");

// Listing drafts are tidied when the model ignores the format rules
const { tidyDraft } = await import("@/ai/describe");
const td = tidyDraft({ name: "Curly Bob Wig", category: "wigs", segment_phrase: "for women wanting a short curly bob look", colour: "black", style: "curly bob",
  tags: ["bob", "curly"], description: "x", confirm_with_vendor: ["price", "stock availability", "hair origin"], suggested_variant_labels: ["As pictured - Black short curly bob", "Other colour / length - confirm", "12 inches"], caption: "x" });
assert.equal(td.segment_phrase, "wig");
assert.deepEqual(td.suggested_variant_labels, ["12 inches"]);
assert.deepEqual(td.confirm_with_vendor, ["hair origin"]);
assert.deepEqual(tidyDraft({ ...td, suggested_variant_labels: ["Other - confirm"] }).suggested_variant_labels, ["Standard"]);
assert.equal(tidyDraft({ ...td, segment_phrase: "handbag" }).segment_phrase, "handbag");

// Speech keywords never exceed the ASR 30-character limit
const { asKeywords, catalogueKeywords } = await import("@/ai/transcribe");
assert.deepEqual(asKeywords("Long Black Loose Wave Wig with Middle Part"), ["Long Black Loose Wave Wig"]);
assert.deepEqual(asKeywords("Bone straight"), ["Bone straight"]);
assert.equal(asKeywords("Extraordinarily Glamorous Burgundy Body Wave Frontal Wig")[0].length <= 30, true);
assert.deepEqual(asKeywords(" "), []);
assert.ok((await catalogueKeywords()).every((k) => k.length >= 2 && k.length <= 30));

// ── Loyalty ───────────────────────────────────────────────────────────────
const L = await import("@/loyalty/rules");
assert.equal(L.tierFor(0, 0), "unpaid");
assert.equal(L.tierFor(1, 80_000), "new");
assert.equal(L.tierFor(2, 160_000), "returning");
assert.equal(L.tierFor(3, 150_000), "loyal");
assert.equal(L.tierFor(1, 250_000), "loyal", "big spenders count as loyal");
assert.equal(L.tierFor(5, 100_000), "vip");
assert.equal(L.isLapsing("loyal", new Date(Date.now() - 50 * 86_400_000).toISOString()), true);
assert.equal(L.isLapsing("new", new Date(Date.now() - 90 * 86_400_000).toISOString()), false);

const prods = await store.products();
const vip = { tier: "vip" as const, avgOrderNaira: 80_000, spentNaira: 400_000 };
assert.deepEqual(L.checkReward({ kind: "percent_off", value: 25 }, vip, prods).proposal, { kind: "percent_off", value: 10 }, "percent capped");
assert.deepEqual(L.checkReward({ kind: "amount_off", value: 50_000 }, vip, prods).proposal, { kind: "amount_off", value: 8_000 }, "amount capped at 10% of avg order");
assert.equal(L.checkReward({ kind: "gift", value: 0, giftVariantId: "v_bs_24" }, { ...vip, spentNaira: 100_000 }, prods).proposal.kind, "free_delivery", "too-expensive gift falls back");
assert.equal(L.checkReward({ kind: "gift", value: 0, giftVariantId: "v_bs_24" }, { ...vip, spentNaira: 600_000 }, prods).proposal.kind, "gift");
assert.equal(L.checkReward({ kind: "free_delivery", value: 0 }, { ...vip, tier: "unpaid" }, prods).ok, false, "no rewards before a paid order");
assert.equal(L.rewardDiscount({ kind: "percent_off", value: 10 }, 75_000, 3_500), 7_500);
assert.equal(L.rewardDiscount({ kind: "amount_off", value: 5_000 }, 3_000, 3_500), 3_000, "never more than the subtotal");
assert.equal(L.rewardDiscount({ kind: "free_delivery", value: 0 }, 75_000, 3_500), 3_500);

// The promise check blocks "discount" unless a tool actually applied a reward.
const { runChecks: runChecksL } = await import("@/agent/checks");
const promise = (rewardApplied: boolean) =>
  runChecksL({ reply: "You get 10% discount as a loyal customer!", groundedAmounts: [], orderRefs: [], escalated: false, appUrl: "http://localhost:3000", rewardApplied })
    .checks.find((c) => c.id === "no_unsupported_promises")!.ok;
assert.equal(promise(false), false);
assert.equal(promise(true), true);

// End to end: three paid orders make a loyal customer; a reward is applied on the next order and used up when paid.
const { getCustomers } = await import("@/loyalty/customers");
const { issueReward, applyRewardToOrder, RewardError } = await import("@/loyalty/rewards");
const loyalNo = "2348099990001";
for (const [k, daysAgo] of [40, 20, 5].entries()) {
  await store.addOrder({
    ref: `SA-LY${k}`, productId: "p_body_wave", variantId: "v_bw_18", quantity: 1, unitPriceNaira: 52_000, deliveryFeeNaira: 3_500, totalNaira: 55_500,
    city: "Lagos", customerHandle: loyalNo, customerName: "Ada Okafor", channel: k === 0 ? "facebook_comment" : "whatsapp", status: "paid",
    createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(), linkClicks: 1,
  });
}
const ada = (await getCustomers()).find((c) => c.handle === loyalNo)!;
assert.equal(ada.tier, "loyal");
assert.equal(ada.spentNaira, 166_500);
assert.deepEqual(ada.sources.sort(), ["facebook", "whatsapp"]);
assert.equal((await getCustomers({ source: "facebook" })).some((c) => c.handle === loyalNo), true, "filter by where they bought");

await assert.rejects(
  issueReward({ handle: loyalNo, proposal: { kind: "percent_off", value: 10 }, message: "Ada, you have spent ₦999,999 with us!", send: false }),
  RewardError,
  "invented amounts in the thank-you are blocked",
);
const issued = await issueReward({ handle: loyalNo, proposal: { kind: "percent_off", value: 10 }, message: "Ada, thank you for always choosing us!", send: false });
assert.match(issued.fullMessage, /10% off your next order/);
assert.match(issued.fullMessage, new RegExp(issued.reward.code));
assert.equal(issued.delivered, false);
assert.match(issued.waLink ?? "", /^https:\/\/wa\.me\/2348099990001\?text=/);
await assert.rejects(issueReward({ handle: loyalNo, proposal: { kind: "free_delivery", value: 0 }, message: "Thanks!", send: false }), RewardError, "one unused reward at a time");

const loyalOrder = await runTool("create_order_draft", JSON.stringify({ product_id: "p_bone_straight", variant_id: "v_bs_20", city: "Lagos" }), { channel: "whatsapp", customerHandle: loyalNo });
assert.ok(loyalOrder.ok);
const lo = loyalOrder.data as { order_ref: string; total: string; loyalty_reward?: { code: string; discount?: string } };
assert.equal(lo.loyalty_reward?.code, issued.reward.code);
assert.equal(lo.loyalty_reward?.discount, "₦7,500");
assert.match(lo.total, /71,000/, "75,000 + 3,500 − 7,500");
assert.ok(loyalOrder.groundedAmounts?.includes(7_500) && loyalOrder.groundedAmounts?.includes(71_000));
const stranger = await runTool("create_order_draft", JSON.stringify({ product_id: "p_bone_straight", variant_id: "v_bs_20", city: "Lagos" }), { channel: "whatsapp", customerHandle: "2348099990002" });
assert.equal((stranger.data as { loyalty_reward?: unknown }).loyalty_reward, undefined, "no reward for other customers");

await store.setOrderStatus(lo.order_ref, "paid");
const { rewardByCode } = await import("@/loyalty/rewards");
const used = await rewardByCode(issued.reward.code);
assert.equal(used?.status, "redeemed");
assert.equal(used?.redeemedOrderRef, lo.order_ref);
assert.equal((await getCustomers()).find((c) => c.handle === loyalNo)!.activeReward, undefined);

// A Facebook commenter who confirms on WhatsApp: their number becomes the customer, the Facebook name is kept,
// and an unused reward for that number applies at confirmation.
const bimboNo = "2348099990003";
for (const k of [0, 1]) {
  await store.addOrder({
    ref: `SA-BB${k}`, productId: "p_body_wave", variantId: "v_bw_18", quantity: 1, unitPriceNaira: 52_000, deliveryFeeNaira: 3_500, totalNaira: 55_500,
    customerHandle: bimboNo, channel: "whatsapp", status: "paid", createdAt: new Date(Date.now() - (k + 2) * 86_400_000).toISOString(), linkClicks: 1,
  });
}
await issueReward({ handle: bimboNo, proposal: { kind: "free_delivery", value: 0 }, message: "Thank you Bimbo!", send: false });
await store.addOrder({
  ref: "SA-FBC1", productId: "p_body_wave", variantId: "v_bw_18", quantity: 1, unitPriceNaira: 52_000, deliveryFeeNaira: 3_500, totalNaira: 55_500,
  customerHandle: "Bimbo Facebook", channel: "facebook_comment", status: "draft", createdAt: new Date().toISOString(), linkClicks: 0,
});
const fbConf = await store.confirmOrder("SA-FBC1", bimboNo, "Bimbo");
assert.equal(fbConf?.originHandle, "Bimbo Facebook");
assert.equal(fbConf?.customerHandle, bimboNo);
const applied = await applyRewardToOrder(fbConf!);
assert.equal(applied.order.discountNaira, 3_500, "free delivery at confirmation");
assert.equal(applied.order.totalNaira, 52_000);
assert.equal((await store.order("SA-FBC1"))?.totalNaira, 52_000);

// Reward suggestions: whatever the model proposes, the rules and checks in code have the last word.
process.env.MODEL_API_KEY ||= "offline-test"; // the client is created but the fake below answers instead
const { suggestRewards } = await import("@/loyalty/suggest");
const fake = (async () => ({
  data: {
    suggestions: [
      { handle: bimboNo, kind: "percent_off", value: 30, gift_variant_id: null, reason: "Two orders in a week", message: "Bimbo, thank you! You've spent ₦250,000 with us." },
      { handle: "not-a-customer", kind: "free_delivery", value: 0, reason: "x", message: "x" },
    ],
  },
  raw: "", attempts: 1,
})) as unknown as Parameters<typeof suggestRewards>[1] extends infer D ? D extends { complete: infer C } ? C : never : never;
await store.setOrderStatus("SA-FBC1", "cancelled"); // frees Bimbo's reward so we can test both paths
const { cancelReward } = await import("@/loyalty/rewards");
for (const r of (await getCustomers()).filter((c) => c.handle === bimboNo)) if (r.activeReward) await cancelReward(r.activeReward.code);
const sug = await suggestRewards([bimboNo, loyalNo], { complete: fake });
const sb = sug.suggestions.find((x) => x.customer.handle === bimboNo)!;
assert.deepEqual(sb.proposal, { kind: "percent_off", value: 10 }, "model asked for 30%, rules cap at 10%");
assert.match(sb.adjusted ?? "", /Capped/);
assert.equal(sb.checks.passed, false, "₦250,000 isn't what Bimbo spent, so the message is held");
assert.match(sb.preview, /10% off your next order/);
assert.ok(sug.skipped.some((x) => x.handle === loyalNo), "no suggestion returned for Ada → reported as skipped");

console.log("selftest: all checks passed");
