import { randomBytes } from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I to avoid confusion when buyers type it back

export function newOrderRef(): string {
  const bytes = randomBytes(4);
  return "SA-" + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/**
 * WhatsApp click-to-chat link with a prefilled message carrying the order ref and source post.
 * When the buyer taps it, the vendor's WhatsApp receives the ref, which links the sale back to the post.
 */
export function whatsappCheckoutLink(opts: { vendorNumber: string; orderRef: string; productName: string; postId?: string }): string {
  const text = `Hi! I'd like to complete order ${opts.orderRef} (${opts.productName}).` + (opts.postId ? ` [src:${opts.postId}]` : "");
  return `https://wa.me/${opts.vendorNumber}?text=${encodeURIComponent(text)}`;
}

/** Public base URL of the app, used for short links. Set APP_URL to your deployed or tunnelled URL. */
export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** Short, tracked checkout link sent to the buyer. The /o/[ref] route records the click and redirects to WhatsApp. */
export function checkoutShortLink(orderRef: string): string {
  return `${appUrl()}/o/${orderRef}`;
}

/** Reads the order ref and source post back out of an incoming WhatsApp message. */
export function parseAttribution(message: string): { orderRef?: string; postId?: string } {
  return {
    orderRef: message.match(/\bSA-[2-9A-HJ-NP-Z]{4}\b/)?.[0],
    postId: message.match(/\[src:([\w-]+)\]/)?.[1],
  };
}
