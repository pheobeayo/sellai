import { NextResponse } from "next/server";
import { z } from "zod";
import { suggestRewards } from "@/loyalty/suggest";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ handles: z.array(z.string()).max(12).optional() });

/** Muse Spark suggests a reward and a personal thank-you for each customer. Nothing is issued or sent here. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "bad_request", message: parsed.error.message } }, { status: 400 });
  try {
    return NextResponse.json(await suggestRewards(parsed.data.handles));
  } catch (e) {
    return NextResponse.json({ error: { code: "suggest_failed", message: (e as Error).message } }, { status: 502 });
  }
}
