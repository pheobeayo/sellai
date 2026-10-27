import { z } from "zod";

export const INTENTS = [
  "ready_to_buy",
  "price_enquiry",
  "delivery_enquiry",
  "availability_or_variant",
  "product_question",
  "complaint",
  "casual_engagement",
  "spam_or_irrelevant",
] as const;
export type Intent = (typeof INTENTS)[number];

export const LANGUAGES = ["english", "pidgin", "yoruba", "igbo", "hausa", "mixed", "other"] as const;
export type Language = (typeof LANGUAGES)[number];

export const INTENT_GUIDE: Record<Intent, string> = {
  ready_to_buy: "Clear intent to purchase now: asks how to pay, order, wants account details, says they want to buy, names a quantity.",
  price_enquiry: "Asks the price or pushes back on price (HM, DM price, how much, elo ni, nawa ne, ego ole). No clear commitment yet.",
  delivery_enquiry: "Asks whether/where/how fast/how much delivery is.",
  availability_or_variant: "Asks about stock, length, size, colour or another variant.",
  product_question: "Asks about quality, material, durability, suitability or how to use the product.",
  complaint: "After-sales problem: payment made but item not received, defective item, refund. Always needs a human.",
  casual_engagement: "Compliments, emojis, jokes, tagging friends. No question that needs an answer.",
  spam_or_irrelevant: "Promotions, scams, follow-for-follow, unrelated content.",
};

/** Used to sort the inbox. Complaints go near the top because they hurt reputation if ignored. */
export const INTENT_PRIORITY: Record<Intent, number> = {
  ready_to_buy: 100,
  complaint: 90,
  price_enquiry: 80,
  delivery_enquiry: 75,
  availability_or_variant: 75,
  product_question: 60,
  casual_engagement: 10,
  spam_or_irrelevant: 0,
};

export const ClassificationSchema = z.object({
  id: z.string(),
  intent: z.enum(INTENTS),
  language: z.enum(LANGUAGES),
  product_hint: z.string().nullable().describe("Product, length, colour or variant mentioned, if any"),
  city: z.string().nullable().describe("City mentioned for delivery, if any"),
  english_gloss: z.string().describe("Short English translation/meaning of the comment"),
  confidence: z.number().min(0).max(1),
});
export type Classification = z.infer<typeof ClassificationSchema>;

export const BatchClassificationSchema = z.object({ results: z.array(ClassificationSchema) });
