import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { claimChallenge, LOGIN_COOKIE } from "@/auth/login";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Step 2: the login page polls this until the seller's WhatsApp message has arrived through the webhook. */
export async function GET() {
  const jar = await cookies();
  const r = await claimChallenge(jar.get(LOGIN_COOKIE)?.value);
  if (r.status !== "verified") return NextResponse.json({ status: r.status });
  const res = NextResponse.json({ status: "verified" });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(`wa:${r.phone}`), sessionCookieOptions);
  res.cookies.delete(LOGIN_COOKIE);
  return res;
}
