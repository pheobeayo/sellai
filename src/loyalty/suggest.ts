import { z } from "zod";
import type { CheckReport } from "@/agent/checks";
import { completeJSON, MODELS, meta } from "@/lib/meta";
import { store } from "@/store/store";
import { getCustomers, getLoyaltyRules, SOURCE_LABEL, type Customer } from "./customers";
import { allowedAmountsFor, checkLoyaltyMessage } from "./rewards";
import { checkReward, giftOptions, maxAmountOff, newRewardCode, rewardLine, TIER_LABEL, type RewardProposal } from "./rules";

/**
 * Muse Spark picks a fitting reward for each loyal customer and writes a short personal thank-you in their language.
 * Code decides what is allowed: the reward is checked against the rules, and the money line is fixed text,
 * so the model never states a discount or a price itself.
 */

const SuggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      handle: z.string(),
      kind: z.enum(["percent_off", "amount_off", "free_delivery", "gift"]),
      value: z.number().default(0),
      gift_variant_id: z.string().nullish(),
      reason: z.string().max(240).describe("One sentence for the vendor: why this reward suits this customer"),
      message: z.string().max(600).describe("Short personal thank-you to the customer, in their language, no amounts"),
    }),
  ),
});

const SYSTEM = `You help a small Nigerian online vendor thank and reward loyal customers.
For each customer you get their history and the reward options allowed for them. For each one:
1. Pick ONE reward from their allowed options. Fit it to the customer: a gift they'd like (related to their favourite product)
   for VIPs, free delivery or a small discount for others. A lapsing customer should get something that brings them back.
   Stay within the limits given; never exceed max_percent_off or max_amount_off_naira.
2. Write a warm, personal thank-you message of at most 40 words, in the customer's language (Pidgin if they write Pidgin,
   Yoruba if Yoruba, otherwise simple English). Use their first name, mention what they love buying, and speak as the business ("we").
   Do NOT mention the reward, any discount, any amount of money, prices, links or bank details: a fixed line describing the
   reward is added after your message automatically.
3. Give a one-sentence reason for the vendor.
Return ONLY JSON: {"suggestions":[{"handle","kind","value","gift_variant_id","reason","message"}]}
value is the percent for percent_off, the naira amount for amount_off, and 0 for free_delivery and gift.`;

export interface Suggestion {
  customer: Pick<Customer, "handle" | "name" | "tier" | "paidOrders" | "spentNaira" | "favouriteProduct" | "lapsing" | "canMessageNow" | "reachableOnWhatsApp" | "language">;
  proposal: RewardProposal;
  code: string;
  reason: string;
  message: string;
  /** Preview of what the customer receives: the personal message plus the fixed reward line. */
  preview: string;
  adjusted?: string;
  checks: CheckReport;
}

export interface SuggestResult {
  suggestions: Suggestion[];
  skipped: Array<{ handle: string; why: string }>;
  model: string;
}

const firstName = (n: string) => n.trim().split(/\s+/)[0];

/** `complete` is injectable so the selftest can run the guardrails without calling the model. */
export async function suggestRewards(handles?: string[], deps: { complete: typeof completeJSON } = { complete: completeJSON }): Promise<SuggestResult> {
  const all = await getCustomers();
  const rules = await getLoyaltyRules();
  const products = await store.products();

  const chosen = handles?.length
    ? all.filter((c) => handles.includes(c.handle))
    : all.filter((c) => (c.tier === "vip" || c.tier === "loyal" || c.tier === "returning") && !c.activeReward).slice(0, 8);
  const skipped: SuggestResult["skipped"] = [];
  const eligible = chosen.filter((c) => {
    if (c.tier === "unpaid") skipped.push({ handle: c.handle, why: `${c.name} hasn't paid for an order yet` });
    else if (c.activeReward) skipped.push({ handle: c.handle, why: `${c.name} already has reward ${c.activeReward.code}` });
    else return true;
    return false;
  });
  if (eligible.length === 0) return { suggestions: [], skipped, model: MODELS.agent };

  const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
  const now = Date.now();
  const input = eligible.map((c) => ({
    handle: c.handle,
    first_name: firstName(c.name),
    tier: TIER_LABEL[c.tier],
    paid_orders: c.paidOrders,
    total_spent: naira(c.spentNaira),
    favourite_product: c.favouriteProduct ?? "unknown",
    bought_through: c.sources.map((s) => SOURCE_LABEL[s]).join(", "),
    days_since_last_purchase: c.lastPaidAt ? Math.floor((now - Date.parse(c.lastPaidAt)) / 86_400_000) : null,
    lapsing: c.lapsing,
    language: c.language ?? "english",
    allowed: {
      max_percent_off: rules.maxPercentOff,
      max_amount_off_naira: maxAmountOff(c.avgOrderNaira, rules),
      free_delivery: true,
      gift_options: giftOptions(products, c.spentNaira, rules)
        .slice(0, 5)
        .map((g) => ({ gift_variant_id: g.variantId, item: g.label })),
    },
  }));

  const { data } = await deps.complete({
    client: meta(),
    model: MODELS.agent,
    system: SYSTEM,
    user: JSON.stringify({ customers: input }),
    schema: SuggestionSchema,
  });

  const expiresAt = new Date(now + rules.validDays * 86_400_000).toISOString();
  const suggestions: Suggestion[] = [];
  for (const c of eligible) {
    const s = data.suggestions.find((x) => x.handle === c.handle);
    if (!s) {
      skipped.push({ handle: c.handle, why: "No suggestion returned" });
      continue;
    }
    const verdict = checkReward({ kind: s.kind, value: s.value ?? 0, giftVariantId: s.gift_variant_id ?? undefined }, c, products, rules);
    const proposal = verdict.ok ? verdict.proposal : { kind: "free_delivery" as const, value: 0 };
    const code = newRewardCode();
    const message = s.message.trim();
    suggestions.push({
      customer: {
        handle: c.handle, name: c.name, tier: c.tier, paidOrders: c.paidOrders, spentNaira: c.spentNaira, favouriteProduct: c.favouriteProduct,
        lapsing: c.lapsing, canMessageNow: c.canMessageNow, reachableOnWhatsApp: c.reachableOnWhatsApp, language: c.language,
      },
      proposal,
      code,
      reason: s.reason,
      message,
      preview: `${message}\n\n${rewardLine({ ...proposal, code, expiresAt }, products)}`,
      adjusted: verdict.adjusted,
      checks: checkLoyaltyMessage(message, allowedAmountsFor(c, proposal)),
    });
  }
  return { suggestions, skipped, model: MODELS.agent };
}
