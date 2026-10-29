import { db } from "@/db/client";

/**
 * "Which post made money": per-post and overall funnel, computed in SQL so it scales
 * and reads the same on Supabase and PGlite. Cancelled orders are excluded everywhere.
 */

export const BUYING_INTENTS = ["ready_to_buy", "price_enquiry", "delivery_enquiry", "availability_or_variant"] as const;

export interface FunnelCounts {
  enquiries: number;
  buyingSignals: number;
  readyToBuy: number;
  replied: number;
  checkoutLinks: number; // orders created by the agent (each one sent a link)
  linksClicked: number;
  confirmed: number; // confirmed or paid
  paid: number;
}

export interface PostMetrics extends FunnelCounts {
  postId: string;
  caption: string;
  channel: string;
  revenueNaira: number; // paid orders
  pipelineNaira: number; // confirmed, not yet paid
  avgReplyMinutes: number | null;
}

export interface Dashboard {
  periodDays: number;
  since: string;
  totals: FunnelCounts & { revenueNaira: number; pipelineNaira: number; avgReplyMinutes: number | null };
  posts: PostMetrics[];
  hasDemoData: boolean;
}

const UNATTRIBUTED = "(no post)";

export async function getDashboard(periodDays = 30): Promise<Dashboard> {
  const d = await db();
  const since = new Date(Date.now() - periodDays * 86_400_000).toISOString();

  const { rows } = await d.query(
    `with e as (
       select coalesce(post_id, $2) as post_id,
              count(*)::int as enquiries,
              count(*) filter (where intent = any($3::text[]))::int as buying_signals,
              count(*) filter (where intent = 'ready_to_buy')::int as ready_to_buy,
              count(*) filter (where status = 'replied')::int as replied,
              coalesce(sum(extract(epoch from (replied_at - received_at))) filter (where replied_at is not null), 0)::float8 as reply_seconds
       from enquiries where received_at >= $1 group by 1
     ), o as (
       select coalesce(source_post_id, $2) as post_id,
              count(*)::int as checkout_links,
              count(*) filter (where link_clicks > 0)::int as links_clicked,
              count(*) filter (where status in ('confirmed', 'paid'))::int as confirmed,
              count(*) filter (where status = 'paid')::int as paid,
              coalesce(sum(total_naira) filter (where status = 'paid'), 0)::float8 as revenue_naira,
              coalesce(sum(total_naira) filter (where status = 'confirmed'), 0)::float8 as pipeline_naira
       from orders where created_at >= $1 and status <> 'cancelled' group by 1
     )
     select coalesce(e.post_id, o.post_id) as post_id,
            coalesce(p.caption, '') as caption, coalesce(p.channel, '') as channel,
            coalesce(e.enquiries, 0) as enquiries, coalesce(e.buying_signals, 0) as buying_signals,
            coalesce(e.ready_to_buy, 0) as ready_to_buy, coalesce(e.replied, 0) as replied,
            coalesce(e.reply_seconds, 0) as reply_seconds,
            coalesce(o.checkout_links, 0) as checkout_links, coalesce(o.links_clicked, 0) as links_clicked,
            coalesce(o.confirmed, 0) as confirmed, coalesce(o.paid, 0) as paid,
            coalesce(o.revenue_naira, 0) as revenue_naira, coalesce(o.pipeline_naira, 0) as pipeline_naira
     from e full outer join o on e.post_id = o.post_id
     left join posts p on p.id = coalesce(e.post_id, o.post_id)
     order by revenue_naira desc, confirmed desc, buying_signals desc, enquiries desc`,
    [since, UNATTRIBUTED, BUYING_INTENTS],
  );

  const posts: PostMetrics[] = rows.map((r) => ({
    postId: r.post_id,
    caption: r.caption || (r.post_id === UNATTRIBUTED ? "Direct messages (no post)" : "Untitled post"),
    channel: r.channel,
    enquiries: r.enquiries,
    buyingSignals: r.buying_signals,
    readyToBuy: r.ready_to_buy,
    replied: r.replied,
    checkoutLinks: r.checkout_links,
    linksClicked: r.links_clicked,
    confirmed: r.confirmed,
    paid: r.paid,
    revenueNaira: Math.round(r.revenue_naira),
    pipelineNaira: Math.round(r.pipeline_naira),
    avgReplyMinutes: r.replied ? round1(r.reply_seconds / r.replied / 60) : null,
  }));

  const sum = (k: keyof FunnelCounts | "revenueNaira" | "pipelineNaira") => posts.reduce((n, p) => n + (p[k] as number), 0);
  const totalReplySeconds = rows.reduce((n, r) => n + r.reply_seconds, 0);
  const replied = sum("replied");

  const { rows: demo } = await d.query<{ any_demo: boolean }>(
    `select (exists(select 1 from enquiries where is_demo) or exists(select 1 from orders where is_demo)) as any_demo`,
  );

  return {
    periodDays,
    since,
    totals: {
      enquiries: sum("enquiries"),
      buyingSignals: sum("buyingSignals"),
      readyToBuy: sum("readyToBuy"),
      replied,
      checkoutLinks: sum("checkoutLinks"),
      linksClicked: sum("linksClicked"),
      confirmed: sum("confirmed"),
      paid: sum("paid"),
      revenueNaira: sum("revenueNaira"),
      pipelineNaira: sum("pipelineNaira"),
      avgReplyMinutes: replied ? round1(totalReplySeconds / replied / 60) : null,
    },
    posts,
    hasDemoData: Boolean(demo[0]?.any_demo),
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
