import { NextResponse } from "next/server";
import { z } from "zod";
import { classifyAll } from "@/agent/classify";
import { store } from "@/store/store";

export const runtime = "nodejs";

const Body = z.object({
  messages: z.array(z.object({ id: z.string().optional(), text: z.string().min(1), postId: z.string().optional() })).min(1).max(200),
});

/** Stateless triage (nothing is saved). The inbox uses /api/enquiries/import instead. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "bad_request", message: parsed.error.message } }, { status: 400 });

  try {
    const posts = await store.posts();
    const items = parsed.data.messages.map((m, i) => ({
      id: m.id ?? `m${i + 1}`,
      text: m.text,
      postCaption: posts.find((p) => p.id === m.postId)?.caption || undefined,
    }));
    const out = await classifyAll(items);
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: { code: "classify_failed", message: (e as Error).message } }, { status: 502 });
  }
}
