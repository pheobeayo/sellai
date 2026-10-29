import { runChecks, type CheckReport } from "@/agent/checks";
import type { DraftMeta, EnquiryRecord } from "@/domain/types";
import { appUrl } from "@/integrations/attribution";
import { store } from "@/store/store";

/** Run the independent checks on a reply text, using what the agent did for this enquiry. */
export async function checkReply(
  e: Pick<EnquiryRecord, "intent" | "language">,
  reply: string,
  meta: Pick<DraftMeta, "groundedAmounts" | "orderRefs" | "escalated">,
): Promise<CheckReport> {
  const orderStock = [];
  for (const ref of meta.orderRefs) {
    const o = await store.order(ref);
    if (!o || o.status === "paid" || o.status === "cancelled") continue; // paid orders already deducted stock
    const p = await store.product(o.productId);
    const stock = p?.variants.find((v) => v.id === o.variantId)?.stock ?? 0;
    orderStock.push({ ref, quantity: o.quantity, stock });
  }
  return runChecks({
    reply,
    groundedAmounts: meta.groundedAmounts,
    orderRefs: meta.orderRefs,
    orderStock,
    intent: e.intent,
    escalated: meta.escalated,
    customerLanguage: e.language,
    appUrl: appUrl(),
  });
}
