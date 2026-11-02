import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelReward, markRewardSent } from "@/loyalty/rewards";

export const runtime = "nodejs";

const Body = z.object({ action: z.enum(["cancel", "sent_manually"]) });

/** Cancel an unused reward, or record that the vendor sent it from their own WhatsApp. */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "bad_request", message: parsed.error.message } }, { status: 400 });
  if (parsed.data.action === "sent_manually") {
    await markRewardSent(code.toUpperCase(), "manual");
    return NextResponse.json({ ok: true });
  }
  const reward = await cancelReward(code.toUpperCase());
  if (!reward) return NextResponse.json({ error: { code: "not_found", message: "No unused reward with that code" } }, { status: 404 });
  return NextResponse.json({ reward });
}
