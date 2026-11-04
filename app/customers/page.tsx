"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { Reward, RewardKind } from "@/domain/types";
import type { Customer, LoyaltySummary, Source } from "@/loyalty/customers";
import { describeReward, TIER_LABEL, type LoyaltyRules } from "@/loyalty/rules";
import type { Suggestion } from "@/loyalty/suggest";
import SellerShell from "../../components/seller/SellerShell";
import AnalyticsTabs from "../../components/seller/AnalyticsTabs";
import PageHeader from "../../components/seller/PageHeader";
import Panel from "../../components/seller/Panel";
import Segmented from "../../components/seller/Segmented";
import Notice from "../../components/seller/Notice";
import StatCard from "../../components/seller/StatCard";
import StatusPill from "../../components/seller/StatusPill";
import Tag, { type TagTone } from "../../components/seller/Tag";
import ChecksLine from "../../components/customers/ChecksLine";
import IssuedBox, {
  type IssueResult,
} from "../../components/customers/IssuedBox";
import {
  btn,
  btnSmGhost,
  code,
  fieldLabel,
  input,
  muted,
  table,
  tableWrap,
  td,
  tdNum,
  textarea,
  th,
  thNum,
} from "../../components/seller/styles";

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const SOURCE_LABEL: Record<Source, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  other: "Other",
};
const ago = (iso?: string) => {
  if (!iso) return "–";
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

type RewardRow = Reward & { description: string };
type Draft = Suggestion & {
  kind: RewardKind;
  value: number;
  text: string;
  state?: "sending" | "done";
  result?: IssueResult;
  error?: string;
};
const TIER_TONE: Record<string, TagTone> = {
  unpaid: "grey",
  new: "sand",
  returning: "mint",
  loyal: "solidGreen",
  vip: "yellow",
};

export default function CustomersPage() {
  const [source, setSource] = useState<Source | "all">("all");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<LoyaltySummary | null>(null);
  const [rules, setRules] = useState<LoyaltyRules | null>(null);
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [skipped, setSkipped] = useState<
    Array<{ handle: string; why: string }>
  >([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/customers${source === "all" ? "" : `?source=${source}`}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error?.message ?? "Could not load customers");
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
      setDrafts(
        (json.suggestions as Suggestion[]).map((s) => ({
          ...s,
          kind: s.proposal.kind,
          value: s.proposal.value,
          text: s.message,
        })),
      );
      setSkipped(json.skipped);
      if (!json.suggestions.length && !json.skipped.length)
        setError(
          "No loyal customers without a reward yet. Pick customers in the table first.",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setThinking(false);
    }
  }

  const patch = (i: number, p: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...p } : d)));

  async function give(i: number, send: boolean) {
    const d = drafts[i];
    patch(i, { state: "sending", error: undefined });
    const res = await fetch("/api/rewards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle: d.customer.handle,
        kind: d.kind,
        value: d.value,
        giftVariantId: d.kind === "gift" ? d.proposal.giftVariantId : undefined,
        message: d.text,
        reason: d.reason,
        code: d.code,
        send,
      }),
    });
    const json = await res.json();
    if (!res.ok)
      return patch(i, {
        state: undefined,
        error: json.error?.message ?? "Could not give reward",
      });
    patch(i, { state: "done", result: json });
    load();
  }

  async function rewardAction(
    code: string,
    action: "cancel" | "sent_manually",
  ) {
    const res = await fetch(`/api/rewards/${code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) setError((await res.json()).error?.message ?? "Update failed");
    load();
  }

  const s = summary;

  const sourceOptions = (
    ["all", "facebook", "instagram", "whatsapp"] as const
  ).map((x) => ({ value: x, label: x === "all" ? "All" : SOURCE_LABEL[x] }));

  return (
    <SellerShell>
      <AnalyticsTabs />
      <PageHeader
        title="Your loyal customers"
        description="Everyone who has bought from you, wherever they found you, and who deserves a thank-you."
        actions={
          <Segmented
            ariaLabel="Where they bought"
            options={sourceOptions}
            value={source}
            onChange={(x) => {
              setSource(x);
              setSelected(new Set());
            }}
          />
        }
      />

      {error && <Notice tone="error">{error}</Notice>}

      {s && (
        <div className="flex flex-wrap gap-4">
          <StatCard
            hero
            label="Revenue from repeat customers"
            value={naira(s.repeatRevenueNaira)}
            sub={`of ${naira(s.revenueNaira)} from ${s.customers} paying customer${s.customers === 1 ? "" : "s"}`}
          />
          <StatCard
            label="Came back to buy again"
            value={`${s.repeatRate}%`}
            sub={`${s.repeatCustomers} repeat customer${s.repeatCustomers === 1 ? "" : "s"}`}
          />
          <StatCard
            label="VIP and loyal"
            value={String(s.vip + s.loyal)}
            sub={`${s.vip} VIP · ${s.loyal} loyal`}
          />
          <StatCard
            label="Going quiet"
            value={String(s.lapsing)}
            sub={`Loyal, no purchase in ${rules?.lapsingDays ?? 45}+ days`}
          />
        </div>
      )}

      <Panel
        title="Customers"
        description={
          rules
            ? `Returning: 2 paid orders · Loyal: ${rules.loyalOrders}+ orders or ${naira(rules.loyalSpendNaira)}+ · VIP: ${rules.vipOrders}+ orders or ${naira(rules.vipSpendNaira)}+`
            : undefined
        }
        action={
          <button
            type="button"
            className={btn}
            onClick={suggest}
            disabled={thinking || customers.length === 0}
          >
            <Sparkles aria-hidden size={16} strokeWidth={2.4} />
            {thinking
              ? "Muse Spark is choosing rewards…"
              : selected.size
                ? `Suggest rewards for ${selected.size} selected`
                : "Suggest rewards for loyal customers"}
          </button>
        }
      >
        <div className={tableWrap}>
          <table className={`${table} min-w-[960px]`}>
            <thead>
              <tr>
                <th className={th}>
                  <span className="sr-only">Select</span>
                </th>
                <th className={th}>Customer</th>
                <th className={th}>Tier</th>
                <th className={th}>Bought through</th>
                <th className={thNum}>Paid orders</th>
                <th className={thNum}>Spent</th>
                <th className={th}>Favourite</th>
                <th className={th}>Last purchase</th>
                <th className={th}>Reward</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr
                  key={c.handle}
                  className={
                    selected.has(c.handle)
                      ? "bg-[#F3FAF6]"
                      : "hover:bg-[#FBFAF7]"
                  }
                >
                  <td className={td}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${c.name}`}
                      checked={selected.has(c.handle)}
                      onChange={() => toggle(c.handle)}
                      disabled={c.tier === "unpaid"}
                      className="size-[18px] cursor-pointer accent-[#2F7A5E] disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className={td}>
                    <div className="flex items-center gap-1.5 font-bold">
                      {c.name}
                      {c.isDemo && <Tag tone="grey">demo</Tag>}
                    </div>
                    <div className="mt-1 text-xs text-[#5C635E]">
                      {c.reachableOnWhatsApp ? `+${c.handle}` : c.handle}
                      {c.alsoKnownAs.length > 0 &&
                        ` · first seen as ${c.alsoKnownAs.map((a) => `“${a}”`).join(", ")}`}
                    </div>
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1.5">
                      <Tag tone={TIER_TONE[c.tier] ?? "sand"}>
                        {TIER_LABEL[c.tier]}
                      </Tag>
                      {c.lapsing && <Tag tone="clay">Going quiet</Tag>}
                    </div>
                  </td>
                  <td className={td}>
                    {c.sources.map((x) => SOURCE_LABEL[x]).join(", ")}
                  </td>
                  <td className={tdNum}>
                    {c.paidOrders}
                    {c.unpaidOrders ? (
                      <span className="text-xs text-[#5C635E]">
                        {" "}
                        +{c.unpaidOrders} unpaid
                      </span>
                    ) : null}
                  </td>
                  <td className={`${tdNum} font-bold text-[#1F5A44]`}>
                    {naira(c.spentNaira)}
                  </td>
                  <td className={td}>
                    <div className="line-clamp-2 max-w-[200px]">
                      {c.favouriteProduct ?? "–"}
                    </div>
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    {ago(c.lastPaidAt ?? c.lastOrderAt)}
                  </td>
                  <td className={td}>
                    {c.activeReward ? (
                      <code className={code}>{c.activeReward.code}</code>
                    ) : (
                      <span className="text-[#5C635E]">–</span>
                    )}
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className={`${td} text-center text-[#5C635E]`}
                  >
                    No customers yet. They appear here once a buyer confirms an
                    order on WhatsApp or you mark one paid.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {(drafts.length > 0 || skipped.length > 0) && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <h2 className="m-0 font-display text-[24px] font-bold tracking-[-0.6px]">
              Suggested rewards
            </h2>
            <p className={`m-0 max-w-[720px] ${muted}`}>
              Muse Spark picked each reward within your limits and wrote the
              thank-you. The reward line is fixed text from your rules, so it
              never invents an amount. Edit anything before you send.
            </p>
          </div>
          {skipped.map((x) => (
            <Notice key={x.handle} tone="info">
              Skipped: {x.why}
            </Notice>
          ))}
          <div className="flex flex-wrap gap-5">
            {drafts.map((d, i) => (
              <Panel
                key={d.customer.handle}
                className="w-full lg:w-[calc(50%-10px)]"
                title={d.customer.name}
                description={d.reason}
                action={
                  <div className="flex flex-wrap gap-1.5">
                    <Tag tone={TIER_TONE[d.customer.tier] ?? "sand"}>
                      {TIER_LABEL[d.customer.tier]}
                    </Tag>
                    {d.customer.lapsing && <Tag tone="clay">Going quiet</Tag>}
                  </div>
                }
              >
                <div className="flex flex-wrap items-end gap-2.5">
                  <label className={`${fieldLabel} min-w-[170px] flex-1`}>
                    Reward
                    <select
                      className={input}
                      value={d.kind}
                      onChange={(e) =>
                        patch(i, {
                          kind: e.target.value as RewardKind,
                          value:
                            e.target.value === "percent_off"
                              ? Math.min(
                                  d.value || 5,
                                  rules?.maxPercentOff ?? 10,
                                )
                              : e.target.value === "amount_off"
                                ? 2000
                                : 0,
                        })
                      }
                      disabled={d.state === "done"}
                    >
                      <option value="percent_off">Percent off</option>
                      <option value="amount_off">Amount off</option>
                      <option value="free_delivery">Free delivery</option>
                      {d.proposal.kind === "gift" && (
                        <option value="gift">Free gift</option>
                      )}
                    </select>
                  </label>
                  {(d.kind === "percent_off" || d.kind === "amount_off") && (
                    <label className={`${fieldLabel} w-[130px]`}>
                      {d.kind === "percent_off" ? "Percent" : "Amount (₦)"}
                      <input
                        className={input}
                        type="number"
                        min={d.kind === "percent_off" ? 1 : 500}
                        step={d.kind === "percent_off" ? 1 : 500}
                        max={
                          d.kind === "percent_off"
                            ? rules?.maxPercentOff
                            : undefined
                        }
                        value={d.value}
                        disabled={d.state === "done"}
                        onChange={(e) =>
                          patch(i, { value: Number(e.target.value) })
                        }
                      />
                    </label>
                  )}
                </div>
                {(d.kind === "percent_off" || d.kind === "amount_off") && (
                  <p className="m-0 -mt-1 text-xs text-[#5C635E]">
                    {d.kind === "percent_off"
                      ? `Max ${rules?.maxPercentOff ?? 10}%`
                      : "Capped at 10% of their average order"}
                  </p>
                )}
                {d.adjusted && (
                  <Notice tone="warning">Adjusted: {d.adjusted}</Notice>
                )}

                <label className={fieldLabel}>
                  Thank-you message
                  <textarea
                    className={`${textarea} min-h-[100px]`}
                    value={d.text}
                    onChange={(e) => patch(i, { text: e.target.value })}
                    disabled={d.state === "done"}
                  />
                </label>
                <p className="m-0 rounded-[18px_18px_4px_18px] bg-[#E2F3EA] px-4 py-3 text-sm leading-normal">
                  🎁 Your reward:{" "}
                  {d.kind === "gift"
                    ? d.preview
                        .split("🎁 Your reward: ")[1]
                        ?.split(". It's applied")[0]
                    : describeReward({ kind: d.kind, value: d.value }, [])}
                  . It&apos;s applied automatically when you order with us on
                  WhatsApp (ref {d.code}).
                </p>
                <ChecksLine report={d.checks} />

                {d.error && <Notice tone="error">{d.error}</Notice>}
                {d.state !== "done" ? (
                  <div className="flex flex-col gap-2">
                    <div>
                      <button
                        type="button"
                        className={btn}
                        onClick={() => give(i, true)}
                        disabled={d.state === "sending"}
                      >
                        {d.customer.canMessageNow && whatsappConnected
                          ? "Give reward and send on WhatsApp"
                          : "Give reward"}
                      </button>
                    </div>
                    {!d.customer.canMessageNow && (
                      <p className={`m-0 ${muted}`}>
                        They haven&apos;t messaged in 24 hours, so you&apos;ll
                        send it from your own WhatsApp.
                      </p>
                    )}
                  </div>
                ) : (
                  d.result && (
                    <IssuedBox
                      r={d.result}
                      onSent={() =>
                        rewardAction(d.result!.reward.code, "sent_manually")
                      }
                    />
                  )
                )}
              </Panel>
            ))}
          </div>
        </section>
      )}

      <Panel
        title="Rewards given"
        description="When the customer next orders on WhatsApp, the sales agent applies the reward and the order total drops automatically. It counts as used once the order is paid."
      >
        <div className={tableWrap}>
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Code</th>
                <th className={th}>Customer</th>
                <th className={th}>Reward</th>
                <th className={th}>Status</th>
                <th className={th}>Given</th>
                <th className={th}>Expires</th>
                <th className={th}>Used on</th>
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rewards.map((r) => (
                <tr key={r.code} className="hover:bg-[#FBFAF7]">
                  <td className={td}>
                    <code className={code}>{r.code}</code>
                  </td>
                  <td className={`${td} font-bold`}>
                    {r.customerName ?? r.customerHandle}
                  </td>
                  <td className={td}>{r.description}</td>
                  <td className={td}>
                    <StatusPill
                      status={
                        r.status === "redeemed"
                          ? "paid"
                          : r.status === "cancelled"
                            ? "cancelled"
                            : "confirmed"
                      }
                      label={
                        r.status === "issued"
                          ? "unused"
                          : r.status === "redeemed"
                            ? "used"
                            : "cancelled"
                      }
                    />
                    {r.sentVia && (
                      <div className="mt-1.5 text-xs text-[#5C635E]">
                        {r.sentVia === "whatsapp_api"
                          ? "sent on WhatsApp"
                          : "sent by you"}
                      </div>
                    )}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    {ago(r.createdAt)}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    {new Date(r.expiresAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td className={td}>
                    {r.redeemedOrderRef ? (
                      <code className={code}>{r.redeemedOrderRef}</code>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className={`${td} text-right`}>
                    {r.status === "issued" && (
                      <button
                        type="button"
                        className={btnSmGhost}
                        onClick={() => rewardAction(r.code, "cancel")}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rewards.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className={`${td} text-center text-[#5C635E]`}
                  >
                    No rewards yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </SellerShell>
  );
}
