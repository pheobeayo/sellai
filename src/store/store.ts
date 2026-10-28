import type { DeliveryZone, Enquiry, Order, Post, Product, Vendor } from "@/domain/types";
import { seedDeliveryZones, seedPosts, seedProducts, seedVendor } from "./seed";

/**
 * Data access used by the agent tools and API routes.
 * The in-memory implementation keeps the demo runnable with no database.
 * Swap in a Postgres/Supabase implementation of the same interface later.
 */
export interface Store {
  vendor(): Vendor;
  products(): Product[];
  product(id: string): Product | undefined;
  addProduct(p: Product): void;
  deliveryZones(): DeliveryZone[];
  post(id: string): Post | undefined;
  posts(): Post[];
  addEnquiry(e: Enquiry): void;
  enquiries(): Enquiry[];
  addOrder(o: Order): void;
  orders(): Order[];
  order(ref: string): Order | undefined;
  /** Records a checkout-link click. Returns the updated order, or undefined if the ref is unknown. */
  recordClick(ref: string): Order | undefined;
}

class MemoryStore implements Store {
  private _enquiries: Enquiry[] = [];
  private _orders: Order[] = [];
  private _products: Product[] = [...seedProducts];

  vendor() { return seedVendor; }
  products() { return this._products; }
  product(id: string) { return this._products.find((p) => p.id === id); }
  addProduct(p: Product) {
    if (this.product(p.id)) throw new Error(`Product ${p.id} already exists`);
    this._products.push(p);
  }
  deliveryZones() { return seedDeliveryZones; }
  post(id: string) { return seedPosts.find((p) => p.id === id); }
  posts() { return seedPosts; }
  addEnquiry(e: Enquiry) { this._enquiries.push(e); }
  enquiries() { return [...this._enquiries]; }
  addOrder(o: Order) { this._orders.push(o); }
  orders() { return [...this._orders]; }
  order(ref: string) { return this._orders.find((o) => o.ref === ref); }
  recordClick(ref: string) {
    const o = this.order(ref);
    if (!o) return undefined;
    o.linkClicks += 1;
    o.firstClickedAt ??= new Date().toISOString();
    return o;
  }
}

// Survive Next.js hot reloads in development.
const g = globalThis as unknown as { __sellaiStore?: Store };
export const store: Store = g.__sellaiStore ?? (g.__sellaiStore = new MemoryStore());
