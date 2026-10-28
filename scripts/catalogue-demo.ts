import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { draftListingFromPhoto } from "@/catalogue/listing";

// Usage: npm run catalogue:demo -- path/to/product-photo.jpg ["optional vendor note"]
// Writes the cut-out, studio shot and draft JSON to out/<photo-name>/
const path = process.argv[2];
if (!path) {
  console.error('Usage: npm run catalogue:demo -- path/to/photo.jpg ["optional note"]');
  process.exit(1);
}

const out = await draftListingFromPhoto(readFileSync(path), { hint: process.argv[3] });

const dir = join("out", basename(path, extname(path)));
mkdirSync(dir, { recursive: true });
const save = (name: string, dataUrl?: string) => {
  if (!dataUrl) return;
  const [head, b64] = dataUrl.split(",");
  const ext = head.includes("webp") ? "webp" : head.includes("jpeg") ? "jpg" : "png";
  writeFileSync(join(dir, `${name}.${ext}`), Buffer.from(b64, "base64"));
};
save("1-original", out.images.original);
save("2-cutout", out.images.cutout);
save("3-studio", out.images.enhanced);
writeFileSync(join(dir, "draft.json"), JSON.stringify({ ...out, images: undefined }, null, 2));

console.log("\nPipeline:");
for (const s of out.steps) console.log(`  ${s.ok ? "✓" : "✗"} ${s.step.padEnd(28)} ${(s.model ?? "").padEnd(22)} ${(s.ms / 1000).toFixed(1)}s${s.note ? "  " + s.note : ""}`);
console.log(`\nSAM objects found: ${out.segmentation.objectsFound}${out.segmentation.confidence !== undefined ? ` · confidence ${out.segmentation.confidence}` : ""}`);
console.log(`\nNAME:        ${out.draft.name}`);
console.log(`STYLE:       ${out.draft.style} · ${out.draft.colour}`);
console.log(`DESCRIPTION: ${out.draft.description}`);
console.log(`TAGS:        ${out.draft.tags.join(", ")}`);
console.log(`VARIANTS:    ${out.draft.suggested_variant_labels.join(", ") || "(none suggested)"}`);
console.log(`CONFIRM:     ${out.draft.confirm_with_vendor.join("; ")}`);
console.log(`CAPTION:     ${out.draft.caption}`);
if (out.warnings.length) console.log(`\nNotes:\n  ${out.warnings.join("\n  ")}`);
console.log(`\nImages saved to ${dir}/`);
