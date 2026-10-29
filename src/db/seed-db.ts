import { seedPosts, seedProducts } from "@/store/seed";
import type { Db } from "./client";

/** First run only: load the demo catalogue and posts so the agent has something to sell. */
export async function seedIfEmpty(d: Db): Promise<void> {
  const { rows } = await d.query<{ n: number }>("select count(*)::int as n from products");
  if (rows[0].n > 0) return;

  for (const p of seedProducts) {
    await d.query(
      `insert into products (id, name, description, category, tags) values ($1,$2,$3,$4,$5) on conflict (id) do nothing`,
      [p.id, p.name, p.description, p.category, p.tags],
    );
    for (const [i, v] of p.variants.entries()) {
      await d.query(
        `insert into variants (id, product_id, label, price_naira, stock, position) values ($1,$2,$3,$4,$5,$6) on conflict (id) do nothing`,
        [v.id, p.id, v.label, v.priceNaira, v.stock, i],
      );
    }
  }
  for (const post of seedPosts) {
    await d.query(
      `insert into posts (id, channel, caption, product_ids, posted_at) values ($1,$2,$3,$4,$5) on conflict (id) do nothing`,
      [post.id, post.channel, post.caption, post.productIds, post.postedAt],
    );
  }
}
