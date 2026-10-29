import { NextResponse } from "next/server";
import { z } from "zod";
import { store } from "@/store/store";

export const runtime = "nodejs";

const Body = z.object({ status: z.enum(["paid", "cancelled"]) });

/** Vendor marks an order paid (deducts stock) or cancelled. */
export async function POST(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "bad_request", message: parsed.error.message } }, { status: 400 });
  const { order, warning } = await store.setOrderStatus(ref.toUpperCase(), parsed.data.status);
  if (!order) return NextResponse.json({ error: { code: "not_found", message: warning ?? "Order not found" } }, { status: 404 });
  return NextResponse.json({ order, warning });
}
