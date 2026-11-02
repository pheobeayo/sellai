import { db } from "@/db/client";
import type { Channel, Reward } from "@/domain/types";
import { store } from "@/store/store";
import { DEFAULT_RULES, isLapsing, tierFor, type LoyaltyRules, type Tier } from "./rules";

/**
 * Customers, built from confirmed and paid orders. A customer is identified by the handle on their orders:
 * once a buyer confirms on WhatsApp, that is their WhatsApp number, so someone who first commented on
 * Facebook and later ordered from an Instagram post is still one customer.
 */

export type Source = "facebook" | "instagram" | "whatsapp" | "other";

export const SOURCE_LABEL: Record<Source, string> = { facebook: "Facebook", instagram: "Instagram", whatsapp: "WhatsApp", other: "Other" };

export function sourceOf(channel: Channel | string): Source {
  if (channel === "facebook_comment") return "facebook";
  if (channel === "instagram_comment") return "instagram";
  if (channel === "whatsapp") return "whatsapp";
  return "other";
}

export interface Customer {
  handle: string;
  name: string;
  /** Where their purchases started, most common first. */
  sources: Source[];
  /** Earlier social names, e.g. the Facebook account that commented before confirming on WhatsApp. */
  alsoKnownAs: string[];
  paidOrders: number;
  unpaidOrders: number;
  spentNaira: number;
  avgOrderNaira: number;
  firstOrderAt: string;
  lastOrderAt: string;
  lastPaidAt?: string;
  favouriteProduct?: string;
  tier: Tier;
  lapsing: boolean;
  /** Last language they wrote in, if SellAI has seen a message from them. */
  language?: string;
  /** WhatsApp allows free-form messages only within 24 hours of the customer's last message. */
  lastInboundAt?: string;
  canMessageNow: boolean;
  /** A digits-only handle is a WhatsApp number we can reach. */
  reachableOnWhatsApp: boolean;
  activeReward?: Reward;
  isDemo: boolean;
}

type Row = Record<string, any>;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : undefined);

export function toReward(r: Row): Reward {
  return {
    code: r.code,
    customerHandle: r.customer_handle,
    customerName: r.customer_name ?? undefined,
    kind: r.kind,
    value: r.value,
    giftVariantId: r.gift_variant_id ?? undefined,
    reason: r.reason ?? undefined,
    message: r.message ?? undefined,
    status: r.status,
    createdAt: iso(r.created_at)!,
    expiresAt: iso(r.expires_at)!,
    redeemedOrderRef: r.redeemed_order_ref ?? undefined,
    sentVia: r.sent_via ?? undefined,
  };
}

export const isWhatsAppNumber = (h: string) => /^\d{8,15}$/.test(h);

export async function getLoyaltyRules(): Promise<LoyaltyRules> {
  return { ...DEFAULT_RULES, ...(await store.getSetting<Partial<LoyaltyRules>>("loyalty_rules", {})) };
}

/** Rewards that can still be used: issued, not expired, and not already attached to a live order. */
export async function activeRewards(handle?: string): Promise<Reward[]> {
  const { rows } = await (await db()).query(
    `select r.* from rewards r
     where r.status = 'issued' and r.expires_at > now() ${handle ? "and r.customer_handle = $1" : ""}
       and not exists (select 1 from orders o where o.reward_code = r.code and o.status in ('draft','confirmed','paid'))
     order by r.created_at desc`,
    handle ? [handle] : [],
  );
  return rows.map(toReward);
}

