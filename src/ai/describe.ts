import { z } from "zod";
import { completeJSON, MODELS, meta } from "@/lib/meta";

/**
 * Muse Spark vision: look at the vendor's photo and draft a catalogue entry.
 * It describes only what is visible. Anything a photo can't prove (human vs synthetic hair,
 * exact length, brand) goes into `confirm_with_vendor` instead of the description.
 */

export const ProductDraftSchema = z.object({
  name: z.string().min(2).describe("Short product name a Nigerian vendor would use, e.g. 'Burgundy Bob Wig'"),
  category: z.string().describe("e.g. wigs, bags, shoes, clothing, skincare"),
  segment_phrase: z.string().min(2).max(80).describe("1-3 word noun naming the product for segmentation, e.g. 'wig', 'handbag', 'sneakers'"),
  colour: z.string(),
  style: z.string().describe("Visible style, e.g. 'bone straight', 'body wave', 'pixie cut', 'tote'"),
  tags: z.array(z.string()).min(2).max(10).describe("Lowercase search words customers might type, incl. Nigerian terms"),
  description: z.string().max(600).describe("1-2 sentences about the PRODUCT's visible features only. Never the model, person, clothing, setting or background."),
  confirm_with_vendor: z.array(z.string()).describe("Facts the photo can't prove that customers will ask about"),
  suggested_variant_labels: z.array(z.string()).max(8).describe("Short option labels like '10 inches', '12 inches', 'Size 40', or ['Standard'] if none. Never sentences, never prices."),
  caption: z.string().max(220).describe("A short, friendly social caption for reposting, no prices"),
});
export type ProductDraft = z.infer<typeof ProductDraftSchema>;

const SYSTEM = `You help a small Nigerian online vendor turn a product photo into a catalogue listing.
Describe ONLY the product and only what is visible. If a model wears it, describe the product, never the
person, their clothing, pose or the background. Never state prices, stock, material, hair origin,
brand or durability as fact; put those in confirm_with_vendor instead (the vendor enters price and stock separately).
segment_phrase must be the bare product noun (1-3 words), e.g. "wig", "handbag", "sneakers", "gown".
suggested_variant_labels are short option names, e.g. "10 inches", "12 inches", or ["Standard"].
Return ONLY JSON with keys: name, category, segment_phrase, colour, style, tags, description,
confirm_with_vendor, suggested_variant_labels, caption.`;

export async function describeProduct(imageDataUrl: string, vendorHint?: string): Promise<ProductDraft> {
  const { data } = await completeJSON({
    client: meta(),
    model: MODELS.agent,
    system: SYSTEM,
    schema: ProductDraftSchema,
    user: [
      { type: "text", text: vendorHint ? `Vendor's note about this photo: "${vendorHint}"` : "Draft a listing for this product photo." },
      { type: "image_url", image_url: { url: imageDataUrl } },
    ],
  });
  return tidyDraft(data);
}

const STOP = /\b(for|with|wanting|look|style|women|men|people|who|that|a|an|the)\b/i;

/** Keep the model's output usable even when it ignores the format rules. */
export function tidyDraft(d: ProductDraft): ProductDraft {
  const fallbackNoun = d.category.trim().toLowerCase().replace(/s$/, "") || "product";
  const words = d.segment_phrase.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const segment_phrase = words.length && words.length <= 3 && !STOP.test(words.join(" ")) ? words.join(" ") : fallbackNoun;

  const labels = d.suggested_variant_labels
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l.length <= 24 && !/confirm|other|as pictured|-/i.test(l));
  const confirm = d.confirm_with_vendor.filter((c) => !/^\s*(price|stock|stock availability|availability)\s*$/i.test(c));

  return { ...d, segment_phrase, suggested_variant_labels: labels.length ? labels : ["Standard"], confirm_with_vendor: confirm };
}
