import type { Product, Reward, RewardKind } from "@/domain/types";

/**
 * Loyalty rules, in code rather than in a prompt: tiers, what a reward may be worth, and how it is applied.
 * Muse Spark only suggests within these limits; anything outside them is rejected or adjusted here.
 */

export type Tier = "vip" | "loyal" | "returning" | "new" | "unpaid";

export const TIER_LABEL: Record<Tier, string> = {
  vip: "VIP",
  loyal: "Loyal",
  returning: "Returning",
  new: "New",
  unpaid: "Ordered, not paid",
};

export interface LoyaltyRules {
  /** Paid orders (or total spend) needed for each tier. */
  loyalOrders: number;
  vipOrders: number;
  loyalSpendNaira: number;
  vipSpendNaira: number;
  /** A loyal or VIP customer who hasn't paid for anything in this many days is "lapsing". */
  lapsingDays: number;
  /** Reward limits. */
  maxPercentOff: number;
  /** amount_off may be at most this share of the customer's average order, and never above maxAmountOffNaira. */
  maxAmountOffShare: number;
  maxAmountOffNaira: number;
  /** A gift may cost at most this share of what the customer has spent in total. */
  maxGiftShareOfSpend: number;
  validDays: number;
}

export const DEFAULT_RULES: LoyaltyRules = {
  loyalOrders: 3,
  vipOrders: 5,
  loyalSpendNaira: 200_000,
  vipSpendNaira: 400_000,
  lapsingDays: 45,
  maxPercentOff: 10,
  maxAmountOffShare: 0.1,
  maxAmountOffNaira: 20_000,
  maxGiftShareOfSpend: 0.2,
  validDays: 30,
};

export function tierFor(paidOrders: number, spentNaira: number, rules: LoyaltyRules = DEFAULT_RULES): Tier {
  if (paidOrders === 0) return "unpaid";
  if (paidOrders >= rules.vipOrders || spentNaira >= rules.vipSpendNaira) return "vip";
  if (paidOrders >= rules.loyalOrders || spentNaira >= rules.loyalSpendNaira) return "loyal";
  if (paidOrders >= 2) return "returning";
  return "new";
}

export function isLapsing(tier: Tier, lastPaidAt: string | undefined, now = Date.now(), rules: LoyaltyRules = DEFAULT_RULES): boolean {
  if ((tier !== "vip" && tier !== "loyal") || !lastPaidAt) return false;
  return now - Date.parse(lastPaidAt) > rules.lapsingDays * 86_400_000;
}

const round500 = (n: number) => Math.floor(n / 500) * 500;

export function maxAmountOff(avgOrderNaira: number, rules: LoyaltyRules = DEFAULT_RULES): number {
  return Math.max(0, Math.min(rules.maxAmountOffNaira, round500(avgOrderNaira * rules.maxAmountOffShare)));
}

export interface GiftOption {
  variantId: string;
  label: string;
  priceNaira: number;
}

/** In-stock variants cheap enough to be a gift for this customer. */
export function giftOptions(products: Product[], spentNaira: number, rules: LoyaltyRules = DEFAULT_RULES): GiftOption[] {
  const cap = spentNaira * rules.maxGiftShareOfSpend;
  return products
    .flatMap((p) => p.variants.map((v) => ({ variantId: v.id, label: `${p.name} (${v.label})`, priceNaira: v.priceNaira, stock: v.stock })))
    .filter((g) => g.stock > 0 && g.priceNaira <= cap)
    .sort((a, b) => a.priceNaira - b.priceNaira)
    .map(({ variantId, label, priceNaira }) => ({ variantId, label, priceNaira }));
}

export interface RewardProposal {
  kind: RewardKind;
  value: number;
  giftVariantId?: string;
}

export interface RewardCheck {
  ok: boolean;
  proposal: RewardProposal;
  /** Set when the proposal was outside the rules and has been changed. */
  adjusted?: string;
}

