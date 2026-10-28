import sharp from "sharp";

/**
 * Normalise an uploaded photo once, up front: apply EXIF rotation, cap the size, convert to PNG.
 * Every later step (vision, SAM boxes, crops) then works in the same pixel coordinates.
 */
export async function normalisePhoto(input: Buffer, maxSide = 1600): Promise<{ png: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { png: data, width: info.width, height: info.height };
}

export function toDataUrl(buf: Buffer, mime = "image/png"): string {
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export interface PixelBox {
  left: number;
  top: number;
  right: number; // exclusive
  bottom: number; // exclusive
}

/** Clamp a box to the image and return integer extract() arguments. */
export function clampBox(box: PixelBox, width: number, height: number) {
  const left = Math.max(0, Math.floor(box.left));
  const top = Math.max(0, Math.floor(box.top));
  const right = Math.min(width, Math.ceil(box.right));
  const bottom = Math.min(height, Math.ceil(box.bottom));
  if (right - left < 2 || bottom - top < 2) throw new Error("Box is too small to crop");
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * Cut the product out of the photo: crop to the mask's bounds and use the
 * 0/1 mask raster as the alpha channel, so the background becomes transparent.
 */
export async function cutoutWithMask(
  png: Buffer,
  imgW: number,
  imgH: number,
  bounds: PixelBox,
  raster: Uint8Array,
  maskW: number,
  maskH: number,
  pad = 24,
): Promise<Buffer> {
  const crop = clampBox(bounds, imgW, imgH);

  let alphaBuf = Buffer.from(raster.map((v) => (v ? 255 : 0)));
  if (maskW !== crop.width || maskH !== crop.height) {
    // extractChannel(0): sharp would otherwise emit a 1-channel raw input as 3-channel sRGB.
    alphaBuf = await sharp(alphaBuf, { raw: { width: maskW, height: maskH, channels: 1 } })
      .resize(crop.width, crop.height, { fit: "fill" })
      .extractChannel(0)
      .raw()
      .toBuffer();
  }

  // Two passes: sharp reorders operations internally, and removeAlpha() would otherwise
  // run after joinChannel() and drop the mask we just added.
  const rgb = await sharp(png).extract(crop).removeAlpha().raw().toBuffer();
  const rgba = await sharp(rgb, { raw: { width: crop.width, height: crop.height, channels: 3 } })
    .joinChannel(alphaBuf, { raw: { width: crop.width, height: crop.height, channels: 1 } })
    .png()
    .toBuffer();
  return sharp(rgba)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

/** Crop to a box without a mask (fallback when no mask is returned). */
export async function cropToBox(png: Buffer, imgW: number, imgH: number, box: PixelBox): Promise<Buffer> {
  return sharp(png).extract(clampBox(box, imgW, imgH)).png().toBuffer();
}
