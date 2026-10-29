"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { runChecks, type CheckReport } from "@/agent/checks";
import type { EnquiryRecord } from "@/domain/types";

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
const CHANNEL: Record<string, string> = { whatsapp: "WhatsApp", instagram_comment: "Instagram", facebook_comment: "Facebook", manual_import: "Imported" };
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
  const [busy, setBusy] = useState<"" | "import" | "voice" | "draft" | "send">("");
  const [needsForce, setNeedsForce] = useState(false);
  const [autopilot, setAutopilotState] = useState(false);
  const [settings, setSettings] = useState<{ whatsappConnected: boolean; appUrl: string }>({ whatsappConnected: false, appUrl: "" });

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState(SAMPLE);
  const [importPost, setImportPost] = useState("post_ig_bs01");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/enquiries", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not load inbox");
      setEnquiries(json.enquiries);
      setPosts(json.posts);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000); // new WhatsApp messages and drafts appear on their own
    return () => clearInterval(t);
  }, [load]);

  const selected = enquiries.find((e) => e.id === selectedId) ?? null;

  // Keep the editor in sync with the saved draft unless the vendor is editing it.
  useEffect(() => {
    if (!selected) return;
    if (!dirty) setDraftText(selected.draftReply ?? "");
  }, [selected?.id, selected?.draftReply]); // eslint-disable-line react-hooks/exhaustive-deps

  function select(id: string) {
    setSelectedId(id);
    setDirty(false);
    setNeedsForce(false);
    setNotice("");
    setError("");
    const e = enquiries.find((x) => x.id === id);
    setDraftText(e?.draftReply ?? "");
  }

  const visible = useMemo(() => {
    const list = enquiries.filter((e) =>
      filter === "all" ? true : filter === "replied" ? e.status === "replied" : ["new", "drafted", "escalated"].includes(e.status),
    );
    return filter === "open" ? [...list].sort((a, b) => b.priority - a.priority || b.receivedAt.localeCompare(a.receivedAt)) : list;
  }, [enquiries, filter]);

  const counts = useMemo(
    () => ({
      open: enquiries.filter((e) => ["new", "drafted", "escalated"].includes(e.status)).length,
      buyers: enquiries.filter((e) => e.intent === "ready_to_buy" && e.status !== "replied").length,
    }),
    [enquiries],
  );

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setAutopilotState(Boolean(j.autopilot));
        setSettings({ whatsappConnected: Boolean(j.whatsappConnected), appUrl: j.appUrl ?? "" });
      })
      .catch(() => {});
  }, []);

  async function toggleAutopilot() {
    const next = !autopilot;
    setAutopilotState(next);
    const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ autopilot: next }) });
    if (!res.ok) setAutopilotState(!next);
    else setNotice(next ? "Autopilot on: low-risk WhatsApp answers that pass every check will send themselves." : "Autopilot off: every reply waits for you.");
  }

  // The saved checks, or a fresh run on the vendor's edit (stock is re-checked on the server when sending).
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
      appUrl: settings.appUrl || (typeof window !== "undefined" ? window.location.origin : ""),
    });
  }, [draftText, dirty, selected?.draftMeta, selected?.intent, selected?.language, settings.appUrl]);

  async function importComments() {
    setBusy("import");
    setError("");
    try {
      const messages = importText.split("\n").map((t) => t.trim()).filter(Boolean).map((text) => ({ text }));
      const res = await fetch("/api/enquiries/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, postId: importPost || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Import failed");
      if (json.errors?.length) setError(json.errors.join("; "));
      setNotice(`Imported ${json.inserted.length} messages and triaged ${json.triaged}.`);
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
      setNotice(`🎙 Transcribed by Muse Voice Transcribe in ${(json.timings.transcribe / 1000).toFixed(1)}s`);
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
      const res = await fetch(`/api/enquiries/${selected.id}/draft`, { method: "POST" });
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
      if (selected.channel !== "whatsapp") await navigator.clipboard.writeText(draftText).catch(() => {});
      const res = await fetch(`/api/enquiries/${selected.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draftText, force }),
      });
      const json = await res.json();
      if (res.status === 422) {
        setNeedsForce(true);
        throw new Error(`${json.error.message}. Edit the reply, or send anyway if you're sure.`);
      }
      if (!res.ok) throw new Error(json.error?.message ?? "Send failed");
      setNeedsForce(false);
      setDirty(false);
      setNotice(json.result.delivered ? "✓ Sent on WhatsApp" : json.result.note);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function dismiss(status: "ignored" | "new") {
    if (!selected) return;
    await fetch(`/api/enquiries/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    await load();
  }

  return (
    <main>
      <nav className="nav"><span>Inbox</span><Link href="/catalogue">Catalogue</Link><Link href="/dashboard">Dashboard</Link></nav>
      <h1>SellAI</h1>
      <p className="sub">Comments, DMs and voice notes from every channel. Buyers first, replies drafted from your real catalogue.</p>
      {error && <p className="err">{error}</p>}
      {notice && <p className="ok">{notice}</p>}

      <div className="grid">
        <section className="panel">
          <div className="autopilot">
            <button className={`switch ${autopilot ? "on" : ""}`} role="switch" aria-checked={autopilot} onClick={toggleAutopilot}>
              <span className="knob" />
            </button>
            <div>
              <strong>Autopilot {autopilot ? "on" : "off"}</strong>
              <div className="gloss">
                {autopilot
                  ? "Price, delivery and stock answers on WhatsApp send themselves when every check passes. Orders and complaints wait for you."
                  : "Every reply waits for your approval."}
                {autopilot && !settings.whatsappConnected && " WhatsApp isn't connected yet, so auto-sent replies are marked sent but not delivered."}
              </div>
            </div>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="seg" role="group" aria-label="Filter">
              <button className={filter === "open" ? "on" : ""} onClick={() => setFilter("open")}>Needs reply ({counts.open})</button>
              <button className={filter === "replied" ? "on" : ""} onClick={() => setFilter("replied")}>Replied</button>
              <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>All</button>
            </div>
            <button className="ghost" onClick={() => setShowImport((v) => !v)}>{showImport ? "Close" : "Import / voice note"}</button>
          </div>
          {counts.buyers > 0 && <p className="gloss" style={{ marginBottom: 0 }}>🔥 {counts.buyers} ready-to-buy message{counts.buyers > 1 ? "s" : ""} waiting</p>}

          {showImport && (
            <div className="importbox">
              <label className="field">
                Which post are these from?
                <select className="text" value={importPost} onChange={(e) => setImportPost(e.target.value)}>
                  <option value="">No post (direct messages)</option>
                  {posts.map((p) => <option key={p.id} value={p.id}>{p.caption || p.id}</option>)}
                </select>
              </label>
              <label className="field">
                Paste comments, one per line
                <textarea value={importText} onChange={(e) => setImportText(e.target.value)} />
              </label>
              <div className="row">
                <button onClick={importComments} disabled={busy !== ""}>{busy === "import" ? "Triaging…" : "Import and triage"}</button>
              </div>
              <div className="voice">
                <strong>Voice note</strong>
                <p className="gloss">Upload a WhatsApp voice note (.ogg, .opus, .m4a, .mp3, .wav). It's transcribed, triaged and drafted like a text.</p>
                <input type="file" accept="audio/*,.ogg,.opus" disabled={busy !== ""} onChange={(e) => sendVoiceNote(e.target.files?.[0] ?? null)} />
                {busy === "voice" && <p className="gloss">Transcribing and drafting…</p>}
              </div>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            {visible.map((m) => (
              <div key={m.id} className={`item ${selectedId === m.id ? "active" : ""}`} onClick={() => select(m.id)}>
                <div className="meta">
                  {m.intent ? <span className={`tag ${m.intent}`}>{LABEL[m.intent] ?? m.intent}</span> : <span className="tag">Triaging…</span>}
                  <span className="tag">{CHANNEL[m.channel] ?? m.channel}</span>
                  {m.transcribedFromVoice && <span className="tag">🎙 voice</span>}
                  {m.orderRef && <span className="tag order">{m.orderRef}</span>}
                  {m.status === "drafted" && <span className="tag drafted">Draft ready</span>}
                  {m.status === "escalated" && <span className="tag complaint">Needs you</span>}
                  {m.status === "replied" && (m.autoSent ? <span className="tag auto">🤖 Auto-sent</span> : <span className="tag">✓ Replied</span>)}
                  <span className="when">{m.authorName || m.authorHandle || ""} · {ago(m.receivedAt)}</span>
                </div>
                <div>{m.text}</div>
                {m.englishGloss && m.englishGloss !== m.text && <div className="gloss">{m.englishGloss}</div>}
              </div>
            ))}
            {visible.length === 0 && (
              <p className="gloss">
                {enquiries.length === 0 ? "No messages yet. Import comments, upload a voice note, or connect the WhatsApp webhook." : "Nothing here."}
              </p>
            )}
          </div>
        </section>

        <section className="panel">
          <strong>Reply</strong>
          {!selected && <p className="gloss">Pick a message.</p>}
          {selected && (
            <>
              <p className="gloss" style={{ marginBottom: 6 }}>
                {CHANNEL[selected.channel]} · {selected.authorName || selected.authorHandle || "unknown sender"}
                {selected.postId ? ` · on “${posts.find((p) => p.id === selected.postId)?.caption || selected.postId}”` : ""}
              </p>
              <blockquote>{selected.text}</blockquote>

              {selected.status === "replied" ? (
                <>
                  <div className="draft">{selected.replyText}</div>
                  <p className="gloss">
                    {selected.autoSent ? "🤖 Sent by autopilot" : "Replied"} {selected.repliedAt ? ago(selected.repliedAt) : ""}
                    {selected.draftMeta?.autopilot && selected.autoSent ? ` · ${selected.draftMeta.autopilot.reason.toLowerCase()}` : ""}
                  </p>
                  {selected.draftMeta?.checks && <ChecksList report={selected.draftMeta.checks} />}
                </>
              ) : (
                <>
                  {!selected.draftReply && (
                    <div className="row">
                      <button onClick={draft} disabled={busy !== ""}>{busy === "draft" ? "Checking catalogue, stock and delivery…" : "Draft reply"}</button>
                      {selected.status !== "ignored" ? (
                        <button className="ghost" onClick={() => dismiss("ignored")}>Dismiss</button>
                      ) : (
                        <button className="ghost" onClick={() => dismiss("new")}>Restore</button>
                      )}
                    </div>
                  )}

                  {selected.draftReply && (
                    <>
                      <textarea
                        className="editor"
                        value={draftText}
                        onChange={(e) => {
                          setDraftText(e.target.value);
                          setDirty(true);
                          setNeedsForce(false);
                        }}
                      />
                      {liveChecks && <ChecksList report={liveChecks} edited={dirty} />}
                      {selected.draftMeta?.autopilot && (
                        <p className={`gloss autopilot-line ${selected.draftMeta.autopilot.eligible ? "yes" : ""}`}>
                          🤖 Autopilot: {selected.draftMeta.autopilot.eligible ? "would send this on its own" : selected.draftMeta.autopilot.reason}
                        </p>
                      )}
                      <p style={{ margin: "6px 0" }} className="gloss">
                        {selected.draftMeta?.repaired && <span>agent self-corrected once · </span>}
                        {selected.draftMeta?.source === "template" && <span>order confirmation, figures from the order</span>}
                        {selected.draftMeta?.source === "agent" && selected.draftMeta.historyMessages !== undefined && (
                          <span>{selected.draftMeta.historyMessages ? `remembered ${selected.draftMeta.historyMessages} earlier message${selected.draftMeta.historyMessages > 1 ? "s" : ""} in this chat` : "first message in this chat"}</span>
                        )}
                      </p>
                      {selected.status === "escalated" && <p className="flag">Escalated: this one needs your personal attention.</p>}
                      {selected.orderRef && <p className="gloss">Order <strong>{selected.orderRef}</strong> · <Link href="/dashboard">see it on the dashboard</Link></p>}
                      <div className="row">
                        <button onClick={() => approve(false)} disabled={busy !== "" || !draftText.trim()}>
                          {busy === "send" ? "Sending…" : selected.channel === "whatsapp" ? "Approve & send on WhatsApp" : "Approve & copy"}
                        </button>
                        {needsForce && <button className="ghost" onClick={() => approve(true)}>Send anyway</button>}
                        <button className="ghost" onClick={draft} disabled={busy !== ""}>{busy === "draft" ? "Redrafting…" : "Redraft"}</button>
                      </div>
                      {selected.draftMeta && selected.draftMeta.steps.length > 0 && (
                        <details className="trace">
                          <summary>How this reply was built ({selected.draftMeta.steps.length} tool calls)</summary>
                          {selected.draftMeta.steps.map((s, i) => <div key={i}>→ {s.tool}({JSON.stringify(s.args)})</div>)}
                          <div>{selected.draftMeta.model} · {selected.draftMeta.usage.prompt_tokens}+{selected.draftMeta.usage.completion_tokens} tokens</div>
                        </details>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function ChecksList({ report, edited }: { report: CheckReport; edited?: boolean }) {
  const failed = report.checks.filter((c) => !c.ok);
  return (
    <details className="checks" open={failed.length > 0}>
      <summary>
        {report.clean ? (
          <span className="ok">✓ All {report.checks.length} checks passed</span>
        ) : report.passed ? (
          <span className="warnc">✓ Safe to send · {failed.length} warning{failed.length > 1 ? "s" : ""}</span>
        ) : (
          <span className="flag">✗ Held: {failed.filter((c) => c.severity === "block").length} check{failed.filter((c) => c.severity === "block").length > 1 ? "s" : ""} failed</span>
        )}
        {edited && <span className="gloss"> · rechecked after your edit</span>}
      </summary>
      <ul>
        {report.checks.map((c) => (
          <li key={c.id} className={c.ok ? "pass" : c.severity === "block" ? "fail" : "warn"}>
            <span aria-hidden>{c.ok ? "✓" : c.severity === "block" ? "✗" : "!"}</span> {c.label}
            {c.detail && <span className="gloss"> · {c.detail}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}
