import {
  decodeMaskToRaster,
  parseImageStream,
  recordsOfKind,
  type ResponsesEvent,
  type SegmentationMask,
} from "@meta-sam/parser";
import { meta } from "@/lib/meta";
import type { PixelBox } from "./image-utils";

/**
 * SAM 3.1 through the Responses API: a short noun phrase + an image → boxes and masks.
 * Docs: https://dev.meta.ai/docs/sam/overview · Parser: @meta-sam/parser
 */

export const SAM_MODEL = process.env.MODEL_SAM || "sam-3.1";

export interface SegmentedObject {
  objectId: string;
  box: PixelBox;
  confidence?: number;
  mask?: { raster: Uint8Array; width: number; height: number; bounds: PixelBox };
  areaPx: number;
}

export interface SegmentationOutput {
  objects: SegmentedObject[];
  outcome: string;
  diagnostics: string[];
}

/**
 * @param imageUrl public URL or data URL of the (normalised) image
 * @param phrase   short noun phrase, e.g. "wig", "handbag". Not a command or a question.
 */
export async function segment(imageUrl: string, phrase: string): Promise<SegmentationOutput> {
  // The OpenAI SDK's Responses types don't cover SAM's metadata, so build the body loosely.
  const body = {
    model: SAM_MODEL,
    stream: true,
    metadata: { mask_encoding: "one_bit" },
    input: [
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: phrase },
          { type: "input_image", image_url: imageUrl },
        ],
      },
    ],
  };
  const stream = await meta().responses.create(body as never);
  return parseSegmentation(stream as unknown as AsyncIterable<ResponsesEvent>);
}

/** Parse a SAM Responses stream into objects, largest first. Separate from segment() so it can be tested offline. */
export async function parseSegmentation(events: AsyncIterable<ResponsesEvent>): Promise<SegmentationOutput> {
  const result = await parseImageStream(events).finalResult;

  const masks = recordsOfKind(result.records, "mask");
  const objects: SegmentedObject[] = recordsOfKind(result.records, "box").map((b) => {
    const m = masks.find((x) => x.objectId === b.objectId);
    const box = { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
    let mask: SegmentedObject["mask"];
    let areaPx = (b.right - b.left) * (b.bottom - b.top);
    if (m) {
      const mm: SegmentationMask = m.mask;
      const raster = decodeMaskToRaster(mm);
      areaPx = raster.reduce((n, v) => n + v, 0);
      mask = { raster, width: mm.width, height: mm.height, bounds: m.bounds };
    }
    return { objectId: b.objectId, box, confidence: b.confidence ?? m?.confidence, mask, areaPx };
  });

  objects.sort((a, b) => b.areaPx - a.areaPx);
  return {
    objects,
    outcome: result.outcome.status,
    diagnostics: result.diagnostics.map((d) => `${d.code}: ${d.message}`),
  };
}
