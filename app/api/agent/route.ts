import { NextResponse } from "next/server";
import { z } from "zod";
import { runSalesAgent } from "@/agent/sales-agent";

export const runtime = "nodejs";

const Body = z.object({
  message: z.string().min(1),
  channel: z.enum(["instagram_comment", "facebook_comment", "whatsapp", "manual_import"]).default("manual_import"),
  postId: z.string().optional(),
  customerHandle: z.string().optional(),
});

/** Draft a grounded reply for one enquiry. Nothing is sent from here; the vendor approves first. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "bad_request", message: parsed.error.message } }, { status: 400 });

  try {
    return NextResponse.json(await runSalesAgent(parsed.data));
  } catch (e) {
    return NextResponse.json({ error: { code: "agent_failed", message: (e as Error).message } }, { status: 502 });
  }
}
