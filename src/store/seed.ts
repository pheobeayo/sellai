import type { DeliveryZone, Post, Product, Vendor } from "@/domain/types";

// Demo vendor. Replace with a real vendor's catalogue once you have permission to use it.
export const seedVendor: Vendor = {
  id: "v_demo",
  businessName: "Demo Hair Hub",
  whatsappNumber: process.env.VENDOR_WHATSAPP_NUMBER ?? "2348000000000",
  paymentNote:
    "Payment is by bank transfer. We send account details personally after confirming the order.",
  tone: "Warm, short and friendly. Matches the customer's language: Pidgin if they write Pidgin, English if they write English.",
};

export const seedProducts: Product[] = [
  {
    id: "p_bone_straight",
    name: "Bone Straight Frontal Wig",
    description: "100% human hair, 13x4 lace frontal, natural black. Can be dyed. Lasts 2+ years with proper care.",
    category: "wigs",
    tags: ["bone straight", "frontal", "human hair", "straight", "black"],
    variants: [
      { id: "v_bs_20", label: "20 inches", priceNaira: 75000, stock: 6 },
      { id: "v_bs_24", label: "24 inches", priceNaira: 98000, stock: 3 },
      { id: "v_bs_26", label: "26 inches", priceNaira: 115000, stock: 0 },
    ],
  },
  {
    id: "p_body_wave",
    name: "Body Wave Closure Wig",
    description: "Human hair blend, 5x5 closure, soft body wave. Beginner friendly, glueless.",
    category: "wigs",
    tags: ["body wave", "closure", "glueless", "wavy"],
    variants: [
      { id: "v_bw_18", label: "18 inches", priceNaira: 52000, stock: 10 },
      { id: "v_bw_22", label: "22 inches", priceNaira: 64000, stock: 4 },
    ],
  },
  {
    id: "p_pixie_burgundy",
    name: "Burgundy Pixie Cut Wig",
    description: "Short pixie cut, 100% human hair, burgundy colour. Ready to wear.",
    category: "wigs",
    tags: ["pixie", "short", "burgundy", "colour", "red"],
    variants: [{ id: "v_px_std", label: "Standard", priceNaira: 38000, stock: 8 }],
  },
];

export const seedDeliveryZones: DeliveryZone[] = [
  { city: "Lagos", aliases: ["lag", "lasgidi", "ikeja", "lekki", "yaba", "surulere"], feeNaira: 3500, eta: "same day if ordered before 12pm" },
  { city: "Abuja", aliases: ["fct", "garki", "wuse", "gwarinpa", "kubwa"], feeNaira: 5000, eta: "1-2 days" },
  { city: "Ibadan", aliases: ["ib", "bodija", "challenge"], feeNaira: 4500, eta: "1-2 days" },
  { city: "Port Harcourt", aliases: ["ph", "portharcourt", "port-harcourt"], feeNaira: 6000, eta: "2-3 days" },
  { city: "Kano", aliases: [], feeNaira: 7000, eta: "3-4 days" },
  { city: "Enugu", aliases: [], feeNaira: 6000, eta: "2-3 days" },
];

export const seedPosts: Post[] = [
  { id: "post_ig_bs01", channel: "instagram_comment", caption: "Bone straight frontal, 20 to 26 inches 🔥", productIds: ["p_bone_straight"], postedAt: "2026-10-27T09:00:00Z" },
  { id: "post_fb_bw01", channel: "facebook_comment", caption: "Glueless body wave for beginners", productIds: ["p_body_wave"], postedAt: "2026-10-27T10:00:00Z" },
  { id: "post_ig_px01", channel: "instagram_comment", caption: "Burgundy pixie, ready to wear", productIds: ["p_pixie_burgundy"], postedAt: "2026-10-27T11:00:00Z" },
];
