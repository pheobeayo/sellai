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
  segment_phrase: z.string().min(2).max(40).describe("Short noun phrase naming the product for segmentation, e.g. 'wig', 'handbag'"),
  colour: z.string(),
  style: z.string().describe("Visible style, e.g. 'bone straight', 'body wave', 'pixie cut', 'tote'"),
  tags: z.array(z.string()).min(2).max(10).describe("Lowercase search words customers might type, incl. Nigerian terms"),
  description: z.string().max(400).describe("1-2 sentences of VISIBLE facts only. No claims about material, origin or durability."),
  confirm_with_vendor: z.array(z.string()).describe("Facts the photo can't prove that customers will ask about"),
  suggested_variant_labels: z.array(z.string()).max(6).describe("Likely variant labels, e.g. lengths or sizes. Labels only, never prices."),
  caption: z.string().max(220).describe("A short, friendly social caption for reposting, no prices"),
});
export type ProductDraft = z.infer<typeof ProductDraftSchema>;

const SYSTEM = `You help a small Nigerian online vendor turn a product photo into a catalogue listing.
Describe ONLY what is visible in the photo. Never state prices, stock, material, hair origin,
brand or durability as fact; put those in confirm_with_vendor instead.
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
  return data;
}
