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
const pub = publishListing({ name: "Burgundy Bob Wig", category: "Wigs", description: "Short burgundy bob.", tags: ["bob", "burgundy"], variants: [{ label: "10 inches", priceNaira: 45000, stock: 3 }] });
const found = await runTool("search_catalogue", JSON.stringify({ query: "burgundy bob" }), ctx);
assert.equal((found.data as { matches: Array<{ product_id: string }> }).matches[0].product_id, pub.id);
assert.ok(found.groundedAmounts?.includes(45000));

console.log("selftest: all checks passed");
