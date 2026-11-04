import { NextResponse } from "next/server";
import { z } from "zod";
import { LOGIN_COOKIE, LOGIN_TTL_MINUTES, LoginError, startChallenge } from "@/auth/login";

export const runtime = "nodejs";

const Body = z.object({ phone: z.string().min(5).max(20) });

/** Step 1: the seller enters their WhatsApp number and gets a one-time code to send from that number. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "bad_request", message: "Enter your WhatsApp number." } }, { status: 400 });
  try {
    const c = await startChallenge(parsed.data.phone);
    const res = NextResponse.json({ code: c.code, phone: c.phone, waLink: c.waLink, expiresAt: c.expiresAt });
    // Only this browser can turn the verified code into a session.
    res.cookies.set(LOGIN_COOKIE, c.id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: LOGIN_TTL_MINUTES * 60 });
    return res;
  } catch (e) {
    const known = e instanceof LoginError;
    return NextResponse.json({ error: { code: known ? "login_refused" : "login_failed", message: known ? e.message : "Could not start login. Try again." } }, { status: known ? 400 : 500 });
  }
}
