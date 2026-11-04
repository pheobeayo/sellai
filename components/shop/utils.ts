import type { Product } from "@/domain/types";
import { seedVendor } from "@/store/seed";

export const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

export function waLink(text: string) {
  const number = (
    process.env.VENDOR_WHATSAPP_NUMBER || seedVendor.whatsappNumber
  ).replace(/\D/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export const initialsOf = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

// Colour blocks for products without a photo, picked from the name so each product keeps the same one.
const tints = ["#2B2420", "#4A3426", "#6B1F2E", "#1F5A44", "#B4471F"];

/** Everything a product card needs, worked out once per product. */
export function describe(p: Product) {
  const inStock = p.variants.filter((v) => v.stock > 0);
  const from = Math.min(
    ...(inStock.length ? inStock : p.variants).map((v) => v.priceNaira),
  );
  const tint =
    tints[[...p.name].reduce((n, c) => n + c.charCodeAt(0), 0) % tints.length];
  return {
    inStock,
    from,
    initials: initialsOf(p.name),
    tint,
    href: waLink(`Hi! How much is the ${p.name}?`),
  };
}

export type ProductSummary = ReturnType<typeof describe>;
