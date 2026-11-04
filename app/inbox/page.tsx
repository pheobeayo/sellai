"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Check, Flame, Mic, Sparkles, Upload, X } from "lucide-react";
import { runChecks, type CheckReport } from "@/agent/checks";
import type { EnquiryRecord } from "@/domain/types";
import SellerShell from "../../components/seller/SellerShell";
import PageHeader from "../../components/seller/PageHeader";
import Panel from "../../components/seller/Panel";
import Segmented from "../../components/seller/Segmented";
import Notice from "../../components/seller/Notice";
import Switch from "../../components/seller/Switch";
import Tag, { type TagTone } from "../../components/seller/Tag";
import ChecksList from "../../components/inbox/ChecksList";
import {
  btn,
  btnGhost,
  fieldLabel,
  fileInput,
  input,
  muted,
  textarea,
} from "../../components/seller/styles";

const SAMPLE = `abeg how much be the bone straight 24 inches?
Beautiful 😍😍
Una dey deliver Ibadan?
I want 2 of the body wave 18 inches, deliver to Ikeja. How I go pay?
Make $500 daily from home, DM me for forex signals
E dey for 26 inches?
I paid since Monday, my wig never reach o
Elo ni? Mo fe ra`;

const LABEL: Record<string, string> = {
  ready_to_buy: "Ready to buy",
  complaint: "Complaint",
  price_enquiry: "Price",
  delivery_enquiry: "Delivery",
  availability_or_variant: "Stock / variant",
  product_question: "Product question",
  casual_engagement: "Casual",
  spam_or_irrelevant: "Spam",
};
const CHANNEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram_comment: "Instagram",
  facebook_comment: "Facebook",
  manual_import: "Imported",
};
const INTENT_TONE: Record<string, TagTone> = {
  ready_to_buy: "solidGreen",
  complaint: "clay",
  price_enquiry: "sand",
  delivery_enquiry: "sand",
  availability_or_variant: "sand",
  product_question: "sand",
  casual_engagement: "grey",
  spam_or_irrelevant: "grey",
};
type Filter = "open" | "replied" | "all";
type PostOpt = { id: string; channel: string; caption: string };

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Inbox() {
  const [enquiries, setEnquiries] = useState<EnquiryRecord[]>([]);
  const [posts, setPosts] = useState<PostOpt[]>([]);
  const [filter, setFilter] = useState<Filter>("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"" | "import" | "voice" | "draft" | "send">(
    "",
  );
  const [needsForce, setNeedsForce] = useState(false);
  const [autopilot, setAutopilotState] = useState(false);
  const [settings, setSettings] = useState<{
    whatsappConnected: boolean;
    appUrl: string;
  }>({ whatsappConnected: false, appUrl: "" });

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState(SAMPLE);
  const [importPost, setImportPost] = useState("post_ig_bs01");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/enquiries", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error?.message ?? "Could not load inbox");
      setEnquiries(json.enquiries);
      setPosts(json.posts);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const selected = enquiries.find((e) => e.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    if (!dirty) setDraftText(selected.draftReply ?? "");
  }, [selected?.id, selected?.draftReply]); // eslint-disable-line react-hooks/exhaustive-deps

  const replyRef = useRef<HTMLDivElement>(null);

  function select(id: string) {
    setSelectedId(id);
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches
    ) {
      setTimeout(
        () =>
          replyRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        50,
      );
    }
    setDirty(false);
    setNeedsForce(false);
    setNotice("");
    setError("");
    const e = enquiries.find((x) => x.id === id);
    setDraftText(e?.draftReply ?? "");
  }

  const visible = useMemo(() => {
    const list = enquiries.filter((e) =>
      filter === "all"
        ? true
        : filter === "replied"
          ? e.status === "replied"
          : ["new", "drafted", "escalated"].includes(e.status),
    );
    return filter === "open"
      ? [...list].sort(
          (a, b) =>
            b.priority - a.priority || b.receivedAt.localeCompare(a.receivedAt),
        )
      : list;
  }, [enquiries, filter]);

  const counts = useMemo(
    () => ({
      open: enquiries.filter((e) =>
        ["new", "drafted", "escalated"].includes(e.status),
      ).length,
      buyers: enquiries.filter(
        (e) => e.intent === "ready_to_buy" && e.status !== "replied",
      ).length,
    }),
    [enquiries],
  );

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setAutopilotState(Boolean(j.autopilot));
        setSettings({
          whatsappConnected: Boolean(j.whatsappConnected),
          appUrl: j.appUrl ?? "",
        });
      })
      .catch(() => {});
  }, []);

  async function toggleAutopilot() {
    const next = !autopilot;
    setAutopilotState(next);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autopilot: next }),
    });
    if (!res.ok) setAutopilotState(!next);
    else
      setNotice(
        next
          ? "Autopilot on: low-risk WhatsApp answers that pass every check will send themselves."
          : "Autopilot off: every reply waits for you.",
      );
  }

  const liveChecks: CheckReport | null = useMemo(() => {
    const m = selected?.draftMeta;
    if (!m) return null;
    if (!dirty && m.checks) return m.checks;
    return runChecks({
      reply: draftText,
      groundedAmounts: m.groundedAmounts,
      orderRefs: m.orderRefs,
      intent: selected?.intent,
      escalated: m.escalated,
      customerLanguage: selected?.language,
      appUrl:
        settings.appUrl ||
        (typeof window !== "undefined" ? window.location.origin : ""),
    });
  }, [
    draftText,
    dirty,
    selected?.draftMeta,
    selected?.intent,
    selected?.language,
    settings.appUrl,
  ]);

  async function importComments() {
    setBusy("import");
    setError("");
    try {
      const messages = importText
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean)
        .map((text) => ({ text }));
      const res = await fetch("/api/enquiries/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, postId: importPost || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Import failed");
      if (json.errors?.length) setError(json.errors.join("; "));
      setNotice(
        `Imported ${json.inserted.length} messages and triaged ${json.triaged}.`,
      );
      setShowImport(false);
      setFilter("open");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function sendVoiceNote(file: File | null) {
    if (!file) return;
    setBusy("voice");
    setError("");
    try {
      const form = new FormData();
      form.append("audio", file);
      if (importPost) form.append("postId", importPost);
      const res = await fetch("/api/voice", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Voice note failed");
      await load();
      select(json.enquiry.id);
      setNotice(
        `Transcribed by Muse Voice Transcribe in ${(json.timings.transcribe / 1000).toFixed(1)}s`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function draft() {
    if (!selected) return;
    setBusy("draft");
    setError("");
    setNeedsForce(false);
    try {
      const res = await fetch(`/api/enquiries/${selected.id}/draft`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Draft failed");
      setDirty(false);
      setDraftText(json.enquiry.draftReply ?? "");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function approve(force = false) {
    if (!selected) return;
    setBusy("send");
    setError("");
    setNotice("");
    try {
      if (selected.channel !== "whatsapp")
        await navigator.clipboard.writeText(draftText).catch(() => {});
      const res = await fetch(`/api/enquiries/${selected.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draftText, force }),
      });
      const json = await res.json();
      if (res.status === 422) {
        setNeedsForce(true);
        throw new Error(
          `${json.error.message}. Edit the reply, or send anyway if you're sure.`,
        );
      }
      if (!res.ok) throw new Error(json.error?.message ?? "Send failed");
      setNeedsForce(false);
      setDirty(false);
      setNotice(json.result.delivered ? "Sent on WhatsApp" : json.result.note);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function dismiss(status: "ignored" | "new") {
    if (!selected) return;
    await fetch(`/api/enquiries/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  const filterOptions: { value: Filter; label: string }[] = [
    { value: "open", label: `Needs reply (${counts.open})` },
    { value: "replied", label: "Replied" },
    { value: "all", label: "All" },
  ];
  const postCaption = selected?.postId
    ? posts.find((p) => p.id === selected.postId)?.caption || selected.postId
    : "";

  return (
    <SellerShell>
      <PageHeader
        title="Inbox"
        description="Comments, DMs and voice notes from every channel. Buyers first, replies drafted from your real catalogue."
        actions={
          <button
            type="button"
            className={showImport ? btn : btnGhost}
            onClick={() => setShowImport((v) => !v)}
          >
            {showImport ? (
              <X aria-hidden size={16} strokeWidth={2.4} />
            ) : (
              <Upload aria-hidden size={16} strokeWidth={2.4} />
            )}
            {showImport ? "Close import" : "Import or voice note"}
          </button>
        }
      />

      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
      <div
        className={`flex max-w-[720px] items-start gap-4 rounded-[24px] border p-5 ${autopilot ? "border-[#BFE3D0] bg-[#E2F3EA]" : "border-[#E3DACB] bg-white"}`}
      >
        <Switch
          checked={autopilot}
          onChange={toggleAutopilot}
          label="Autopilot"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <strong className="flex items-center gap-2 text-[15px]">
            <Bot aria-hidden size={17} strokeWidth={2.2} />
            Autopilot {autopilot ? "on" : "off"}
          </strong>
          <p className={`m-0 ${muted}`}>
            {autopilot
              ? "Price, delivery and stock answers on WhatsApp send themselves when every check passes. Orders and complaints wait for you."
              : "Every reply waits for your approval."}
            {autopilot &&
              !settings.whatsappConnected &&
              " WhatsApp isn't connected yet, so auto-sent replies are marked sent but not delivered."}
          </p>
        </div>
      </div>
      {showImport && (
        <Panel
          title="Bring in messages"
          description="Paste comments from a post, or upload a WhatsApp voice note. Everything is triaged and drafted like a live message."
        >
          <div className="flex flex-col gap-5 lg:flex-row">
            <div className="flex flex-1 flex-col gap-3.5">
              <label className={fieldLabel}>
                Which post are these from?
                <select
                  className={input}
                  value={importPost}
                  onChange={(e) => setImportPost(e.target.value)}
                >
                  <option value="">No post (direct messages)</option>
                  {posts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.caption || p.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className={fieldLabel}>
                Paste comments, one per line
                <textarea
                  className={`${textarea} min-h-[180px]`}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
              </label>
              <div>
                <button
                  type="button"
                  className={btn}
                  onClick={importComments}
                  disabled={busy !== ""}
                >
                  {busy === "import" ? "Triaging…" : "Import and triage"}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-[#D9CFBF] bg-[#FBFAF7] p-5 lg:w-[320px]">
              <strong className="flex items-center gap-2 text-[15px]">
                <Mic aria-hidden size={17} strokeWidth={2.2} />
                Voice note
              </strong>
              <p className={`m-0 ${muted}`}>
                Upload a WhatsApp voice note (.ogg, .opus, .m4a, .mp3, .wav).
                It’s transcribed, triaged and drafted like a text.
              </p>
              <input
                type="file"
                aria-label="Voice note file"
                accept="audio/*,.ogg,.opus"
                disabled={busy !== ""}
                onChange={(e) => sendVoiceNote(e.target.files?.[0] ?? null)}
                className={fileInput}
              />
              {busy === "voice" && (
                <p className={`m-0 ${muted}`}>Transcribing and drafting…</p>
              )}
            </div>
          </div>
        </Panel>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <Panel className="lg:w-[44%] lg:flex-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              ariaLabel="Filter messages"
              options={filterOptions}
              value={filter}
              onChange={setFilter}
            />
            {counts.buyers > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#9A3A16]">
                <Flame aria-hidden size={15} strokeWidth={2.4} />
                {counts.buyers} ready to buy
              </span>
            )}
          </div>

          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {visible.map((m) => {
              const active = selectedId === m.id;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => select(m.id)}
                    aria-current={active ? "true" : undefined}
                    className={`flex w-full cursor-pointer flex-col gap-2 rounded-2xl border-2 p-4 text-left transition ${
                      active
                        ? "border-forest bg-[#F3FAF6]"
                        : "border-transparent bg-[#F7F4EE] hover:border-[#E3DACB]"
                    }`}
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      {m.intent ? (
                        <Tag tone={INTENT_TONE[m.intent] ?? "sand"}>
                          {LABEL[m.intent] ?? m.intent}
                        </Tag>
                      ) : (
                        <Tag tone="grey">Triaging…</Tag>
                      )}
                      <Tag tone="grey">{CHANNEL[m.channel] ?? m.channel}</Tag>
                      {m.transcribedFromVoice && (
                        <Tag
                          tone="plum"
                          icon={<Mic aria-hidden size={11} strokeWidth={2.6} />}
                        >
                          Voice
                        </Tag>
                      )}
                      {m.orderRef && <Tag tone="ink">{m.orderRef}</Tag>}
                      {m.status === "drafted" && (
                        <Tag tone="mint">Draft ready</Tag>
                      )}
                      {m.status === "escalated" && (
                        <Tag tone="clay">Needs you</Tag>
                      )}
                      {m.status === "replied" &&
                        (m.autoSent ? (
                          <Tag
                            tone="yellow"
                            icon={
                              <Bot aria-hidden size={11} strokeWidth={2.6} />
                            }
                          >
                            Auto-sent
                          </Tag>
                        ) : (
                          <Tag
                            tone="green"
                            icon={
                              <Check aria-hidden size={11} strokeWidth={3} />
                            }
                          >
                            Replied
                          </Tag>
                        ))}
                    </span>
                    <span className="text-[15px] leading-normal text-[#15201B]">
                      {m.text}
                    </span>
                    {m.englishGloss && m.englishGloss !== m.text && (
                      <span className="text-[13px] italic leading-normal text-[#5C635E]">
                        {m.englishGloss}
                      </span>
                    )}
                    <span className="text-xs text-[#5C635E]">
                      {m.authorName || m.authorHandle || "Unknown"} ·{" "}
                      {ago(m.receivedAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {visible.length === 0 && (
            <p
              className={`m-0 rounded-2xl bg-[#F7F4EE] p-5 text-center ${muted}`}
            >
              {enquiries.length === 0
                ? "No messages yet. Import comments, upload a voice note, or connect the WhatsApp webhook."
                : "Nothing here."}
            </p>
          )}
        </Panel>
        <div
          ref={replyRef}
          className="min-w-0 flex-1 scroll-mt-20 lg:sticky lg:top-10"
        >
          <Panel title="Reply">
            {!selected && (
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-[#F7F4EE] px-6 py-12 text-center">
                <Sparkles
                  aria-hidden
                  size={22}
                  strokeWidth={2}
                  className="text-forest"
                />
                <p className={`m-0 ${muted}`}>
                  Pick a message to see its draft reply.
                </p>
              </div>
            )}

            {selected && (
              <>
                <p className={`m-0 ${muted}`}>
                  <strong className="text-[#15201B]">
                    {selected.authorName ||
                      selected.authorHandle ||
                      "Unknown sender"}
                  </strong>{" "}
                  on {CHANNEL[selected.channel]}
                  {postCaption ? ` · on “${postCaption}”` : ""}
                </p>
                <blockquote className="m-0 rounded-[18px_18px_18px_4px] bg-[#F7F4EE] px-4 py-3.5 text-[15px] leading-normal">
                  {selected.text}
                </blockquote>

                {selected.status === "replied" ? (
                  <>
                    <div className="ml-auto max-w-[92%] whitespace-pre-wrap rounded-[18px_18px_4px_18px] bg-[#E2F3EA] px-4 py-3.5 text-[15px] leading-normal">
                      {selected.replyText}
                    </div>
                    <p className={`m-0 flex items-center gap-1.5 ${muted}`}>
                      {selected.autoSent ? (
                        <Bot aria-hidden size={14} strokeWidth={2.4} />
                      ) : (
                        <Check aria-hidden size={14} strokeWidth={2.6} />
                      )}
                      {selected.autoSent ? "Sent by autopilot" : "Replied"}{" "}
                      {selected.repliedAt ? ago(selected.repliedAt) : ""}
                      {selected.draftMeta?.autopilot && selected.autoSent
                        ? ` · ${selected.draftMeta.autopilot.reason.toLowerCase()}`
                        : ""}
                    </p>
                    {selected.draftMeta?.checks && (
                      <ChecksList report={selected.draftMeta.checks} />
                    )}
                  </>
                ) : (
                  <>
                    {!selected.draftReply && (
                      <div className="flex flex-wrap gap-2.5">
                        <button
                          type="button"
                          className={btn}
                          onClick={draft}
                          disabled={busy !== ""}
                        >
                          {busy === "draft"
                            ? "Checking catalogue, stock and delivery…"
                            : "Draft reply"}
                        </button>
                        {selected.status !== "ignored" ? (
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={() => dismiss("ignored")}
                          >
                            Dismiss
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={() => dismiss("new")}
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    )}

                    {selected.draftReply && (
                      <>
                        <label className={fieldLabel}>
                          Draft reply
                          <textarea
                            className={`${textarea} min-h-[160px] bg-[#FBFAF7]`}
                            value={draftText}
                            onChange={(e) => {
                              setDraftText(e.target.value);
                              setDirty(true);
                              setNeedsForce(false);
                            }}
                          />
                        </label>
                        {liveChecks && (
                          <ChecksList report={liveChecks} edited={dirty} />
                        )}
                        {selected.draftMeta?.autopilot && (
                          <p
                            className={`m-0 flex items-center gap-1.5 text-[13px] ${selected.draftMeta.autopilot.eligible ? "font-bold text-[#1F5A44]" : "text-[#5C635E]"}`}
                          >
                            <Bot
                              aria-hidden
                              size={14}
                              strokeWidth={2.4}
                              className="flex-none"
                            />
                            Autopilot:{" "}
                            {selected.draftMeta.autopilot.eligible
                              ? "would send this on its own"
                              : selected.draftMeta.autopilot.reason}
                          </p>
                        )}
                        {(selected.draftMeta?.repaired ||
                          selected.draftMeta?.source) && (
                          <p className={`m-0 ${muted}`}>
                            {selected.draftMeta?.repaired && (
                              <span>Agent self-corrected once · </span>
                            )}
                            {selected.draftMeta?.source === "template" && (
                              <span>
                                Order confirmation, figures from the order
                              </span>
                            )}
                            {selected.draftMeta?.source === "agent" &&
                              selected.draftMeta.historyMessages !==
                                undefined && (
                                <span>
                                  {selected.draftMeta.historyMessages
                                    ? `Remembered ${selected.draftMeta.historyMessages} earlier message${selected.draftMeta.historyMessages > 1 ? "s" : ""} in this chat`
                                    : "First message in this chat"}
                                </span>
                              )}
                          </p>
                        )}
                        {selected.status === "escalated" && (
                          <Notice tone="warning">
                            Escalated: this one needs your personal attention.
                          </Notice>
                        )}
                        {selected.orderRef && (
                          <p className={`m-0 ${muted}`}>
                            Order{" "}
                            <strong className="text-[#15201B]">
                              {selected.orderRef}
                            </strong>{" "}
                            ·{" "}
                            <Link
                              href="/dashboard"
                              className="font-bold text-forest"
                            >
                              See it in Analytics
                            </Link>
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2.5">
                          <button
                            type="button"
                            className={btn}
                            onClick={() => approve(false)}
                            disabled={busy !== "" || !draftText.trim()}
                          >
                            {busy === "send"
                              ? "Sending…"
                              : selected.channel === "whatsapp"
                                ? "Approve and send on WhatsApp"
                                : "Approve and copy"}
                          </button>
                          {needsForce && (
                            <button
                              type="button"
                              className={`${btnGhost} border-[#B4471F] text-[#9A3A16]`}
                              onClick={() => approve(true)}
                            >
                              Send anyway
                            </button>
                          )}
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={draft}
                            disabled={busy !== ""}
                          >
                            {busy === "draft" ? "Redrafting…" : "Redraft"}
                          </button>
                        </div>
                        {selected.draftMeta &&
                          selected.draftMeta.steps.length > 0 && (
                            <details className="rounded-2xl bg-[#15201B] text-[#CDEBDC]">
                              <summary className="cursor-pointer px-4 py-3 text-[13px] font-bold text-[#F7F4EE]">
                                How this reply was built (
                                {selected.draftMeta.steps.length} tool calls)
                              </summary>
                              <div className="flex flex-col gap-1 overflow-x-auto px-4 pb-4 font-mono text-xs leading-relaxed">
                                {selected.draftMeta.steps.map((s, i) => (
                                  <div key={i} className="whitespace-nowrap">
                                    → {s.tool}({JSON.stringify(s.args)})
                                  </div>
                                ))}
                                <div className="pt-1 text-[#9FADA6]">
                                  {selected.draftMeta.model} ·{" "}
                                  {selected.draftMeta.usage.prompt_tokens}+
                                  {selected.draftMeta.usage.completion_tokens}{" "}
                                  tokens
                                </div>
                              </div>
                            </details>
                          )}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </Panel>
        </div>
      </div>
    </SellerShell>
  );
}
