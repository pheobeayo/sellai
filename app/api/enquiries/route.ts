import { NextResponse } from "next/server";
import { store } from "@/store/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Inbox feed: stored enquiries (newest first) plus posts for the import picker. */
export async function GET() {
  try {
    const [enquiries, posts] = await Promise.all([store.enquiries(200), store.posts()]);
    return NextResponse.json({ enquiries, posts: posts.map((p) => ({ id: p.id, channel: p.channel, caption: p.caption })) });
  } catch (e) {
    return NextResponse.json({ error: { code: "db_failed", message: (e as Error).message } }, { status: 500 });
  }
}
