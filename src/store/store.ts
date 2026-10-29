import { db } from "@/db/client";
import type {
  Channel,
  DeliveryZone,
  DraftMeta,
  Enquiry,
  EnquiryRecord,
  EnquiryStatus,
  Order,
  OrderStatus,
  Post,
  Product,
  Vendor,
} from "@/domain/types";
import { seedDeliveryZones, seedVendor } from "./seed";

/**
 * Data access for the whole app. Backed by Postgres (Supabase) or PGlite, see src/db/client.ts.
 * Vendor profile and delivery zones are config for this single-vendor build, so they stay synchronous.
 */

type Row = Record<string, any>;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : undefined);
const opt = <T>(v: T | null | undefined) => (v === null ? undefined : v);

function toOrder(r: Row): Order {
  return {
    ref: r.ref,
    productId: r.product_id,
    variantId: r.variant_id,
    quantity: r.quantity,
    unitPriceNaira: r.unit_price_naira,
    deliveryFeeNaira: r.delivery_fee_naira,
    totalNaira: r.total_naira,
    city: opt(r.city),
    customerHandle: opt(r.customer_handle),
    channel: r.channel,
    sourcePostId: opt(r.source_post_id),
    sourceEnquiryId: opt(r.source_enquiry_id),
    status: r.status,
    createdAt: iso(r.created_at)!,
    linkClicks: r.link_clicks,
    firstClickedAt: iso(r.first_clicked_at),
    confirmedAt: iso(r.confirmed_at),
    paidAt: iso(r.paid_at),
    isDemo: r.is_demo,
  };
}

function toEnquiry(r: Row): EnquiryRecord {
  return {
    id: r.id,
    channel: r.channel,
    text: r.text,
    authorHandle: opt(r.author_handle),
    authorName: opt(r.author_name),
    postId: opt(r.post_id),
    receivedAt: iso(r.received_at)!,
    transcribedFromVoice: r.transcribed_from_voice,
    isDemo: r.is_demo,
    intent: opt(r.intent),
    language: opt(r.language),
    englishGloss: opt(r.english_gloss),
    confidence: opt(r.confidence),
    priority: r.priority,
    status: r.status,
    draftReply: opt(r.draft_reply),
    draftMeta: opt(r.draft_meta) as DraftMeta | undefined,
    replyText: opt(r.reply_text),
    repliedAt: iso(r.replied_at),
    orderRef: opt(r.order_ref),
  };
}

const toPost = (r: Row): Post => ({ id: r.id, channel: r.channel, caption: r.caption, productIds: r.product_ids, postedAt: iso(r.posted_at)! });

