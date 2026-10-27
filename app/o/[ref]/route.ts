import { whatsappCheckoutLink } from "@/integrations/attribution";
import { store } from "@/store/store";

export const runtime = "nodejs";

/**
 * Short checkout link: /o/SA-XXXX
 * Records that the buyer opened the link, then sends them to the vendor's WhatsApp
 * with the order ref and source post prefilled.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const order = store.recordClick(ref.toUpperCase());
  if (!order) return new Response("This order link has expired or does not exist.", { status: 404 });

  const product = store.product(order.productId);
  const variant = product?.variants.find((v) => v.id === order.variantId);
  const target = whatsappCheckoutLink({
    vendorNumber: store.vendor().whatsappNumber,
    orderRef: order.ref,
    productName: `${product?.name ?? "item"} ${variant?.label ?? ""}`.trim(),
    postId: order.sourcePostId,
  });

  return Response.redirect(target, 302);
}
