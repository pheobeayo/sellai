"use client";

import Link from "next/link";
import { useState } from "react";
import type { TriagedMessage } from "@/agent/classify";
import type { AgentRun } from "@/agent/sales-agent";

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

export default function Inbox() {
  const [input, setInput] = useState(SAMPLE);
  const [items, setItems] = useState<TriagedMessage[]>([]);
  const [meta, setMeta] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<TriagedMessage | null>(null);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [voice, setVoice] = useState<{ text: string; ms: number } | null>(null);

  async function sendVoiceNote(file: File | null) {
    if (!file) return;
    setSelected(null);
    setRun(null);
    setVoice(null);
    setError("");
    setDrafting(true);
    try {
      const form = new FormData();
      form.append("audio", file);
      form.append("postId", "post_ig_bs01");
      const res = await fetch("/api/voice", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Voice note failed");
      setVoice({ text: json.transcript.text, ms: json.timings.transcribe });
      setSelected({ ...json.classification, text: json.transcript.text });
      setRun(json.run);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDrafting(false);
    }
  }

  async function triage() {
    setBusy(true);
    setError("");
    setSelected(null);
    setRun(null);
    try {
      const messages = input.split("\n").map((t) => t.trim()).filter(Boolean).map((text) => ({ text, postId: "post_ig_bs01" }));
      const res = await fetch("/api/classify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Triage failed");
      setItems(json.results);
      setMeta(`${json.provider} · ${json.model}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function draft(item: TriagedMessage) {
    setVoice(null);
    setSelected(item);
    setRun(null);
    setDrafting(true);
    setError("");
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: item.text, channel: "instagram_comment", postId: "post_ig_bs01" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Agent failed");
      setRun(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDrafting(false);
    }
  }

  const buyers = items.filter((i) => i.intent === "ready_to_buy").length;

  return (
    <main>
      <nav className="nav"><span>Inbox</span><Link href="/catalogue">Catalogue</Link></nav>
      <h1>SellAI</h1>
      <p className="sub">Paste comments or DMs. SellAI finds the buyers and drafts replies from your real catalogue.</p>
      {error && <p className="err">{error}</p>}

      <div className="grid">
        <section className="panel">
          <strong>Incoming messages</strong>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} aria-label="Messages, one per line" />
          <div className="row">
            <button onClick={triage} disabled={busy}>{busy ? "Triaging…" : "Triage"}</button>
            {items.length > 0 && <span className="gloss">{items.length} messages · {buyers} ready to buy · {meta}</span>}
          </div>

          <div className="voice">
            <strong>Voice note</strong>
            <p className="gloss">Upload a WhatsApp voice note (.ogg, .opus, .m4a, .mp3, .wav). It's transcribed, triaged and answered like a text.</p>
            <input type="file" accept="audio/*,.ogg,.opus" disabled={drafting} onChange={(e) => sendVoiceNote(e.target.files?.[0] ?? null)} />
          </div>

          <div style={{ marginTop: 12 }}>
            {items.map((m) => (
              <div key={m.id} className={`item ${selected?.id === m.id ? "active" : ""}`} onClick={() => draft(m)}>
                <span className={`tag ${m.intent}`}>{LABEL[m.intent]}</span>
                <span className="tag">{m.language}</span>
                <div>{m.text}</div>
                <div className="gloss">{m.english_gloss}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <strong>Draft reply</strong>
          {!selected && <p className="gloss">Pick a message to draft a reply.</p>}
          {voice && <p className="gloss">🎙 Transcribed by Muse Voice Transcribe in {(voice.ms / 1000).toFixed(1)}s</p>}
          {selected && <p className="gloss">Replying to: “{selected.text}”</p>}
          {drafting && <p className="gloss">Checking catalogue, stock and delivery…</p>}
          {run && (
            <>
              <div className="draft">{run.draftReply}</div>
              <p>
                {run.grounding.ok ? <span className="ok">✓ Every amount came from your catalogue</span> : <span className="flag">⚠ Unverified amounts: {run.grounding.ungrounded.join(", ")}</span>}
                {run.repaired && <span className="gloss"> · self-corrected once</span>}
              </p>
              {run.orderRefs.length > 0 && <p>Draft order created: <strong>{run.orderRefs.join(", ")}</strong> (awaiting your confirmation)</p>}
              {run.escalated && <p className="flag">Escalated to you: needs a personal reply.</p>}
              <div className="row">
                <button onClick={() => navigator.clipboard.writeText(run.draftReply)}>Approve &amp; copy</button>
                <button className="ghost" onClick={() => selected && draft(selected)}>Redraft</button>
              </div>
              <div className="trace">
                {run.steps.map((s, i) => (
                  <div key={i}>→ {s.tool}({JSON.stringify(s.args)})</div>
                ))}
                <div>{run.model} · {run.usage.prompt_tokens}+{run.usage.completion_tokens} tokens</div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
