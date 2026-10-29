import "dotenv/config";
import { db } from "@/db/client";
import { INTENT_PRIORITY, type Intent } from "@/agent/intents";
import type { Order } from "@/domain/types";
import { newOrderRef } from "@/integrations/attribution";
import { store } from "@/store/store";

/**
 * Fills the database the app uses (Supabase if DATABASE_URL is set, else .data/pglite) with a week of
 * DEMO activity so the dashboard has something to show while you build. Every row is flagged is_demo,
 * and the dashboard shows a "includes demo data" banner while any exist.
 *
 *   npm run seed:demo           add demo data
 *   npm run seed:demo -- --clear  remove all demo rows (do this before recording with real data)
 *
 * No model calls: triage labels are set directly, so this costs nothing.
 */

const d = await db();

if (process.argv.includes("--clear")) {
  const e = await d.query("delete from enquiries where is_demo");
  const o = await d.query("delete from orders where is_demo");
  console.log(`Removed ${e.rowCount} demo enquiries and ${o.rowCount} demo orders.`);
  process.exit(0);
}

// Deterministic pseudo-random so every run produces the same story.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

const COMMENTS: Record<Intent, string[]> = {
  ready_to_buy: ["I wan buy am, how I go pay?", "Pls I need this in 20 inches", "How do I order?", "Book me one, I'm in Wuse"],
  price_enquiry: ["HM?", "Price pls", "abeg how much be this one", "Elo ni?", "DM price"],
  delivery_enquiry: ["Una dey deliver Ibadan?", "Do you deliver to Lagos?", "Delivery to PH na how much?"],
  availability_or_variant: ["E dey for 26 inches?", "Is the 24 inches still available?", "Una get am for brown?"],
  product_question: ["Is it human hair?", "Can I dye it blonde?", "Does it shed?"],
  complaint: ["I paid since Monday, my wig never reach o"],
  casual_engagement: ["Beautiful 😍", "Omo this one fine o 🔥", "@tolu_b see this one"],
  spam_or_irrelevant: ["Follow back pls", "Check my page for cheap iPhones"],
};

/**
 * The story the demo tells: the product-demo video brings fewer comments than the price post,
 * but far more of them turn into paid orders.
 */
const PLAN = [
  { postId: "post_ig_bs01", productId: "p_bone_straight", variantId: "v_bs_24", enquiries: 26, buyerShare: 0.55, orders: 7, clicked: 6, confirmed: 5, paid: 4 },
  { postId: "post_fb_bw01", productId: "p_body_wave", variantId: "v_bw_18", enquiries: 41, buyerShare: 0.35, orders: 5, clicked: 3, confirmed: 2, paid: 1 },
  { postId: "post_ig_px01", productId: "p_pixie_burgundy", variantId: "v_px_std", enquiries: 14, buyerShare: 0.3, orders: 2, clicked: 1, confirmed: 0, paid: 0 },
];

const products = await store.products();
const now = Date.now();
let enquiriesAdded = 0;
let ordersAdded = 0;

for (const plan of PLAN) {
  const product = products.find((p) => p.id === plan.productId);
  const variant = product?.variants.find((v) => v.id === plan.variantId);
  if (!product || !variant) {
    console.warn(`Skipping ${plan.postId}: seed product ${plan.productId} not found`);
    continue;
  }

  for (let i = 0; i < plan.enquiries; i++) {
    const buying = rand() < plan.buyerShare;
    const intent: Intent = buying
      ? pick(["ready_to_buy", "price_enquiry", "delivery_enquiry", "availability_or_variant"] as const)
      : pick(["casual_engagement", "casual_engagement", "product_question", "spam_or_irrelevant"] as const);
    const receivedAt = new Date(now - rand() * 7 * 86_400_000);
    const id = `demo_${plan.postId}_${i}`;
    const inserted = await store.addEnquiry({
      id, channel: "instagram_comment", text: pick(COMMENTS[intent]), authorHandle: `demo_user_${Math.floor(rand() * 900 + 100)}`,
      postId: plan.postId, receivedAt: receivedAt.toISOString(), isDemo: true,
    });
    if (!inserted) continue;
    enquiriesAdded++;
    const needsReply = !["casual_engagement", "spam_or_irrelevant"].includes(intent);
    await store.saveTriage(id, { intent, language: "pidgin", englishGloss: "(demo data)", confidence: 0.9, priority: INTENT_PRIORITY[intent], status: needsReply ? "new" : "ignored" });
    if (needsReply && rand() < 0.8) {
      // Replied within 2–25 minutes
      await d.query(`update enquiries set status='replied', reply_text='(demo reply)', replied_at = received_at + ($2 || ' minutes')::interval where id=$1`, [
        id, String(Math.round(2 + rand() * 23)),
      ]);
    }
  }

  for (let i = 0; i < plan.orders; i++) {
    const city = pick(store.deliveryZones());
    const createdAt = new Date(now - rand() * 6 * 86_400_000);
    const order: Order = {
      ref: newOrderRef(), productId: product.id, variantId: variant.id, quantity: 1,
      unitPriceNaira: variant.priceNaira, deliveryFeeNaira: city.feeNaira, totalNaira: variant.priceNaira + city.feeNaira,
      city: city.city, channel: "instagram_comment", sourcePostId: plan.postId,
      status: i < plan.paid ? "paid" : i < plan.confirmed ? "confirmed" : "draft",
      createdAt: createdAt.toISOString(), linkClicks: 0, isDemo: true,
    };
    await store.addOrder(order);
    if (i < plan.clicked) await d.query(`update orders set link_clicks = 1, first_clicked_at = created_at + interval '3 minutes' where ref=$1`, [order.ref]);
    if (order.status !== "draft") await d.query(`update orders set confirmed_at = created_at + interval '6 minutes' where ref=$1`, [order.ref]);
    if (order.status === "paid") await d.query(`update orders set paid_at = created_at + interval '2 hours' where ref=$1`, [order.ref]);
    ordersAdded++;
  }
}

console.log(`Added ${enquiriesAdded} demo enquiries and ${ordersAdded} demo orders (${d.kind}).`);
console.log("Open /dashboard. Remove them later with: npm run seed:demo -- --clear");
