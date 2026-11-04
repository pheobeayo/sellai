import { NextResponse } from "next/server";
import { z } from "zod";
import { checkPasscode, passcodeEnabled } from "@/auth/login";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/auth/session";

export const runtime = "nodejs";

const Body = z.object({ passcode: z.string().min(1).max(100) });

/** Shared passcode login (SELLER_PASSCODE). Off unless that variable is set. */
export async function POST(req: Request) {
  if (!passcodeEnabled()) return NextResponse.json({ error: { code: "disabled", message: "Passcode login is turned off." } }, { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  await new Promise((r) => setTimeout(r, 400)); // slow down guessing
  if (!parsed.success || !checkPasscode(parsed.data.passcode)) {
    return NextResponse.json({ error: { code: "wrong_passcode", message: "That passcode isn't right." } }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken("passcode"), sessionCookieOptions);
  return res;
}
