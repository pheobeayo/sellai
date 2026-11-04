import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { passcodeEnabled } from "@/auth/login";
import { SESSION_COOKIE, sessionSecret, verifySessionToken } from "@/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Who is signed in, and which login methods this deployment offers. */
export async function GET() {
  const s = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  return NextResponse.json({
    signedIn: Boolean(s),
    who: s ? (s.sub.startsWith("wa:") ? `+${s.sub.slice(3)}` : "Shop team (passcode)") : null,
    configured: Boolean(sessionSecret()),
    whatsapp: Boolean(process.env.SELLER_WHATSAPP_NUMBERS && process.env.VENDOR_WHATSAPP_NUMBER),
    passcode: passcodeEnabled(),
  });
}