export async function getCustomers(opts: { source?: Source; now?: number } = {}): Promise<Customer[]> {
  const d = await db();
  const rules = await getLoyaltyRules();
  const now = opts.now ?? Date.now();

  const { rows: orders } = await d.query(
    `select o.*, p.name as product_name from orders o left join products p on p.id = o.product_id
     where o.status in ('confirmed','paid') and o.customer_handle is not null order by o.created_at`,
  );
  const handles = [...new Set(orders.map((o) => o.customer_handle as string))];
  if (handles.length === 0) return [];

  const { rows: msgs } = await d.query(
    `select author_handle, author_name, language, channel, received_at from enquiries
     where author_handle = any($1::text[]) order by received_at desc`,
    [handles],
  );
  const rewards = await activeRewards();

  const out: Customer[] = [];
  for (const handle of handles) {
    const mine = orders.filter((o) => o.customer_handle === handle);
    const paid = mine.filter((o) => o.status === "paid");
    const spent = paid.reduce((s, o) => s + o.total_naira, 0);
    const tier = tierFor(paid.length, spent, rules);
    const lastPaidAt = paid.length ? iso(paid[paid.length - 1].paid_at ?? paid[paid.length - 1].created_at) : undefined;

    const sourceCount = new Map<Source, number>();
    for (const o of mine) sourceCount.set(sourceOf(o.channel), (sourceCount.get(sourceOf(o.channel)) ?? 0) + 1);
    const productCount = new Map<string, number>();
    for (const o of mine) if (o.product_name) productCount.set(o.product_name, (productCount.get(o.product_name) ?? 0) + o.quantity);

    const theirMsgs = msgs.filter((m) => m.author_handle === handle);
    const lastInbound = theirMsgs.find((m) => m.channel === "whatsapp");
    const lastInboundAt = lastInbound ? iso(lastInbound.received_at) : undefined;
    const name =
      [...mine].reverse().find((o) => o.customer_name)?.customer_name ??
      theirMsgs.find((m) => m.author_name)?.author_name ??
      mine.find((o) => o.origin_handle)?.origin_handle ??
      handle;
    const reachable = isWhatsAppNumber(handle);

    out.push({
      handle,
      name,
      sources: [...sourceCount.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s),
      alsoKnownAs: [...new Set(mine.map((o) => o.origin_handle).filter((h): h is string => !!h && h !== name))],
      paidOrders: paid.length,
      unpaidOrders: mine.length - paid.length,
      spentNaira: spent,
      avgOrderNaira: paid.length ? Math.round(spent / paid.length) : 0,
      firstOrderAt: iso(mine[0].created_at)!,
      lastOrderAt: iso(mine[mine.length - 1].created_at)!,
      lastPaidAt,
      favouriteProduct: [...productCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0],
      tier,
      lapsing: isLapsing(tier, lastPaidAt, now, rules),
      language: theirMsgs.find((m) => m.language)?.language,
      lastInboundAt,
      canMessageNow: reachable && !!lastInboundAt && now - Date.parse(lastInboundAt) < 24 * 3_600_000,
      reachableOnWhatsApp: reachable,
      activeReward: rewards.find((r) => r.customerHandle === handle),
      isDemo: mine.every((o) => o.is_demo),
    });
  }

  const rank: Record<Tier, number> = { vip: 0, loyal: 1, returning: 2, new: 3, unpaid: 4 };
  return out
    .filter((c) => !opts.source || c.sources.includes(opts.source))
    .sort((a, b) => rank[a.tier] - rank[b.tier] || b.spentNaira - a.spentNaira);
}

export interface LoyaltySummary {
  customers: number;
  repeatCustomers: number;
  repeatRate: number;
  vip: number;
  loyal: number;
  lapsing: number;
  revenueNaira: number;
  repeatRevenueNaira: number;
  activeRewards: number;
}

export function summarise(cs: Customer[]): LoyaltySummary {
  const paying = cs.filter((c) => c.paidOrders > 0);
  const repeat = paying.filter((c) => c.paidOrders >= 2);
  return {
    customers: paying.length,
    repeatCustomers: repeat.length,
    repeatRate: paying.length ? Math.round((repeat.length / paying.length) * 100) : 0,
    vip: cs.filter((c) => c.tier === "vip").length,
    loyal: cs.filter((c) => c.tier === "loyal").length,
    lapsing: cs.filter((c) => c.lapsing).length,
    revenueNaira: paying.reduce((s, c) => s + c.spentNaira, 0),
    repeatRevenueNaira: repeat.reduce((s, c) => s + c.spentNaira, 0),
    activeRewards: cs.filter((c) => c.activeReward).length,
  };
}
