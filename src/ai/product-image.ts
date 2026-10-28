import { toFile } from "openai";
import { meta } from "@/lib/meta";

/**
 * Muse Image 1.0: turn the cut-out product into a clean catalogue shot.
 * Docs: https://dev.meta.ai/docs/image-generation (POST /v1/images/edits)
 *
 * The prompt is strict about fidelity: a catalogue image that makes the item look
 * different from what the buyer receives is a complaint waiting to happen.
 */

export const IMAGE_MODEL = process.env.MODEL_IMAGE || "muse-image-1.0";

export function studioPrompt(productName: string, colour: string): string {
  return [
    `E-commerce catalogue photo of exactly this product: ${productName} (${colour}).`,
    "Keep the product's exact colour, texture, length, shape and every detail unchanged. Do not add, remove or restyle anything.",
    "Place it centred on a plain warm off-white background with soft, even studio lighting and a subtle shadow.",
    "No text, no logos, no watermark, no people, no props.",
  ].join(" ");
}

export async function enhanceProductImage(cutoutPng: Buffer, productName: string, colour: string): Promise<{ image: Buffer; mime: string }> {
  const res = await meta().images.edit({
    model: IMAGE_MODEL,
    image: await toFile(cutoutPng, "product.png", { type: "image/png" }),
    prompt: studioPrompt(productName, colour),
    n: 1,
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("Muse Image returned no image");
  const image = Buffer.from(b64, "base64");
  return { image, mime: sniffImageMime(image) };
}

/** Muse Image defaults to WebP; detect from bytes rather than assuming. */
export function sniffImageMime(buf: Buffer): string {
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString("ascii") === "PNG") return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  return "application/octet-stream";
}