/**
 * Validate a proposed reward against the rules for this customer. Out-of-range values are clamped;
 * an impossible gift falls back to free delivery. Returns the reward that may actually be issued.
 */
export function checkReward(
  p: RewardProposal,
  customer: { tier: Tier; avgOrderNaira: number; spentNaira: number },
  products: Product[],
  rules: LoyaltyRules = DEFAULT_RULES,
): RewardCheck {
  if (customer.tier === "unpaid") return { ok: false, proposal: p, adjusted: "Rewards are for customers who have paid for at least one order." };
  switch (p.kind) {
    case "percent_off": {
      const v = Math.round(p.value);
      if (v < 1) return { ok: false, proposal: p, adjusted: "Discount must be at least 1%." };
      if (v > rules.maxPercentOff) return { ok: true, proposal: { kind: "percent_off", value: rules.maxPercentOff }, adjusted: `Capped at ${rules.maxPercentOff}% off.` };
      return { ok: true, proposal: { kind: "percent_off", value: v } };
    }
    case "amount_off": {
      const cap = maxAmountOff(customer.avgOrderNaira, rules);
      if (cap < 500) return { ok: true, proposal: { kind: "free_delivery", value: 0 }, adjusted: "Orders too small for a cash discount; changed to free delivery." };
      const v = round500(p.value);
      if (v < 500) return { ok: false, proposal: p, adjusted: "Amount off must be at least ₦500." };
      if (v > cap) return { ok: true, proposal: { kind: "amount_off", value: cap }, adjusted: `Capped at ₦${cap.toLocaleString("en-NG")} (10% of their average order).` };
      return { ok: true, proposal: { kind: "amount_off", value: v } };
    }
    case "free_delivery":
      return { ok: true, proposal: { kind: "free_delivery", value: 0 } };
    case "gift": {
      const allowed = giftOptions(products, customer.spentNaira, rules);
      if (p.giftVariantId && allowed.some((g) => g.variantId === p.giftVariantId)) return { ok: true, proposal: { kind: "gift", value: 0, giftVariantId: p.giftVariantId } };
      return { ok: true, proposal: { kind: "free_delivery", value: 0 }, adjusted: "That gift isn't in stock or costs too much for this customer; changed to free delivery." };
    }
  }
}

/** How much a reward takes off an order. Gifts don't change the total. */
export function rewardDiscount(r: Pick<Reward, "kind" | "value">, subtotalNaira: number, deliveryFeeNaira: number): number {
  switch (r.kind) {
    case "percent_off":
      return Math.round((subtotalNaira * r.value) / 100);
    case "amount_off":
      return Math.min(r.value, subtotalNaira);
    case "free_delivery":
      return deliveryFeeNaira;
    case "gift":
      return 0;
  }
}

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

/** Plain-English description used in messages and the UI. Every figure comes from the reward itself. */
export function describeReward(r: Pick<Reward, "kind" | "value" | "giftVariantId">, products: Product[]): string {
  switch (r.kind) {
    case "percent_off":
      return `${r.value}% off your next order`;
    case "amount_off":
      return `${naira(r.value)} off your next order`;
    case "free_delivery":
      return "free delivery on your next order";
    case "gift": {
      const g = products.flatMap((p) => p.variants.map((v) => ({ id: v.id, label: `${p.name} (${v.label})` }))).find((x) => x.id === r.giftVariantId);
      return `a free ${g?.label ?? "gift"} with your next order`;
    }
  }
}

export function newRewardCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `THX-${s}`;
}

/** The fixed reward line appended to every loyalty message: the AI never writes the money part. */
export function rewardLine(r: Pick<Reward, "kind" | "value" | "giftVariantId" | "code" | "expiresAt">, products: Product[]): string {
  const until = new Date(r.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  return `🎁 Your reward: ${describeReward(r, products)}. It's applied automatically when you order with us on WhatsApp (ref ${r.code}), valid until ${until}.`;
}
