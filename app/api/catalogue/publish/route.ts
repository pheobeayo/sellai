import { NextResponse } from "next/server";
import { z } from "zod";
import { publishListing } from "@/catalogue/listing";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().min(2),
  category: z.string().min(1),
  description: z.string().max(600),
  tags: z.array(z.string()).max(20),
  variants: z.array(z.object({ label: z.string().min(1), priceNaira: z.number().positive(), stock: z.number().int().min(0) })).min(1).max(10),
  imageUrl: z.string().optional(),
  imageIsAiEnhanced: z.boolean().optional(),
});

/** Vendor-confirmed listing → live catalogue. The sales agent can quote it immediately. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "bad_request", message: parsed.error.message } }, { status: 400 });
  try {
    const product = await publishListing(parsed.data);
    return NextResponse.json({ product: { ...product, imageUrl: product.imageUrl ? "(stored)" : undefined } });
  } catch (e) {
    return NextResponse.json({ error: { code: "publish_failed", message: (e as Error).message } }, { status: 400 });
  }
}