export const store = {
  // ── config ────────────────────────────────────────────────────────────
  vendor(): Vendor {
    return seedVendor;
  },
  deliveryZones(): DeliveryZone[] {
    return seedDeliveryZones;
  },

  // ── catalogue ─────────────────────────────────────────────────────────
  async products(): Promise<Product[]> {
    const d = await db();
    const { rows: ps } = await d.query("select * from products order by created_at, id");
    const { rows: vs } = await d.query("select * from variants order by product_id, position, id");
    return ps.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      tags: p.tags,
      imageUrl: opt(p.image_url),
      imageIsAiEnhanced: p.image_is_ai_enhanced,
      variants: vs
        .filter((v) => v.product_id === p.id)
        .map((v) => ({ id: v.id, label: v.label, priceNaira: v.price_naira, stock: v.stock })),
    }));
  },

  async product(id: string): Promise<Product | undefined> {
    return (await store.products()).find((p) => p.id === id);
  },

  async addProduct(p: Product): Promise<void> {
    const d = await db();
    const ins = await d.query(
      `insert into products (id, name, description, category, tags, image_url, image_is_ai_enhanced)
       values ($1,$2,$3,$4,$5,$6,$7) on conflict (id) do nothing`,
      [p.id, p.name, p.description, p.category, p.tags, p.imageUrl ?? null, p.imageIsAiEnhanced ?? false],
    );
    if (ins.rowCount === 0) throw new Error(`Product ${p.id} already exists`);
    for (const [i, v] of p.variants.entries()) {
      await d.query(`insert into variants (id, product_id, label, price_naira, stock, position) values ($1,$2,$3,$4,$5,$6)`, [
        v.id, p.id, v.label, v.priceNaira, v.stock, i,
      ]);
    }
  },

  // ── posts ─────────────────────────────────────────────────────────────
  async posts(): Promise<Post[]> {
    const { rows } = await (await db()).query("select * from posts order by posted_at desc");
    return rows.map(toPost);
  },

  async post(id: string): Promise<Post | undefined> {
    const { rows } = await (await db()).query("select * from posts where id = $1", [id]);
    return rows[0] ? toPost(rows[0]) : undefined;
  },

  /** Comments can arrive on posts SellAI hasn't seen yet; record them so the dashboard can group by post. */
  async ensurePost(id: string, channel: Channel): Promise<void> {
    await (await db()).query(`insert into posts (id, channel) values ($1,$2) on conflict (id) do nothing`, [id, channel]);
  },

  // ── enquiries ─────────────────────────────────────────────────────────
  /** Returns false if the enquiry already exists: Meta retries webhooks, so inserts must be idempotent. */
  async addEnquiry(e: Enquiry): Promise<boolean> {
    if (e.postId) await store.ensurePost(e.postId, e.channel);
    const r = await (await db()).query(
      `insert into enquiries (id, channel, text, author_handle, author_name, post_id, received_at, transcribed_from_voice, is_demo)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (id) do nothing`,
      [e.id, e.channel, e.text, e.authorHandle ?? null, e.authorName ?? null, e.postId ?? null, e.receivedAt, e.transcribedFromVoice ?? false, e.isDemo ?? false],
    );
    return r.rowCount > 0;
  },

  async enquiry(id: string): Promise<EnquiryRecord | undefined> {
    const { rows } = await (await db()).query("select * from enquiries where id = $1", [id]);
    return rows[0] ? toEnquiry(rows[0]) : undefined;
  },

  /**
   * Earlier messages from the same customer on the same channel, oldest first.
   * WhatsApp allows free-form replies within 24 hours of the customer's last message,
   * so a 24-hour window is also a natural "this conversation" boundary.
   */
  async conversationBefore(e: { id: string; channel: string; authorHandle?: string; receivedAt: string }, limit = 6, windowHours = 24): Promise<EnquiryRecord[]> {
    if (!e.authorHandle) return [];
    const { rows } = await (await db()).query(
      `select * from (
         select * from enquiries
         where channel = $1 and author_handle = $2 and id <> $3
           and received_at <= $4 and received_at >= ($4::timestamptz - ($5 || ' hours')::interval)
         order by received_at desc limit $6
       ) recent order by received_at asc`,
      [e.channel, e.authorHandle, e.id, e.receivedAt, String(windowHours), limit],
    );
    return rows.map(toEnquiry);
  },

  async enquiries(limit = 200): Promise<EnquiryRecord[]> {
    const { rows } = await (await db()).query("select * from enquiries order by received_at desc limit $1", [limit]);
    return rows.map(toEnquiry);
  },

  async saveTriage(
    id: string,
    t: { intent: string; language: string; englishGloss: string; confidence: number; priority: number; status?: EnquiryStatus },
  ): Promise<void> {
    await (await db()).query(
      `update enquiries set intent=$2, language=$3, english_gloss=$4, confidence=$5, priority=$6, status=coalesce($7, status) where id=$1`,
      [id, t.intent, t.language, t.englishGloss, t.confidence, t.priority, t.status ?? null],
    );
  },

  async saveDraft(id: string, draftReply: string, meta: DraftMeta, status: EnquiryStatus = "drafted"): Promise<void> {
    await (await db()).query(`update enquiries set draft_reply=$2, draft_meta=$3::jsonb, status=$4 where id=$1`, [
      id, draftReply, JSON.stringify(meta), status,
    ]);
  },

  async markReplied(id: string, replyText: string): Promise<void> {
    await (await db()).query(`update enquiries set reply_text=$2, replied_at=now(), status='replied' where id=$1`, [id, replyText]);
  },

  async setEnquiryStatus(id: string, status: EnquiryStatus): Promise<void> {
    await (await db()).query(`update enquiries set status=$2 where id=$1`, [id, status]);
  },

  /** Link a message to an order; a message with no post of its own inherits the order's post, so the dashboard credits the right post. */
  /** A follow-up message without its own post inherits the conversation's post, so its order credits the right post. */
  async setEnquiryPost(id: string, postId: string): Promise<void> {
    await (await db()).query(`update enquiries set post_id = coalesce(post_id, $2) where id = $1`, [id, postId]);
  },

  async linkEnquiryToOrder(id: string, ref: string): Promise<void> {
    await (await db()).query(
      `update enquiries e set order_ref = $2, post_id = coalesce(e.post_id, o.source_post_id) from orders o where e.id = $1 and o.ref = $2`,
      [id, ref],
    );
  },

  // ── orders ────────────────────────────────────────────────────────────
  async addOrder(o: Order): Promise<void> {
    await (await db()).query(
      `insert into orders (ref, product_id, variant_id, quantity, unit_price_naira, delivery_fee_naira, total_naira, city,
         customer_handle, channel, source_post_id, source_enquiry_id, status, created_at, is_demo)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        o.ref, o.productId, o.variantId, o.quantity, o.unitPriceNaira, o.deliveryFeeNaira, o.totalNaira, o.city ?? null,
        o.customerHandle ?? null, o.channel, o.sourcePostId ?? null, o.sourceEnquiryId ?? null, o.status, o.createdAt, o.isDemo ?? false,
      ],
    );
  },

  async order(ref: string): Promise<Order | undefined> {
    const { rows } = await (await db()).query("select * from orders where ref = $1", [ref]);
    return rows[0] ? toOrder(rows[0]) : undefined;
  },

  async orders(limit = 200): Promise<Order[]> {
    const { rows } = await (await db()).query("select * from orders order by created_at desc limit $1", [limit]);
    return rows.map(toOrder);
  },

  /** Records a checkout-link click. Returns the updated order, or undefined if the ref is unknown. */
  async recordClick(ref: string): Promise<Order | undefined> {
    const { rows } = await (await db()).query(
      `update orders set link_clicks = link_clicks + 1, first_clicked_at = coalesce(first_clicked_at, now()) where ref = $1 returning *`,
      [ref],
    );
    return rows[0] ? toOrder(rows[0]) : undefined;
  },

  /** The buyer messaged the order ref on WhatsApp. Only moves draft → confirmed. */
  async confirmOrder(ref: string, customerHandle?: string): Promise<Order | undefined> {
    const { rows } = await (await db()).query(
      `update orders set status='confirmed', confirmed_at=coalesce(confirmed_at, now()), customer_handle=coalesce($2, customer_handle)
       where ref=$1 and status='draft' returning *`,
      [ref, customerHandle ?? null],
    );
    return rows[0] ? toOrder(rows[0]) : undefined;
  },

  /**
   * Vendor actions. Marking paid deducts stock (never below zero); a paid order can't be cancelled here.
   * Returns the updated order and any warning for the vendor.
   */
  async setOrderStatus(ref: string, status: Extract<OrderStatus, "paid" | "cancelled">): Promise<{ order?: Order; warning?: string }> {
    const d = await db();
    const current = await store.order(ref);
    if (!current) return { warning: "Order not found" };
    if (current.status === "paid") return { order: current, warning: status === "paid" ? "Already marked paid" : "Paid orders can't be cancelled here" };
    if (current.status === "cancelled") return { order: current, warning: "Order is cancelled" };

    if (status === "cancelled") {
      const { rows } = await d.query(`update orders set status='cancelled' where ref=$1 returning *`, [ref]);
      return { order: toOrder(rows[0]) };
    }

    const { rows } = await d.query(`update orders set status='paid', paid_at=now(), confirmed_at=coalesce(confirmed_at, now()) where ref=$1 returning *`, [ref]);
    const { rows: before } = await d.query<{ stock: number }>(`select stock from variants where id = $1`, [current.variantId]);
    await d.query(`update variants set stock = greatest(stock - $2, 0) where id = $1`, [current.variantId, current.quantity]);
    const had = before[0]?.stock;
    const warning = had !== undefined && had < current.quantity ? `Stock was only ${had}; it is now 0. Check your inventory.` : undefined;
    return { order: toOrder(rows[0]), warning };
  },
};

export type Store = typeof store;
