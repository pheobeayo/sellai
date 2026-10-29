import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ingest } from "@/inbox/pipeline";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  postId: z.string().optional(),
  autoDraft: z.boolean().default(false),
  messages: z.array(z.object({ text: z.string().min(1).max(2000), author: z.string().max(80).optional() })).min(1).max(100),
});

/**
 * Paste or CSV import: comments copied from a post when the webhook isn't connected.
 * Saved and triaged like webhook messages; drafting happens when the vendor opens one (cheaper).
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "bad_request", message: parsed.error.message } }, { status: 400 });
  const { postId, messages, autoDraft } = parsed.data;
  const batch = randomBytes(3).toString("hex");
  const now = Date.now();
  const items = messages.map((m, i) => ({
    id: `imp_${batch}_${i + 1}`,
    channel: "manual_import" as const,
    text: m.text.trim(),
    authorHandle: m.author,
    postId,
    receivedAt: new Date(now + i).toISOString(),
  }));
  try {
    return NextResponse.json(await ingest(items, { triage: true, autoDraft }));
  } catch (e) {
    return NextResponse.json({ error: { code: "import_failed", message: (e as Error).message } }, { status: 502 });
  }
}
