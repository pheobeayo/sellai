"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ImagePlus, Plus, Sparkles, Trash2, X } from "lucide-react";
import type { ListingDraft } from "@/catalogue/listing";
import SellerShell from "../../components/seller/SellerShell";
import PageHeader from "../../components/seller/PageHeader";
import Panel from "../../components/seller/Panel";
import Notice from "../../components/seller/Notice";
import {
  btn,
  btnGhost,
  fieldLabel,
  input,
  muted,
  textarea,
} from "../../components/seller/styles";

type ImageChoice = "enhanced" | "cutout" | "original";
interface VariantRow {
  label: string;
  price: string;
  stock: string;
}

const IMAGE_LABEL: Record<ImageChoice, string> = {
  original: "Your photo",
  cutout: "Cut out (SAM 3.1)",
  enhanced: "Studio shot (Muse Image)",
};

export default function Catalogue() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ListingDraft | null>(null);

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
      const res = await fetch("/api/catalogue/draft", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Draft failed");
      const r = json as ListingDraft;
      setResult(r);
      setName(r.draft.name);
      setDescription(r.draft.description);
      setTags(r.draft.tags.join(", "));
      setVariants(
        (r.draft.suggested_variant_labels.length
          ? r.draft.suggested_variant_labels
          : ["Standard"]
        ).map((label) => ({ label, price: "", stock: "" })),
      );
      setImageChoice(
        r.images.enhanced
          ? "enhanced"
          : r.images.cutout
            ? "cutout"
            : "original",
      );
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
    if (rows.length === 0)
      return setError("Enter a price for at least one variant.");
    const imageUrl = result.images[imageChoice] ?? result.images.original;
    try {
      const res = await fetch("/api/catalogue/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category: result.draft.category,
          description,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          variants: rows.map((v) => ({
            label: v.label,
            priceNaira: Number(v.price),
            stock: Number(v.stock) || 0,
          })),
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

  const setVariant = (i: number, patch: Partial<VariantRow>) =>
    setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  const removeVariant = (i: number) =>
    setVariants((vs) => vs.filter((_, j) => j !== i));

  return (
    <SellerShell>
      <PageHeader
        title="Photo to listing"
        description="Snap a product. SellAI names it, cuts it out, makes a clean catalogue shot and drafts the listing. You set the price."
      />

      {error && <Notice tone="error">{error}</Notice>}

      {/* Step 1: photo */}
      <Panel
        title="1. Add a product photo"
        description="A clear photo on any background works. It takes about 30 seconds."
        className="max-w-[820px]"
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-stretch">
          <label className="group relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-[#D9CFBF] bg-[#FBFAF7] p-6 text-center transition hover:border-forest md:w-[280px] md:flex-none">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Selected product"
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <>
                <span className="flex size-12 items-center justify-center rounded-full bg-[#E2F3EA] text-forest">
                  <ImagePlus aria-hidden size={22} strokeWidth={2.2} />
                </span>
                <span className="text-sm font-bold">Choose a photo</span>
                <span className="text-xs text-[#5C635E]">JPG, PNG or HEIC</span>
              </>
            )}
            {preview && (
              <span className="absolute bottom-3 left-3 rounded-full bg-[#15201B]/75 px-3 py-1.5 text-xs font-bold text-[#F7F4EE]">
                Change photo
              </span>
            )}
          </label>

          <div className="flex flex-1 flex-col justify-end gap-3.5">
            <label className={fieldLabel}>
              Anything the photo can’t show? (optional)
              <input
                className={input}
                placeholder="e.g. new burgundy bob, 10 and 12 inches"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
              />
            </label>
            <div>
              <button
                type="button"
                className={btn}
                onClick={draft}
                disabled={!file || busy}
              >
                <Sparkles aria-hidden size={16} strokeWidth={2.4} />
                {busy ? "Working… (about 30s)" : "Draft listing"}
              </button>
            </div>
          </div>
        </div>
      </Panel>

      {result && (
        <>
          {/* Step 2: image */}
          <Panel title="2. Pick the catalogue image">
            <div
              className="flex flex-wrap gap-4"
              role="radiogroup"
              aria-label="Catalogue image"
            >
              {(["original", "cutout", "enhanced"] as const).map((k) =>
                result.images[k] ? (
                  <label
                    key={k}
                    className={`relative flex w-[calc(50%-8px)] cursor-pointer flex-col gap-2.5 rounded-2xl border-2 p-2.5 transition sm:w-[200px] ${
                      imageChoice === k
                        ? "border-forest bg-[#F3FAF6]"
                        : "border-[#E3DACB] bg-white hover:border-[#C9BDA8]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="img"
                      className="sr-only"
                      checked={imageChoice === k}
                      onChange={() => setImageChoice(k)}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.images[k]}
                      alt={IMAGE_LABEL[k]}
                      className="aspect-square w-full rounded-xl bg-[#EFE6D8] object-contain"
                    />
                    <span className="px-1 pb-1 text-[13px] font-bold">
                      {IMAGE_LABEL[k]}
                    </span>
                    {imageChoice === k && (
                      <span className="absolute right-4 top-4 flex size-6 items-center justify-center rounded-full bg-forest text-white">
                        <Check aria-hidden size={14} strokeWidth={3} />
                      </span>
                    )}
                  </label>
                ) : null,
              )}
            </div>
            {imageChoice === "enhanced" && (
              <Notice tone="warning">
                AI-enhanced from your photo. Check it still matches the real
                item before you publish.
              </Notice>
            )}
          </Panel>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            {/* Step 3: listing */}
            <Panel title="3. Check the listing" className="lg:flex-[1.4]">
              <label className={fieldLabel}>
                Name
                <input
                  className={input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className={fieldLabel}>
                Description
                <textarea
                  className={`${textarea} min-h-[100px]`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label className={fieldLabel}>
                Search words (comma separated)
                <input
                  className={input}
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </label>

              <div className="flex flex-col gap-2.5 border-t border-[#EFE6D8] pt-4">
                <strong className="text-[15px]">
                  Variants, prices and stock
                </strong>
                <div className="hidden gap-2.5 px-1 text-[11px] font-bold uppercase tracking-[0.8px] text-[#5C635E] sm:flex">
                  <span className="flex-[2]">Label</span>
                  <span className="flex-1">Price (₦)</span>
                  <span className="flex-1">Stock</span>
                  <span className="w-11" />
                </div>
                {variants.map((v, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap gap-2.5 rounded-2xl bg-[#FBFAF7] p-2.5 sm:flex-nowrap sm:bg-transparent sm:p-0"
                  >
                    <input
                      className={`${input} basis-full sm:flex-[2] sm:basis-0`}
                      aria-label="Variant label"
                      value={v.label}
                      onChange={(e) => setVariant(i, { label: e.target.value })}
                      placeholder="Label"
                    />
                    <input
                      className={`${input} flex-1 basis-0`}
                      aria-label="Price in naira"
                      inputMode="numeric"
                      value={v.price}
                      onChange={(e) =>
                        setVariant(i, {
                          price: e.target.value.replace(/[^\d]/g, ""),
                        })
                      }
                      placeholder="Price ₦"
                    />
                    <input
                      className={`${input} flex-1 basis-0`}
                      aria-label="Stock"
                      inputMode="numeric"
                      value={v.stock}
                      onChange={(e) =>
                        setVariant(i, {
                          stock: e.target.value.replace(/[^\d]/g, ""),
                        })
                      }
                      placeholder="Stock"
                    />
                    <button
                      type="button"
                      aria-label={`Remove ${v.label || "variant"}`}
                      onClick={() => removeVariant(i)}
                      disabled={variants.length === 1}
                      className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-xl border-2 border-[#E3DACB] bg-white text-[#5C635E] transition hover:border-[#B4471F] hover:text-[#9A3A16] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 aria-hidden size={16} strokeWidth={2.2} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() =>
                    setVariants((vs) => [
                      ...vs,
                      { label: "", price: "", stock: "" },
                    ])
                  }
                >
                  <Plus aria-hidden size={16} strokeWidth={2.4} />
                  Add variant
                </button>
                <button type="button" className={btn} onClick={publish}>
                  Publish to catalogue
                </button>
              </div>
              {published && (
                <Notice tone="success">
                  “{published}” is live.{" "}
                  <Link href="/inbox" className="font-bold text-[#1F5A44]">
                    Ask the agent about it →
                  </Link>
                </Notice>
              )}
            </Panel>

            {/* Confirm and notes */}
            <div className="flex min-w-0 flex-1 flex-col gap-6">
              <Panel
                title="Confirm before you publish"
                description="The photo can’t prove these, so they’re left out of the description. Customers will ask."
              >
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {result.draft.confirm_with_vendor.map((c) => (
                    <li
                      key={c}
                      className="flex items-start gap-2.5 rounded-xl bg-[#FDF4DC] px-3.5 py-2.5 text-sm leading-normal text-[#5A4208]"
                    >
                      <span className="mt-[7px] size-1.5 flex-none rounded-full bg-[#C99A1E]" />
                      {c}
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Suggested caption">
                <p className="m-0 whitespace-pre-wrap text-[15px] leading-relaxed">
                  {result.draft.caption}
                </p>
                {result.warnings.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-[#EFE6D8] pt-3">
                    <strong className="text-sm">Notes</strong>
                    <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
                      {result.warnings.map((w) => (
                        <li key={w} className={muted}>
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Panel>

              <div className="flex flex-col gap-1.5 rounded-2xl bg-[#15201B] p-4 font-mono text-xs leading-relaxed text-[#CDEBDC]">
                <span className="mb-1 font-[family-name:var(--font-body)] text-[13px] font-bold text-[#F7F4EE]">
                  How this listing was made
                </span>
                {result.steps.map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {s.ok ? (
                      <Check
                        aria-hidden
                        size={13}
                        strokeWidth={3}
                        className="mt-0.5 flex-none text-[#7FD1A8]"
                      />
                    ) : (
                      <X
                        aria-hidden
                        size={13}
                        strokeWidth={3}
                        className="mt-0.5 flex-none text-[#F09A74]"
                      />
                    )}
                    <span>
                      {s.step}
                      {s.model ? ` · ${s.model}` : ""} ·{" "}
                      {(s.ms / 1000).toFixed(1)}s{s.note ? ` · ${s.note}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </SellerShell>
  );
}
