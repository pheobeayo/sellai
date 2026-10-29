import { NextResponse } from "next/server";
import { store } from "@/store/store";

export const runtime = "nodejs";

/** Orders with item names and source post captions. */
export async function GET() {
  const [orders, products, posts] = await Promise.all([store.orders(), store.products(), store.posts()]);
  return NextResponse.json({
    orders: orders.map((o) => {
      const p = products.find((x) => x.id === o.productId);
      return {
        ...o,
        item: `${p?.name ?? o.productId} (${p?.variants.find((v) => v.id === o.variantId)?.label ?? o.variantId})`,
        sourcePostCaption: posts.find((x) => x.id === o.sourcePostId)?.caption || undefined,
      };
    }),
  });
}
