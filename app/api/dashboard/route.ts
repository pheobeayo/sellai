import { NextResponse } from "next/server";
import { getDashboard } from "@/dashboard/metrics";
import { store } from "@/store/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Funnel and per-post attribution, plus recent orders for the vendor's actions. ?days=7|30|90 */
export async function GET(req: Request) {
  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 30));
  try {
    const [dashboard, orders, products, posts] = await Promise.all([getDashboard(days), store.orders(100), store.products(), store.posts()]);
    return NextResponse.json({
      dashboard,
      orders: orders.map((o) => {
        const p = products.find((x) => x.id === o.productId);
        return {
          ...o,
          item: `${p?.name ?? o.productId} (${p?.variants.find((v) => v.id === o.variantId)?.label ?? o.variantId})`,
          sourcePostCaption: posts.find((x) => x.id === o.sourcePostId)?.caption || undefined,
        };
      }),
    });
  } catch (e) {
    return NextResponse.json({ error: { code: "dashboard_failed", message: (e as Error).message } }, { status: 500 });
  }
}
