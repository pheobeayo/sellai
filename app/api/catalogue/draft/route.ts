import { NextResponse } from "next/server";
import { draftListingFromPhoto } from "@/catalogue/listing";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 12 * 1024 * 1024;

/** multipart/form-data: photo (file), hint (optional text), enhance ("false" to skip Muse Image) */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const photo = form?.get("photo");
  if (!(photo instanceof File)) return NextResponse.json({ error: { code: "bad_request", message: "Attach a photo in the 'photo' field" } }, { status: 400 });
  if (photo.size > MAX_BYTES) return NextResponse.json({ error: { code: "too_large", message: "Photo must be under 12 MB" } }, { status: 413 });

  try {
    const hint = (form?.get("hint") as string | null)?.trim() || undefined;
    const enhance = form?.get("enhance") !== "false";
    const out = await draftListingFromPhoto(Buffer.from(await photo.arrayBuffer()), { hint, enhance });
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: { code: "draft_failed", message: (e as Error).message } }, { status: 502 });
  }
}
