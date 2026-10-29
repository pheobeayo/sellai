import { NextResponse } from "next/server";
import { z } from "zod";
import { approveAndSend, ReplyCheckError } from "@/inbox/send";
import { store } from "@/store/store";

export const runtime = "nodejs";

const Body = z.object({ text: z.string().min(1).max(4000), force: z.boolean().default(false) });

/** Vendor approval. Amounts are re-checked server-side; `force` is the vendor overriding the check. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "bad_request", message: parsed.error.message } }, { status: 400 });
  try {
    const result = await approveAndSend(id, parsed.data.text, { force: parsed.data.force });
    return NextResponse.json({ result, enquiry: await store.enquiry(id) });
  } catch (e) {
    if (e instanceof ReplyCheckError) {
      return NextResponse.json(
        { error: { code: "checks_failed", message: e.message, details: { failed: e.failed, ungrounded: e.ungrounded } } },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: { code: "send_failed", message: (e as Error).message } }, { status: 502 });
  }
}
