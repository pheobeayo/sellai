import { randomBytes } from "node:crypto";
import { describeProduct, type ProductDraft } from "@/ai/describe";
import { cropToBox, cutoutWithMask, normalisePhoto, toDataUrl } from "@/ai/image-utils";
import { enhanceProductImage, IMAGE_MODEL } from "@/ai/product-image";
import { SAM_MODEL, segment } from "@/ai/segment";
import type { Product } from "@/domain/types";
import { MODELS } from "@/lib/meta";
import { store } from "@/store/store";

/**
 * Photo → catalogue listing, in four model steps:
 *   1. Muse Spark (vision)  describes what's visible and names the product
 *   2. SAM 3.1              finds the product in the photo (box + mask)
 *   3. sharp                cuts it out using the mask
 *   4. Muse Image 1.0       turns the cut-out into a clean catalogue shot
 * Prices and stock are never generated: the vendor enters them before publishing.
 */

export interface PipelineStep {
  step: string;
  model?: string;
  ms: number;
  ok: boolean;
  note?: string;
}

export interface ListingDraft {
  draft: ProductDraft;
  images: { original: string; cutout?: string; enhanced?: string };
  segmentation: { objectsFound: number; usedObject?: string; confidence?: number };
  steps: PipelineStep[];
  warnings: string[];
}

async function timed<T>(steps: PipelineStep[], step: string, model: string | undefined, fn: () => Promise<T>): Promise<T> {
  const t = Date.now();
  try {
    const out = await fn();
    steps.push({ step, model, ms: Date.now() - t, ok: true });
    return out;
  } catch (e) {
    steps.push({ step, model, ms: Date.now() - t, ok: false, note: (e as Error).message });
    throw e;
  }
}

export async function draftListingFromPhoto(photo: Buffer, opts: { hint?: string; enhance?: boolean } = {}): Promise<ListingDraft> {
  const steps: PipelineStep[] = [];
  const warnings: string[] = [];

  const { png, width, height } = await timed(steps, "normalise photo", undefined, () => normalisePhoto(photo));
  const originalUrl = toDataUrl(png);

  const draft = await timed(steps, "describe product", MODELS.agent, () => describeProduct(originalUrl, opts.hint));

  // SAM: segment the product. If it fails or finds nothing, carry on with the full photo.
  let cutout: Buffer | undefined;
  const segmentation: ListingDraft["segmentation"] = { objectsFound: 0 };
  try {
    const seg = await timed(steps, `segment "${draft.segment_phrase}"`, SAM_MODEL, () => segment(originalUrl, draft.segment_phrase));
    segmentation.objectsFound = seg.objects.length;
    if (seg.diagnostics.length) warnings.push(`SAM output notes: ${seg.diagnostics.join("; ")}`);
    const best = seg.objects[0]; // largest by mask area
    if (best) {
      segmentation.usedObject = best.objectId;
      segmentation.confidence = best.confidence;
      cutout = await timed(steps, "cut out product", undefined, () =>
        best.mask
          ? cutoutWithMask(png, width, height, best.mask.bounds, best.mask.raster, best.mask.width, best.mask.height)
          : cropToBox(png, width, height, best.box),
      );
      if (seg.objects.length > 1) warnings.push(`SAM found ${seg.objects.length} "${draft.segment_phrase}" objects; used the largest.`);
    } else {
      warnings.push(`SAM found no "${draft.segment_phrase}" in the photo; using the full photo.`);
    }
  } catch (e) {
    warnings.push(`Segmentation failed (${(e as Error).message}); using the full photo.`);
  }

  // Muse Image: clean catalogue shot from the cut-out (or the full photo).
  let enhancedUrl: string | undefined;
  if (opts.enhance !== false) {
    try {
      const { image, mime } = await timed(steps, "studio product shot", IMAGE_MODEL, () =>
        enhanceProductImage(cutout ?? png, draft.name, draft.colour),
      );
      enhancedUrl = toDataUrl(image, mime);
    } catch (e) {
      warnings.push(`Image enhancement failed (${(e as Error).message}); you can publish with the cut-out or original.`);
    }
  }

  return {
    draft,
    images: { original: originalUrl, cutout: cutout ? toDataUrl(cutout) : undefined, enhanced: enhancedUrl },
    segmentation,
    steps,
    warnings,
  };
}

export interface PublishInput {
  name: string;
  category: string;
  description: string;
  tags: string[];
  variants: Array<{ label: string; priceNaira: number; stock: number }>;
  imageUrl?: string;
  imageIsAiEnhanced?: boolean;
}

/** The vendor confirms prices, stock and wording; the product then becomes sellable by the agent immediately. */
export async function publishListing(input: PublishInput): Promise<Product> {
  if (input.variants.length === 0) throw new Error("Add at least one variant with a price");
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || "item";
  const id = `p_${slug}_${randomBytes(2).toString("hex")}`;
  const product: Product = {
    id,
    name: input.name.trim(),
    category: input.category.trim().toLowerCase(),
    description: input.description.trim(),
    tags: [...new Set(input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))],
    variants: input.variants.map((v, i) => ({
      id: `${id}_v${i + 1}`,
      label: v.label.trim(),
      priceNaira: Math.round(v.priceNaira),
      stock: Math.max(0, Math.round(v.stock)),
    })),
    imageUrl: input.imageUrl,
    imageIsAiEnhanced: input.imageIsAiEnhanced,
  };
  await store.addProduct(product);
  return product;
}
