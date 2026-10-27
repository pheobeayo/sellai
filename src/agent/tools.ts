import type OpenAI from "openai";
import { z } from "zod";
import type { Channel, Order } from "@/domain/types";
import { newOrderRef, whatsappCheckoutLink } from "@/integrations/attribution";
import { store } from "@/store/store";

/**
 * Tools the sales agent can call. Every fact the agent states to a customer
 * (price, stock, delivery fee) must come from one of these, never from the model.
 */

export interface ToolContext {
  channel: Channel;
  postId?: string;
  customerHandle?: string;
}

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  /** Naira amounts this result made available to the agent. Used by the grounding check. */
  groundedAmounts?: number[];
}

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

const SearchArgs = z.object({ query: z.string().min(1) });
const ProductArgs = z.object({ product_id: z.string() });
const DeliveryArgs = z.object({ city: z.string().min(1) });
const OrderArgs = z.object({
  product_id: z.string(),
  variant_id: z.string(),
  quantity: z.number().int().min(1).max(20).default(1),
  city: z.string().optional(),
});
const EscalateArgs = z.object({ reason: z.string().min(3) });

export const toolDefinitions: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_catalogue",
      description: "Find products in the vendor's catalogue by keywords (style, length, colour). Returns ids, names and price ranges.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_product",
      description: "Get full details of one product: description, variants with exact price and stock.",
      parameters: { type: "object", properties: { product_id: { type: "string" } }, required: ["product_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_delivery_quote",
      description: "Get the delivery fee and estimated time to a Nigerian city. Returns served:false if the vendor doesn't deliver there.",
      parameters: { type: "object", properties: { city: { type: "string" } }, required: ["city"] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_order_draft",
      description:
        "Create a DRAFT order when the customer has clearly chosen a product and variant. The vendor must confirm it. Returns an order ref and a WhatsApp checkout link to send the customer.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          variant_id: { type: "string" },
          quantity: { type: "integer", minimum: 1 },
          city: { type: "string", description: "Delivery city, if known" },
        },
        required: ["product_id", "variant_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escalate_to_vendor",
      description: "Hand the conversation to the human vendor: complaints, refunds, custom requests, or anything you cannot answer from the tools.",
      parameters: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] },
    },
  },
];

function findZone(city: string) {
  const q = city.trim().toLowerCase();
  return store.deliveryZones().find((z) => z.city.toLowerCase() === q || z.aliases.includes(q) || q.includes(z.city.toLowerCase()));
}

export async function runTool(name: string, rawArgs: string, ctx: ToolContext): Promise<ToolResult> {
  let json: unknown;
  try {
    json = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { ok: false, error: "Arguments were not valid JSON" };
  }

  switch (name) {
    case "search_catalogue": {
      const a = SearchArgs.safeParse(json);
      if (!a.success) return { ok: false, error: a.error.message };
      const terms = a.data.query.toLowerCase().split(/\s+/).filter(Boolean);
      const scored = store
        .products()
        .map((p) => {
          const hay = [p.name, p.description, p.category, ...p.tags, ...p.variants.map((v) => v.label)].join(" ").toLowerCase();
          return { p, score: terms.filter((t) => hay.includes(t)).length };
        })
        .filter((x) => x.score > 0)
        .sort((x, y) => y.score - x.score)
        .slice(0, 5);
      const matches = (scored.length ? scored.map((x) => x.p) : store.products()).map((p) => {
        const prices = p.variants.map((v) => v.priceNaira);
        return { product_id: p.id, name: p.name, from: naira(Math.min(...prices)), to: naira(Math.max(...prices)) };
      });
      const amounts = matches.flatMap((m) => store.product(m.product_id)!.variants.map((v) => v.priceNaira));
      return { ok: true, data: { matches, note: scored.length ? undefined : "No close match; showing full catalogue." }, groundedAmounts: amounts };
    }

    case "get_product": {
      const a = ProductArgs.safeParse(json);
      if (!a.success) return { ok: false, error: a.error.message };
      const p = store.product(a.data.product_id);
      if (!p) return { ok: false, error: `No product with id ${a.data.product_id}` };
      return {
        ok: true,
        data: {
          product_id: p.id,
          name: p.name,
          description: p.description,
          variants: p.variants.map((v) => ({
            variant_id: v.id,
            label: v.label,
            price: naira(v.priceNaira),
            in_stock: v.stock > 0,
            stock_left: v.stock,
          })),
        },
        groundedAmounts: p.variants.map((v) => v.priceNaira),
      };
    }

    case "get_delivery_quote": {
      const a = DeliveryArgs.safeParse(json);
      if (!a.success) return { ok: false, error: a.error.message };
      const z = findZone(a.data.city);
      if (!z) return { ok: true, data: { served: false, city: a.data.city, note: "Not in delivery list. Escalate if the customer insists." } };
      return { ok: true, data: { served: true, city: z.city, fee: naira(z.feeNaira), eta: z.eta }, groundedAmounts: [z.feeNaira] };
    }

    case "create_order_draft": {
      const a = OrderArgs.safeParse(json);
      if (!a.success) return { ok: false, error: a.error.message };
      const p = store.product(a.data.product_id);
      const v = p?.variants.find((x) => x.id === a.data.variant_id);
      if (!p || !v) return { ok: false, error: "Unknown product or variant. Call get_product first." };
      if (v.stock < a.data.quantity) return { ok: false, error: `Only ${v.stock} left of ${v.label}. Offer another variant.` };
      const zone = a.data.city ? findZone(a.data.city) : undefined;
      const deliveryFee = zone?.feeNaira ?? 0;
      const order: Order = {
        ref: newOrderRef(),
        productId: p.id,
        variantId: v.id,
        quantity: a.data.quantity,
        unitPriceNaira: v.priceNaira,
        deliveryFeeNaira: deliveryFee,
        totalNaira: v.priceNaira * a.data.quantity + deliveryFee,
        city: zone?.city ?? a.data.city,
        customerHandle: ctx.customerHandle,
        channel: ctx.channel,
        sourcePostId: ctx.postId,
        status: "draft_awaiting_vendor",
        createdAt: new Date().toISOString(),
      };
      store.addOrder(order);
      const link = whatsappCheckoutLink({ vendorNumber: store.vendor().whatsappNumber, orderRef: order.ref, productName: `${p.name} ${v.label}`, postId: ctx.postId });
      return {
        ok: true,
        data: {
          order_ref: order.ref,
          item: `${p.name} (${v.label}) x${order.quantity}`,
          subtotal: naira(v.priceNaira * order.quantity),
          delivery_fee: zone ? naira(deliveryFee) : "to be confirmed (city unknown)",
          total: naira(order.totalNaira),
          checkout_link: link,
          payment_note: store.vendor().paymentNote,
        },
        groundedAmounts: [v.priceNaira, v.priceNaira * order.quantity, deliveryFee, order.totalNaira],
      };
    }

    case "escalate_to_vendor": {
      const a = EscalateArgs.safeParse(json);
      if (!a.success) return { ok: false, error: a.error.message };
      return { ok: true, data: { escalated: true, reason: a.data.reason, note: "Tell the customer the vendor will reply personally soon." } };
    }

    default:
      return { ok: false, error: `Unknown tool ${name}` };
  }
}
