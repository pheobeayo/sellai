import { NextResponse } from "next/server";
import { z } from "zod";
import { issueReward, listRewards, RewardError } from "@/loyalty/rewards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ rewards: await listRewards() });
}

const Body = z.object({
  handle: z.string().min(1),
  kind: z.enum(["percent_off", "amount_off", "free_delivery", "gift"]),
  value: z.number().int().min(0).default(0),
  giftVariantId: z.string().optional(),
  message: z.string().min(1).max(800),
  reason: z.string().max(300).optional(),
  code: z.string().regex(/^THX-[A-Z0-9]{5}$/).optional(),
  send: z.boolean().default(true),
});

/** Vendor-approved reward: checked against the loyalty rules again, saved, and sent on WhatsApp when allowed. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "bad_request", message: parsed.error.message } }, { status: 400 });
  const b = parsed.data;
  try {
    const result = await issueReward({
      handle: b.handle,
      proposal: { kind: b.kind, value: b.value, giftVariantId: b.giftVariantId },
      message: b.message,
      reason: b.reason,
      code: b.code,
      send: b.send,
    });
    return NextResponse.json(result);
  } catch (e) {
    const status = e instanceof RewardError ? 400 : 502;
    return NextResponse.json({ error: { code: status === 400 ? "reward_rejected" : "send_failed", message: (e as Error).message } }, { status });
  }
}
