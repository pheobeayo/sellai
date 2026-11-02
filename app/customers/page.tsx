"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CheckReport } from "@/agent/checks";
import type { Reward, RewardKind } from "@/domain/types";
import type { Customer, LoyaltySummary, Source } from "@/loyalty/customers";
import { describeReward, TIER_LABEL, type LoyaltyRules } from "@/loyalty/rules";
import type { Suggestion } from "@/loyalty/suggest";

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const SOURCE_LABEL: Record<Source, string> = { facebook: "Facebook", instagram: "Instagram", whatsapp: "WhatsApp", other: "Other" };
const ago = (iso?: string) => {
  if (!iso) return "–";
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

type RewardRow = Reward & { description: string };
type Draft = Suggestion & { kind: RewardKind; value: number; text: string; state?: "sending" | "done"; result?: IssueResult; error?: string };
interface IssueResult { reward: Reward; fullMessage: string; adjusted?: string; delivered: boolean; waLink?: string; note?: string }

export default function CustomersPage() {
  const [source, setSource] = useState<Source | "all">("all");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<LoyaltySummary | null>(null);
  const [rules, setRules] = useState<LoyaltyRules | null>(null);
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [skipped, setSkipped] = useState<Array<{ handle: string; why: string }>>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/customers${source === "all" ? "" : `?source=${source}`}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not load customers");
      setCustomers(json.customers);
      setSummary(json.summary);
      setRules(json.rules);
      setRewards(json.rewards);
      setWhatsappConnected(json.whatsappConnected);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [source]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(handle: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(handle)) n.delete(handle);
      else n.add(handle);
      return n;
    });
  }

  async function suggest() {
    setThinking(true);
    setError("");
    setDrafts([]);
    setSkipped([]);
    try {
      const res = await fetch("/api/customers/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected.size ? { handles: [...selected] } : {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Suggestions failed");
      setDrafts((json.suggestions as Suggestion[]).map((s) => ({ ...s, kind: s.proposal.kind, value: s.proposal.value, text: s.message })));
      setSkipped(json.skipped);
      if (!json.suggestions.length && !json.skipped.length) setError("No loyal customers without a reward yet. Pick customers in the table first.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setThinking(false);
    }
  }

  const patch = (i: number, p: Partial<Draft>) => setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...p } : d)));

  async function give(i: number, send: boolean) {
    const d = drafts[i];
    patch(i, { state: "sending", error: undefined });
    const res = await fetch("/api/rewards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle: d.customer.handle, kind: d.kind, value: d.value, giftVariantId: d.kind === "gift" ? d.proposal.giftVariantId : undefined,
        message: d.text, reason: d.reason, code: d.code, send,
      }),
    });
    const json = await res.json();
    if (!res.ok) return patch(i, { state: undefined, error: json.error?.message ?? "Could not give reward" });
    patch(i, { state: "done", result: json });
    load();
  }

  async function rewardAction(code: string, action: "cancel" | "sent_manually") {
    const res = await fetch(`/api/rewards/${code}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    if (!res.ok) setError((await res.json()).error?.message ?? "Update failed");
    load();
  }

  const s = summary;

  return (
    <main>
      <nav className="nav"><Link href="/">Home</Link><Link href="/inbox">Inbox</Link><Link href="/catalogue">Catalogue</Link><Link href="/dashboard">Dashboard</Link><span>Customers</span></nav>
      <div className="row" style={{ justifyContent: "space-between", marginTop: 0 }}>
        <div>
          <h1>Your loyal customers</h1>
          <p className="sub" style={{ marginBottom: 0 }}>Everyone who has bought from you, wherever they found you, and who deserves a thank-you.</p>
        </div>
        <div className="seg" role="group" aria-label="Where they bought">
          {(["all", "facebook", "instagram", "whatsapp"] as const).map((x) => (
            <button key={x} className={x === source ? "on" : ""} onClick={() => { setSource(x); setSelected(new Set()); }}>
              {x === "all" ? "All" : SOURCE_LABEL[x]}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="err">{error}</p>}

      {s && (
        <section className="kpis">
          <div className="hero">
            <div className="label">Revenue from repeat customers</div>
            <div className="value">{naira(s.repeatRevenueNaira)}</div>
            <div className="gloss">of {naira(s.revenueNaira)} from {s.customers} paying customer{s.customers === 1 ? "" : "s"}</div>
          </div>
          <Stat label="Came back to buy again" value={`${s.repeatRate}%`} sub={`${s.repeatCustomers} repeat customer${s.repeatCustomers === 1 ? "" : "s"}`} />
          <Stat label="VIP and loyal" value={String(s.vip + s.loyal)} sub={`${s.vip} VIP · ${s.loyal} loyal`} />
          <Stat label="Going quiet" value={String(s.lapsing)} sub={`loyal, no purchase in ${rules?.lapsingDays ?? 45}+ days`} />
        </section>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", marginTop: 0 }}>
          <div>
            <strong>Customers</strong>
            {rules && (
              <p className="gloss" style={{ margin: "2px 0 0" }}>
                Returning: 2 paid orders · Loyal: {rules.loyalOrders}+ orders or {naira(rules.loyalSpendNaira)}+ · VIP: {rules.vipOrders}+ orders or {naira(rules.vipSpendNaira)}+
              </p>
            )}
          </div>
          <button onClick={suggest} disabled={thinking || customers.length === 0}>
            {thinking ? "Muse Spark is choosing rewards…" : selected.size ? `Suggest rewards for ${selected.size} selected` : "Suggest rewards for loyal customers"}
          </button>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th></th><th>Customer</th><th>Tier</th><th>Bought through</th><th className="n">Paid orders</th><th className="n">Spent</th>
                <th>Favourite</th><th>Last purchase</th><th>Reward</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.handle}>
                  <td><input type="checkbox" aria-label={`Select ${c.name}`} checked={selected.has(c.handle)} onChange={() => toggle(c.handle)} disabled={c.tier === "unpaid"} /></td>
                  <td>
                    <strong>{c.name}</strong>{c.isDemo && <span className="gloss"> demo</span>}
                    <div className="gloss">
                      {c.reachableOnWhatsApp ? `+${c.handle}` : c.handle}
                      {c.alsoKnownAs.length > 0 && ` · first seen as ${c.alsoKnownAs.map((a) => `“${a}”`).join(", ")}`}
                    </div>
                  </td>
                  <td><span className={`tag tier-${c.tier}`}>{TIER_LABEL[c.tier]}</span>{c.lapsing && <span className="tag tier-lapsing">Going quiet</span>}</td>
                  <td>{c.sources.map((x) => SOURCE_LABEL[x]).join(", ")}</td>
                  <td className="n">{c.paidOrders}{c.unpaidOrders ? <span className="gloss"> +{c.unpaidOrders} unpaid</span> : null}</td>
                  <td className="n strong">{naira(c.spentNaira)}</td>
                  <td><div className="cap">{c.favouriteProduct ?? "–"}</div></td>
                  <td>{ago(c.lastPaidAt ?? c.lastOrderAt)}</td>
                  <td>{c.activeReward ? <code>{c.activeReward.code}</code> : <span className="gloss">–</span>}</td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={9} className="gloss">No customers yet. They appear here once a buyer confirms an order on WhatsApp or you mark one paid.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {(drafts.length > 0 || skipped.length > 0) && (
        <section style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>Suggested rewards</h2>
          <p className="gloss" style={{ marginTop: 0 }}>
            Muse Spark picked each reward within your limits and wrote the thank-you. The reward line is fixed text from your rules, so it never invents an amount. Edit anything before you send.
          </p>
          {skipped.map((x) => <p key={x.handle} className="gloss">Skipped: {x.why}</p>)}
          <div className="grid">
            {drafts.map((d, i) => (
              <div key={d.customer.handle} className="panel">
                <div className="row" style={{ justifyContent: "space-between", marginTop: 0 }}>
                  <strong>{d.customer.name}</strong>
                  <span>
                    <span className={`tag tier-${d.customer.tier}`}>{TIER_LABEL[d.customer.tier]}</span>
                    {d.customer.lapsing && <span className="tag tier-lapsing">Going quiet</span>}
                  </span>
                </div>
                <p className="gloss" style={{ margin: "4px 0 10px" }}>{d.reason}</p>

                <div className="row">
                  <select value={d.kind} onChange={(e) => patch(i, { kind: e.target.value as RewardKind, value: e.target.value === "percent_off" ? Math.min(d.value || 5, rules?.maxPercentOff ?? 10) : e.target.value === "amount_off" ? 2000 : 0 })} disabled={d.state === "done"}>
                    <option value="percent_off">Percent off</option>
                    <option value="amount_off">Amount off</option>
                    <option value="free_delivery">Free delivery</option>
                    {d.proposal.kind === "gift" && <option value="gift">Free gift</option>}
                  </select>
                  {(d.kind === "percent_off" || d.kind === "amount_off") && (
                    <input className="text" style={{ maxWidth: 120 }} type="number" min={d.kind === "percent_off" ? 1 : 500} step={d.kind === "percent_off" ? 1 : 500}
                      max={d.kind === "percent_off" ? rules?.maxPercentOff : undefined} value={d.value} disabled={d.state === "done"}
                      onChange={(e) => patch(i, { value: Number(e.target.value) })} aria-label={d.kind === "percent_off" ? "Percent" : "Naira amount"} />
                  )}
                  <span className="gloss">{d.kind === "percent_off" ? `max ${rules?.maxPercentOff ?? 10}%` : d.kind === "amount_off" ? "capped at 10% of their average order" : ""}</span>
                </div>
                {d.adjusted && <p className="flag" style={{ fontSize: 13 }}>Adjusted: {d.adjusted}</p>}

                <textarea style={{ minHeight: 90, marginTop: 10 }} value={d.text} onChange={(e) => patch(i, { text: e.target.value })} disabled={d.state === "done"} aria-label="Thank-you message" />
                <p className="draft" style={{ marginTop: 8, fontSize: 14 }}>
                  🎁 Your reward: {d.kind === "gift" ? d.preview.split("🎁 Your reward: ")[1]?.split(". It's applied")[0] : describeReward({ kind: d.kind, value: d.value }, [])}. It&apos;s applied automatically when you order with us on WhatsApp (ref {d.code}).
                </p>
                <ChecksLine report={d.checks} />

                {d.error && <p className="err">{d.error}</p>}
                {d.state !== "done" ? (
                  <div className="row">
                    {d.customer.canMessageNow && whatsappConnected ? (
                      <button onClick={() => give(i, true)} disabled={d.state === "sending"}>Give reward &amp; send on WhatsApp</button>
                    ) : (
                      <button onClick={() => give(i, true)} disabled={d.state === "sending"}>Give reward</button>
                    )}
                    {!d.customer.canMessageNow && <span className="gloss">They haven&apos;t messaged in 24 hours, so you&apos;ll send it from your own WhatsApp.</span>}
                  </div>
                ) : (
                  d.result && <IssuedBox r={d.result} onSent={() => rewardAction(d.result!.reward.code, "sent_manually")} />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <strong>Rewards given</strong>
        <p className="gloss" style={{ marginTop: 2 }}>When the customer next orders on WhatsApp, the sales agent applies the reward and the order total drops automatically. It counts as used once the order is paid.</p>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Code</th><th>Customer</th><th>Reward</th><th>Status</th><th>Given</th><th>Expires</th><th>Used on</th><th></th></tr></thead>
            <tbody>
              {rewards.map((r) => (
                <tr key={r.code}>
                  <td><code>{r.code}</code></td>
                  <td>{r.customerName ?? r.customerHandle}</td>
                  <td>{r.description}</td>
                  <td><span className={`status ${r.status === "redeemed" ? "paid" : r.status === "cancelled" ? "cancelled" : "confirmed"}`}>{r.status === "issued" ? "unused" : r.status === "redeemed" ? "used" : "cancelled"}</span>{r.sentVia && <div className="gloss">{r.sentVia === "whatsapp_api" ? "sent on WhatsApp" : "sent by you"}</div>}</td>
                  <td>{ago(r.createdAt)}</td>
                  <td>{new Date(r.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
                  <td>{r.redeemedOrderRef ? <code>{r.redeemedOrderRef}</code> : "–"}</td>
                  <td className="actions">{r.status === "issued" && <button className="ghost" onClick={() => rewardAction(r.code, "cancel")}>Cancel</button>}</td>
                </tr>
              ))}
              {rewards.length === 0 && <tr><td colSpan={8} className="gloss">No rewards yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
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

function ChecksLine({ report }: { report: CheckReport }) {
  const failed = report.checks.filter((c) => !c.ok);
  if (!failed.length) return <p className="ok" style={{ fontSize: 13, margin: "6px 0 0" }}>✓ All {report.checks.length} message checks passed</p>;
  return (
    <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13 }}>
      {failed.map((c) => <li key={c.id} className={c.severity === "block" ? "flag" : "gloss"}>{c.label}{c.detail ? `: ${c.detail}` : ""}</li>)}
    </ul>
  );
}

function IssuedBox({ r, onSent }: { r: IssueResult; onSent: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ marginTop: 10 }}>
      <p className="ok" style={{ margin: 0 }}>
        {r.delivered ? `✓ Reward ${r.reward.code} given and sent on WhatsApp.` : `✓ Reward ${r.reward.code} given.`}
      </p>
      {r.adjusted && <p className="gloss">Adjusted: {r.adjusted}</p>}
      {!r.delivered && (
        <>
          {r.note && <p className="gloss">{r.note}</p>}
          <div className="row">
            {r.waLink && <a href={r.waLink} target="_blank" rel="noopener noreferrer" onClick={onSent}><button>Open WhatsApp</button></a>}
            <button className="ghost" onClick={async () => { await navigator.clipboard.writeText(r.fullMessage).catch(() => {}); setCopied(true); onSent(); }}>{copied ? "Copied" : "Copy message"}</button>
          </div>
        </>
      )}
    </div>
  );
}
