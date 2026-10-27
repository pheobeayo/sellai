import { NextResponse } from "next/server";
import { store } from "@/store/store";

export const runtime = "nodejs";

/** Orders with their source post and link clicks: the raw data for the post → sale dashboard. */
export async function GET() {
  const orders = store.orders().map((o) => {
    const product = store.product(o.productId);
    return {
      ...o,
      item: `${product?.name ?? o.productId} (${product?.variants.find((v) => v.id === o.variantId)?.label ?? o.variantId})`,
      sourcePostCaption: o.sourcePostId ? store.post(o.sourcePostId)?.caption : undefined,
    };
  });
  return NextResponse.json({ orders });
}
