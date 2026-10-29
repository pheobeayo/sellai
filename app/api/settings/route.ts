import { NextResponse } from "next/server";
import { z } from "zod";
import { isAutopilotOn, setAutopilot } from "@/inbox/autopilot";
import { appUrl } from "@/integrations/attribution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ autopilot: await isAutopilotOn(), whatsappConnected: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID), appUrl: appUrl() });
}

const Body = z.object({ autopilot: z.boolean() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "bad_request", message: parsed.error.message } }, { status: 400 });
  await setAutopilot(parsed.data.autopilot);
  return NextResponse.json({ autopilot: parsed.data.autopilot });
}
