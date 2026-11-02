import { runChecks, type CheckReport } from "@/agent/checks";
import { db } from "@/db/client";
import type { Order, Reward } from "@/domain/types";
import { appUrl } from "@/integrations/attribution";
import { sendWhatsAppText } from "@/integrations/whatsapp";
import { store } from "@/store/store";
import { activeRewards, getCustomers, getLoyaltyRules, toReward, type Customer } from "./customers";
import { checkReward, describeReward, newRewardCode, rewardDiscount, rewardLine, type RewardProposal } from "./rules";

export class RewardError extends Error {}

/**
 * Checks on the personal part of a loyalty message (the reward line is fixed text, so it isn't checked).
 * Same independent checks as sales replies: no invented ₦ figures, no bank details, no stray links.
 */
export function checkLoyaltyMessage(personal: string, allowedAmounts: number[]): CheckReport {
  const report = runChecks({
    reply: personal,
    groundedAmounts: allowedAmounts,
    orderRefs: [],
    escalated: false,
    appUrl: appUrl(),
    rewardApplied: true,
  });
  // Only the checks that make sense for a thank-you message.
  const keep = new Set(["amounts_grounded", "no_bank_details", "no_unsupported_promises", "links_valid", "length_ok"]);
  const checks = report.checks
    .filter((c) => keep.has(c.id))
    .map((c) => (c.id === "amounts_grounded" ? { ...c, label: "Every ₦ amount is from their real orders", detail: c.detail?.replace("Not from a tool", "Not in their history") } : c));
  return { checks, passed: checks.every((c) => c.ok || c.severity === "warn"), clean: checks.every((c) => c.ok) };
}

/** Amounts a thank-you message may mention: what the customer actually spent and the reward itself. */
export function allowedAmountsFor(c: Pick<Customer, "spentNaira" | "avgOrderNaira">, p: RewardProposal): number[] {
  return [c.spentNaira, c.avgOrderNaira, ...(p.kind === "amount_off" ? [p.value] : [])].filter((n) => n > 0);
}

export interface IssueInput {
  handle: string;
  proposal: RewardProposal;
  /** The personal thank-you (written by Muse Spark, possibly edited by the vendor). */
  message: string;
  reason?: string;
  code?: string;
  send: boolean;
}

export interface IssueResult {
  reward: Reward;
  fullMessage: string;
  adjusted?: string;
  delivered: boolean;
  /** Opens the vendor's own WhatsApp with the message filled in, when the API can't send it. */
  waLink?: string;
  note?: string;
}

export async function issueReward(input: IssueInput): Promise<IssueResult> {
  const customer = (await getCustomers()).find((c) => c.handle === input.handle);
  if (!customer) throw new RewardError("Customer not found");
  const { rows: open } = await (await db()).query(
    `select code from rewards where customer_handle=$1 and status='issued' and expires_at > now() limit 1`,
    [customer.handle],
  );
  if (open[0]) throw new RewardError(`${customer.name} already has an unused reward (${open[0].code}). Cancel it first.`);

  const rules = await getLoyaltyRules();
  const products = await store.products();
  const verdict = checkReward(input.proposal, customer, products, rules);
  if (!verdict.ok) throw new RewardError(verdict.adjusted ?? "Reward not allowed");

  const personal = input.message.trim();
  if (!personal) throw new RewardError("Message is empty");
  const report = checkLoyaltyMessage(personal, allowedAmountsFor(customer, verdict.proposal));
  if (!report.passed) {
    throw new RewardError(`Message held: ${report.checks.filter((c) => !c.ok && c.severity === "block").map((c) => `${c.label}${c.detail ? ` (${c.detail})` : ""}`).join("; ")}`);
  }

  const d = await db();
  const expiresAt = new Date(Date.now() + rules.validDays * 86_400_000).toISOString();
  let reward: Reward | undefined;
  for (let attempt = 0; attempt < 5 && !reward; attempt++) {
    const code = attempt === 0 && input.code ? input.code : newRewardCode();
    const { rows } = await d.query(
      `insert into rewards (code, customer_handle, customer_name, kind, value, gift_variant_id, reason, message, expires_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (code) do nothing returning *`,
      [code, customer.handle, customer.name, verdict.proposal.kind, verdict.proposal.value, verdict.proposal.giftVariantId ?? null, input.reason ?? null, personal, expiresAt],
    );
    if (rows[0]) reward = toReward(rows[0]);
  }
  if (!reward) throw new RewardError("Could not create a reward code, try again");

  const fullMessage = `${personal}\n\n${rewardLine(reward, products)}`;
  const waLink = customer.reachableOnWhatsApp ? `https://wa.me/${customer.handle}?text=${encodeURIComponent(fullMessage)}` : undefined;

  let delivered = false;
  let note: string | undefined;
  if (input.send && customer.canMessageNow && process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    await sendWhatsAppText(customer.handle, fullMessage);
    delivered = true;
    await d.query(`update rewards set sent_via='whatsapp_api' where code=$1`, [reward.code]);
  } else if (input.send) {
    note = !customer.reachableOnWhatsApp
      ? "No WhatsApp number for this customer yet. Copy the message and send it where you usually talk to them."
      : !customer.canMessageNow
        ? "WhatsApp only lets a business start a chat with an approved template, and this customer hasn't messaged in the last 24 hours. Open WhatsApp to send it from your own phone."
        : "WhatsApp API isn't configured. Open WhatsApp to send it yourself.";
  }

  return { reward: { ...reward, sentVia: delivered ? "whatsapp_api" : undefined }, fullMessage, adjusted: verdict.adjusted, delivered, waLink, note };
}

export async function listRewards(limit = 100): Promise<Reward[]> {
  const { rows } = await (await db()).query(`select * from rewards order by created_at desc limit $1`, [limit]);
  return rows.map(toReward);
}

export async function cancelReward(code: string): Promise<Reward | undefined> {
  const { rows } = await (await db()).query(`update rewards set status='cancelled' where code=$1 and status='issued' returning *`, [code]);
  return rows[0] ? toReward(rows[0]) : undefined;
}

export async function markRewardSent(code: string, via: string): Promise<void> {
  await (await db()).query(`update rewards set sent_via=$2 where code=$1`, [code, via]);
}

/**
 * Apply an unused reward to an order that doesn't have one yet. Used when a buyer who started on Facebook or
 * Instagram confirms on WhatsApp: only then do we know their number, and so whether they're a loyal customer.
 */
export async function applyRewardToOrder(order: Order): Promise<{ order: Order; reward?: Reward }> {
  if (order.rewardCode || !order.customerHandle || order.status === "paid" || order.status === "cancelled") return { order };
  const reward = (await activeRewards(order.customerHandle))[0];
  if (!reward) return { order };
  const subtotal = order.unitPriceNaira * order.quantity;
  const discount = rewardDiscount(reward, subtotal, order.deliveryFeeNaira);
  const total = subtotal + order.deliveryFeeNaira - discount;
  const { rows } = await (await db()).query(
    `update orders set reward_code=$2, discount_naira=$3, total_naira=$4 where ref=$1 and reward_code is null returning ref`,
    [order.ref, reward.code, discount, total],
  );
  if (!rows[0]) return { order };
  return { order: { ...order, rewardCode: reward.code, discountNaira: discount, totalNaira: total }, reward };
}

export async function rewardByCode(code: string): Promise<Reward | undefined> {
  const { rows } = await (await db()).query(`select * from rewards where code=$1`, [code]);
  return rows[0] ? toReward(rows[0]) : undefined;
}
