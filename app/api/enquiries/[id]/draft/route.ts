import { NextResponse } from "next/server";
import { draftReplyFor } from "@/inbox/pipeline";

export const runtime = "nodejs";
export const maxDuration = 120;

/** (Re)draft a reply with the sales agent; the draft is saved on the enquiry. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json({ enquiry: await draftReplyFor(id) });
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ error: { code: msg.includes("not found") ? "not_found" : "agent_failed", message: msg } }, { status: msg.includes("not found") ? 404 : 502 });
  }
}
