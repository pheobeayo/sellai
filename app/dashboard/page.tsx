"use client";

import { useCallback, useEffect, useState } from "react";
import { Lightbulb, Sparkles } from "lucide-react";
import type { Dashboard, FunnelCounts } from "@/dashboard/metrics";
import type { InsightsResult } from "@/dashboard/insights";
import type { Order } from "@/domain/types";
import SellerShell from "../../components/seller/SellerShell";
import AnalyticsTabs from "../../components/seller/AnalyticsTabs";
import PageHeader from "../../components/seller/PageHeader";
import Panel from "../../components/seller/Panel";
import Segmented from "../../components/seller/Segmented";
import Notice from "../../components/seller/Notice";
import StatCard from "../../components/seller/StatCard";
import StatusPill from "../../components/seller/StatusPill";
import Tag from "../../components/seller/Tag";
import {
  btn,
  btnSm,
  btnSmGhost,
  code,
  muted,
  table,
  tableWrap,
  td,
  tdNum,
  th,
  thNum,
} from "../../components/seller/styles";

type OrderRow = Order & { item: string; sourcePostCaption?: string };

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const compactNaira = (n: number) =>
  n >= 1_000_000
    ? `₦${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
    : n >= 10_000
      ? `₦${Math.round(n / 1000)}K`
      : naira(n);
const pct = (a: number, b: number) =>
  b ? `${Math.round((a / b) * 100)}%` : "–";
const minutes = (m: number | null) =>
  m === null ? "–" : m < 60 ? `${m} min` : `${(m / 60).toFixed(1)} h`;

const FUNNEL: Array<{ key: keyof FunnelCounts; label: string; hint: string }> =
  [
    {
      key: "enquiries",
      label: "Comments and DMs",
      hint: "Every message received",
    },
    {
      key: "buyingSignals",
      label: "Buying signals",
      hint: "Price, delivery, stock or ready-to-buy",
    },
    {
      key: "checkoutLinks",
      label: "Checkout links sent",
      hint: "Draft orders the agent created",
    },
    {
      key: "linksClicked",
      label: "Links opened",
      hint: "Buyer tapped the checkout link",
    },
    {
      key: "confirmed",
      label: "Orders confirmed",
      hint: "Buyer messaged the order ref on WhatsApp",
    },
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
      const res = await fetch(`/api/dashboard?days=${days}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error?.message ?? "Could not load dashboard");
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
    const res = await fetch(`/api/orders/${ref}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
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
    <SellerShell>
      <AnalyticsTabs />
      <PageHeader
        title="Which posts make money"
        description="Every comment, checkout link and order, traced back to the post that started it."
        actions={
          <Segmented
            ariaLabel="Period"
            options={[7, 30, 90].map((d) => ({ value: d, label: `${d} days` }))}
            value={days}
            onChange={setDays}
          />
        }
      />

      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="warning">{notice}</Notice>}
      {dash?.hasDemoData && (
        <Notice tone="info">
          Includes demo data from{" "}
          <code className={code}>npm run seed:demo</code>. Remove it with{" "}
          <code className={code}>npm run seed:demo -- --clear</code> before
          showing real results.
        </Notice>
      )}

      {t && (
        <>
          <div className="flex flex-wrap gap-4">
            <StatCard
              hero
              label="Revenue from paid orders"
              value={naira(t.revenueNaira)}
              sub={`${t.paid} paid · ${compactNaira(t.pipelineNaira)} confirmed and awaiting payment`}
            />
            <StatCard
              label="Buyers found"
              value={String(t.buyingSignals)}
              sub={`of ${t.enquiries} messages`}
            />
            <StatCard
              label="Average reply time"
              value={minutes(t.avgReplyMinutes)}
              sub={`${t.replied} replied`}
            />
            <StatCard
              label="Message to paid order"
              value={pct(t.paid, t.enquiries)}
              sub={`Buying signal to paid: ${pct(t.paid, t.buyingSignals)}`}
            />
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <Panel
              title="Sales funnel"
              description={`Last ${days} days, all posts`}
              className="lg:flex-[1.3]"
            >
              <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
                {FUNNEL.map((f, i) => {
                  const v = t[f.key];
                  const prev = i > 0 ? t[FUNNEL[i - 1].key] : undefined;
                  return (
                    <li key={f.key} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-bold">{f.label}</span>
                        <span className="font-display text-[17px] font-bold tabular-nums">
                          {v.toLocaleString("en-NG")}
                        </span>
                      </div>
                      <div
                        className="h-3 overflow-hidden rounded-full bg-[#EFE6D8]"
                        aria-hidden
                      >
                        <div
                          className={`h-full rounded-full ${i === FUNNEL.length - 1 ? "bg-[#B4471F]" : "bg-forest"}`}
                          style={{
                            width: `${Math.max(v ? 1.5 : 0, (v / funnelMax) * 100)}%`,
                            opacity: 1 - i * 0.09,
                          }}
                        />
                      </div>
                      <span className="text-xs text-[#5C635E]">
                        {f.hint}
                        {prev !== undefined
                          ? ` · ${pct(v, prev)} of previous step`
                          : ""}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Panel>

            <Panel
              title="What to post next"
              className="lg:flex-1"
              action={
                <button
                  type="button"
                  className={btn}
                  onClick={askInsights}
                  disabled={thinking || !t.enquiries}
                >
                  <Sparkles aria-hidden size={16} strokeWidth={2.4} />
                  {thinking ? "Reading your numbers…" : "Get insights"}
                </button>
              }
            >
              {!insights && !thinking && (
                <p className={`m-0 ${muted}`}>
                  Muse Spark reads only the numbers on this page and suggests
                  what to try next.
                </p>
              )}
              {thinking && (
                <div className="flex flex-col gap-3" aria-hidden>
                  {[0, 1].map((k) => (
                    <div
                      key={k}
                      className="h-[92px] animate-pulse rounded-2xl bg-[#F7F4EE]"
                    />
                  ))}
                </div>
              )}
              {insights?.sampleWarning && (
                <Notice tone="warning">{insights.sampleWarning}</Notice>
              )}
              {insights?.insights.map((i) => (
                <div
                  key={i.title}
                  className="flex flex-col gap-1.5 rounded-2xl bg-[#F7F4EE] p-4"
                >
                  <strong className="flex items-center gap-2 text-[15px]">
                    <Lightbulb
                      aria-hidden
                      size={16}
                      strokeWidth={2.2}
                      className="flex-none text-[#B4471F]"
                    />
                    {i.title}
                  </strong>
                  <p className="m-0 text-sm leading-normal">{i.finding}</p>
                  <p className="m-0 text-sm font-bold leading-normal text-[#1F5A44]">
                    Try: {i.action}
                  </p>
                </div>
              ))}
              {insights && insights.dropped > 0 && (
                <p className={`m-0 ${muted}`}>
                  {insights.dropped} insight(s) removed because they quoted
                  amounts not in your data.
                </p>
              )}
            </Panel>
          </div>

          <Panel title="By post">
            <div className={tableWrap}>
              <table className={table}>
                <thead>
                  <tr>
                    <th className={th}>Post</th>
                    <th className={thNum}>Messages</th>
                    <th className={thNum}>Buyers</th>
                    <th className={thNum}>Links opened</th>
                    <th className={thNum}>Confirmed</th>
                    <th className={thNum}>Paid</th>
                    <th className={thNum}>Revenue</th>
                    <th className={thNum}>Buyer → paid</th>
                    <th className={thNum}>Reply time</th>
                  </tr>
                </thead>
                <tbody>
                  {dash.posts.map((p) => (
                    <tr key={p.postId} className="hover:bg-[#FBFAF7]">
                      <td className={td}>
                        <div className="line-clamp-2 max-w-[280px] font-bold">
                          {p.caption}
                        </div>
                        <div className="mt-1 text-xs capitalize text-[#5C635E]">
                          {p.channel.replace("_comment", "") || "–"}
                        </div>
                      </td>
                      <td className={tdNum}>{p.enquiries}</td>
                      <td className={tdNum}>{p.buyingSignals}</td>
                      <td className={tdNum}>
                        {p.linksClicked}/{p.checkoutLinks}
                      </td>
                      <td className={tdNum}>{p.confirmed}</td>
                      <td className={tdNum}>{p.paid}</td>
                      <td className={`${tdNum} font-bold text-[#1F5A44]`}>
                        {naira(p.revenueNaira)}
                      </td>
                      <td className={tdNum}>{pct(p.paid, p.buyingSignals)}</td>
                      <td className={tdNum}>{minutes(p.avgReplyMinutes)}</td>
                    </tr>
                  ))}
                  {dash.posts.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className={`${td} text-center text-[#5C635E]`}
                      >
                        No activity in this period yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Orders">
            <div className={tableWrap}>
              <table className={table}>
                <thead>
                  <tr>
                    <th className={th}>Ref</th>
                    <th className={th}>Item</th>
                    <th className={th}>From post</th>
                    <th className={thNum}>Total</th>
                    <th className={thNum}>Link</th>
                    <th className={th}>Status</th>
                    <th className={th}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.ref} className="hover:bg-[#FBFAF7]">
                      <td className={td}>
                        <code className={code}>{o.ref}</code>
                        {o.isDemo && (
                          <span className="ml-1.5">
                            <Tag tone="grey">demo</Tag>
                          </span>
                        )}
                      </td>
                      <td className={td}>
                        <div className="font-bold">{o.item}</div>
                        {o.city ? (
                          <div className="mt-1 text-xs text-[#5C635E]">
                            {o.city}
                          </div>
                        ) : null}
                      </td>
                      <td className={td}>
                        <div className="line-clamp-2 max-w-[240px] text-[#5C635E]">
                          {o.sourcePostCaption ?? "–"}
                        </div>
                      </td>
                      <td className={`${tdNum} font-bold`}>
                        {naira(o.totalNaira)}
                      </td>
                      <td
                        className={`${tdNum} whitespace-nowrap text-[#5C635E]`}
                      >
                        {o.linkClicks
                          ? `opened ×${o.linkClicks}`
                          : o.status === "confirmed" || o.status === "paid"
                            ? "used"
                            : "not yet"}
                      </td>
                      <td className={td}>
                        <StatusPill status={o.status} />
                      </td>
                      <td className={td}>
                        {(o.status === "draft" || o.status === "confirmed") && (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className={btnSm}
                              onClick={() => setOrderStatus(o.ref, "paid")}
                            >
                              Mark paid
                            </button>
                            <button
                              type="button"
                              className={btnSmGhost}
                              onClick={() => setOrderStatus(o.ref, "cancelled")}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className={`${td} text-center text-[#5C635E]`}
                      >
                        No orders yet. They appear when the agent sends a
                        checkout link.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </SellerShell>
  );
}
