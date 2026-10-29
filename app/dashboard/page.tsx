"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Dashboard, FunnelCounts } from "@/dashboard/metrics";
import type { InsightsResult } from "@/dashboard/insights";
import type { Order } from "@/domain/types";

type OrderRow = Order & { item: string; sourcePostCaption?: string };

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const compactNaira = (n: number) =>
  n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M` : n >= 10_000 ? `₦${Math.round(n / 1000)}K` : naira(n);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");
const minutes = (m: number | null) => (m === null ? "–" : m < 60 ? `${m} min` : `${(m / 60).toFixed(1)} h`);

const FUNNEL: Array<{ key: keyof FunnelCounts; label: string; hint: string }> = [
  { key: "enquiries", label: "Comments and DMs", hint: "Every message received" },
  { key: "buyingSignals", label: "Buying signals", hint: "Price, delivery, stock or ready-to-buy" },
  { key: "checkoutLinks", label: "Checkout links sent", hint: "Draft orders the agent created" },
  { key: "linksClicked", label: "Links opened", hint: "Buyer tapped the checkout link" },
  { key: "confirmed", label: "Orders confirmed", hint: "Buyer messaged the order ref on WhatsApp" },
  { key: "paid", label: "Paid", hint: "You confirmed payment" },
];

export default function DashboardPage() {
  const [days, setDays] = useState(30);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [insights, setInsights] = useState<InsightsResult | null>(null);
  const [thinking, setThinking] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard?days=${days}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not load dashboard");
      setDash(json.dashboard);
      setOrders(json.orders);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [days]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000); // live during the demo
    return () => clearInterval(t);
  }, [load]);

  async function setOrderStatus(ref: string, status: "paid" | "cancelled") {
    setNotice("");
    const res = await fetch(`/api/orders/${ref}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const json = await res.json();
    if (!res.ok) return setError(json.error?.message ?? "Update failed");
    if (json.warning) setNotice(`${ref}: ${json.warning}`);
    load();
  }

  async function askInsights() {
    setThinking(true);
    setInsights(null);
    try {
      const res = await fetch(`/api/insights?days=${days}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Insights failed");
      setInsights(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setThinking(false);
    }
  }

  const t = dash?.totals;
  const funnelMax = t ? Math.max(1, t.enquiries) : 1;

  return (
    <main>
      <nav className="nav"><Link href="/">Inbox</Link><Link href="/catalogue">Catalogue</Link><span>Dashboard</span></nav>
      <div className="row" style={{ justifyContent: "space-between", marginTop: 0 }}>
        <div>
          <h1>Which posts make money</h1>
          <p className="sub" style={{ marginBottom: 0 }}>Every comment, checkout link and order, traced back to the post that started it.</p>
        </div>
        <div className="seg" role="group" aria-label="Period">
          {[7, 30, 90].map((d) => (
            <button key={d} className={d === days ? "on" : ""} onClick={() => setDays(d)}>{d} days</button>
          ))}
        </div>
      </div>

      {error && <p className="err">{error}</p>}
      {notice && <p className="flag">{notice}</p>}
      {dash?.hasDemoData && (
        <p className="banner">Includes demo data from <code>npm run seed:demo</code>. Remove it with <code>npm run seed:demo -- --clear</code> before showing real results.</p>
      )}

      {t && (
        <>
          <section className="kpis">
            <div className="hero">
              <div className="label">Revenue from paid orders</div>
              <div className="value">{naira(t.revenueNaira)}</div>
              <div className="gloss">{t.paid} paid · {compactNaira(t.pipelineNaira)} confirmed and awaiting payment</div>
            </div>
            <Stat label="Buyers found" value={String(t.buyingSignals)} sub={`of ${t.enquiries} messages`} />
            <Stat label="Average reply time" value={minutes(t.avgReplyMinutes)} sub={`${t.replied} replied`} />
            <Stat label="Message to paid order" value={pct(t.paid, t.enquiries)} sub={`buying signal to paid: ${pct(t.paid, t.buyingSignals)}`} />
          </section>

          <div className="grid" style={{ marginTop: 16 }}>
            <section className="panel">
              <strong>Sales funnel</strong>
              <p className="gloss" style={{ marginTop: 2 }}>Last {days} days, all posts</p>
              <div className="funnel" role="list">
                {FUNNEL.map((f, i) => {
                  const v = t[f.key];
                  const prev = i > 0 ? t[FUNNEL[i - 1].key] : undefined;
                  return (
                    <div key={f.key} className="frow" role="listitem" tabIndex={0}>
                      <span className="flabel">{f.label}</span>
                      <span className="ftrack">
                        <span className="fbar" style={{ width: `${Math.max(v ? 1.5 : 0, (v / funnelMax) * 100)}%` }} />
                        <span className="fval">{v.toLocaleString("en-NG")}</span>
                      </span>
                      <span className="tip">{f.hint}{prev !== undefined ? ` · ${pct(v, prev)} of previous step` : ""}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="panel">
              <div className="row" style={{ justifyContent: "space-between", marginTop: 0 }}>
                <strong>What to post next</strong>
                <button onClick={askInsights} disabled={thinking || !t.enquiries}>{thinking ? "Reading your numbers…" : "Get insights"}</button>
              </div>
              {!insights && !thinking && <p className="gloss">Muse Spark reads only the numbers on this page and suggests what to try next.</p>}
              {insights?.sampleWarning && <p className="banner" style={{ marginTop: 10 }}>{insights.sampleWarning}</p>}
              {insights?.insights.map((i) => (
                <div key={i.title} className="insight">
                  <strong>{i.title}</strong>
                  <p>{i.finding}</p>
                  <p className="gloss">Try: {i.action}</p>
                </div>
              ))}
              {insights && insights.dropped > 0 && <p className="gloss">{insights.dropped} insight(s) removed because they quoted amounts not in your data.</p>}
            </section>
          </div>

          <section className="panel" style={{ marginTop: 16 }}>
            <strong>By post</strong>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Post</th><th className="n">Messages</th><th className="n">Buyers</th><th className="n">Links opened</th>
                    <th className="n">Confirmed</th><th className="n">Paid</th><th className="n">Revenue</th><th className="n">Buyer → paid</th><th className="n">Reply time</th>
                  </tr>
                </thead>
                <tbody>
                  {dash.posts.map((p) => (
                    <tr key={p.postId}>
                      <td><div className="cap">{p.caption}</div><div className="gloss">{p.channel.replace("_comment", "") || "–"}</div></td>
                      <td className="n">{p.enquiries}</td>
                      <td className="n">{p.buyingSignals}</td>
                      <td className="n">{p.linksClicked}/{p.checkoutLinks}</td>
                      <td className="n">{p.confirmed}</td>
                      <td className="n">{p.paid}</td>
                      <td className="n strong">{naira(p.revenueNaira)}</td>
                      <td className="n">{pct(p.paid, p.buyingSignals)}</td>
                      <td className="n">{minutes(p.avgReplyMinutes)}</td>
                    </tr>
                  ))}
                  {dash.posts.length === 0 && <tr><td colSpan={9} className="gloss">No activity in this period yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel" style={{ marginTop: 16 }}>
            <strong>Orders</strong>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr><th>Ref</th><th>Item</th><th>From post</th><th className="n">Total</th><th className="n">Link</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.ref}>
                      <td><code>{o.ref}</code>{o.isDemo && <span className="gloss"> demo</span>}</td>
                      <td>{o.item}{o.city ? <div className="gloss">{o.city}</div> : null}</td>
                      <td><div className="cap">{o.sourcePostCaption ?? "–"}</div></td>
                      <td className="n">{naira(o.totalNaira)}</td>
                      <td className="n">{o.linkClicks ? `opened ×${o.linkClicks}` : "not yet"}</td>
                      <td><span className={`status ${o.status}`}>{o.status}</span></td>
                      <td className="actions">
                        {(o.status === "draft" || o.status === "confirmed") && (
                          <>
                            <button onClick={() => setOrderStatus(o.ref, "paid")}>Mark paid</button>
                            <button className="ghost" onClick={() => setOrderStatus(o.ref, "cancelled")}>Cancel</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && <tr><td colSpan={7} className="gloss">No orders yet. They appear when the agent sends a checkout link.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="gloss">{sub}</div>
    </div>
  );
}
