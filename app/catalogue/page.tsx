"use client";

import Link from "next/link";
import { useState } from "react";
import type { ListingDraft } from "@/catalogue/listing";

type ImageChoice = "enhanced" | "cutout" | "original";
interface VariantRow { label: string; price: string; stock: string }

export default function CataloguePage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ListingDraft | null>(null);

  // Editable listing fields (vendor confirms before publishing)
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [imageChoice, setImageChoice] = useState<ImageChoice>("enhanced");
  const [published, setPublished] = useState<string>("");

  function pick(f: File | null) {
    setFile(f);
    setResult(null);
    setPublished("");
    setPreview(f ? URL.createObjectURL(f) : "");
  }

  async function draft() {
    if (!file) return;
    setBusy(true);
    setError("");
    setPublished("");
    try {
      const form = new FormData();
      form.append("photo", file);
      if (hint.trim()) form.append("hint", hint.trim());
      const res = await fetch("/api/catalogue/draft", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Draft failed");
      const r = json as ListingDraft;
      setResult(r);
      setName(r.draft.name);
      setDescription(r.draft.description);
      setTags(r.draft.tags.join(", "));
      setVariants((r.draft.suggested_variant_labels.length ? r.draft.suggested_variant_labels : ["Standard"]).map((label) => ({ label, price: "", stock: "" })));
      setImageChoice(r.images.enhanced ? "enhanced" : r.images.cutout ? "cutout" : "original");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!result) return;
    setError("");
    const rows = variants.filter((v) => v.label.trim() && Number(v.price) > 0);
    if (rows.length === 0) return setError("Enter a price for at least one variant.");
    const imageUrl = result.images[imageChoice] ?? result.images.original;
    try {
      const res = await fetch("/api/catalogue/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category: result.draft.category,
          description,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          variants: rows.map((v) => ({ label: v.label, priceNaira: Number(v.price), stock: Number(v.stock) || 0 })),
          imageUrl,
          imageIsAiEnhanced: imageChoice === "enhanced",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Publish failed");
      setPublished(json.product.name);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const setVariant = (i: number, patch: Partial<VariantRow>) => setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  return (
    <main>
      <nav className="nav"><Link href="/">Inbox</Link><span>Catalogue</span><Link href="/dashboard">Dashboard</Link></nav>
      <h1>Photo to listing</h1>
      <p className="sub">Snap a product. SellAI names it, cuts it out, makes a clean catalogue shot, and drafts the listing. You set the price.</p>
      {error && <p className="err">{error}</p>}

      <section className="panel">
        <div className="row" style={{ marginTop: 0 }}>
          <input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          <input className="text" placeholder="Optional note, e.g. 'new burgundy bob, 10 and 12 inches'" value={hint} onChange={(e) => setHint(e.target.value)} />
          <button onClick={draft} disabled={!file || busy}>{busy ? "Working… (about 30s)" : "Draft listing"}</button>
        </div>
        {preview && !result && <img src={preview} alt="Selected product" className="thumb" />}
      </section>

      {result && (
        <>
          <section className="panel" style={{ marginTop: 16 }}>
            <strong>Pick the catalogue image</strong>
            <div className="images">
              {(["original", "cutout", "enhanced"] as const).map((k) =>
                result.images[k] ? (
                  <label key={k} className={`imgopt ${imageChoice === k ? "active" : ""}`}>
                    <input type="radio" name="img" checked={imageChoice === k} onChange={() => setImageChoice(k)} />
                    <img src={result.images[k]} alt={k} />
                    <span>{k === "original" ? "Your photo" : k === "cutout" ? "Cut out (SAM 3.1)" : "Studio shot (Muse Image)"}</span>
                  </label>
                ) : null,
              )}
            </div>
            {imageChoice === "enhanced" && <p className="gloss">AI-enhanced from your photo. Check it still matches the real item before you publish.</p>}
          </section>

          <div className="grid" style={{ marginTop: 16 }}>
            <section className="panel">
              <strong>Listing</strong>
              <label className="field">Name<input className="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
              <label className="field">Description<textarea style={{ minHeight: 80 }} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
              <label className="field">Search words (comma separated)<input className="text" value={tags} onChange={(e) => setTags(e.target.value)} /></label>

              <strong style={{ display: "block", marginTop: 12 }}>Variants, prices and stock</strong>
              {variants.map((v, i) => (
                <div className="row" key={i}>
                  <input className="text" style={{ flex: 2 }} value={v.label} onChange={(e) => setVariant(i, { label: e.target.value })} placeholder="Label" />
                  <input className="text" style={{ flex: 1 }} inputMode="numeric" value={v.price} onChange={(e) => setVariant(i, { price: e.target.value.replace(/[^\d]/g, "") })} placeholder="Price ₦" />
                  <input className="text" style={{ flex: 1 }} inputMode="numeric" value={v.stock} onChange={(e) => setVariant(i, { stock: e.target.value.replace(/[^\d]/g, "") })} placeholder="Stock" />
                </div>
              ))}
              <div className="row">
                <button className="ghost" onClick={() => setVariants((vs) => [...vs, { label: "", price: "", stock: "" }])}>Add variant</button>
                <button onClick={publish}>Publish to catalogue</button>
              </div>
              {published && <p className="ok">“{published}” is live. <Link href="/">Ask the agent about it →</Link></p>}
            </section>

            <section className="panel">
              <strong>Confirm before you publish</strong>
              <p className="gloss">The photo can't prove these, so they're left out of the description. Customers will ask.</p>
              <ul>{result.draft.confirm_with_vendor.map((c) => <li key={c}>{c}</li>)}</ul>
              <strong>Suggested caption</strong>
              <p>{result.draft.caption}</p>
              {result.warnings.length > 0 && <><strong>Notes</strong><ul>{result.warnings.map((w) => <li key={w} className="gloss">{w}</li>)}</ul></>}
              <div className="trace">
                {result.steps.map((s, i) => (
                  <div key={i}>{s.ok ? "✓" : "✗"} {s.step}{s.model ? ` · ${s.model}` : ""} · {(s.ms / 1000).toFixed(1)}s{s.note ? ` · ${s.note}` : ""}</div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
