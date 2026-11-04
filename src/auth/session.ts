/**
 * Signed session cookies for sellers. No database lookup: the cookie carries who is signed in and when it
 * expires, signed with HMAC-SHA256 (Web Crypto, so it works in the request proxy and in route handlers).
 */

export const SESSION_COOKIE = "sellai_session";
export const SESSION_DAYS = 7;

export interface Session {
  /** "wa:2348012345678" for a WhatsApp login, "passcode" for the shared demo passcode. */
  sub: string;
  exp: number;
}

/** In production a SESSION_SECRET is required; locally a fixed dev secret keeps `npm run dev` working. */
export function sessionSecret(): string | null {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  return process.env.NODE_ENV === "production" ? null : "sellai-dev-only-secret-not-for-production";
}

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(sub: string, days = SESSION_DAYS): Promise<string> {
  const secret = sessionSecret();
  if (!secret) throw new Error("SESSION_SECRET is not set");
  const payload = b64url(enc.encode(JSON.stringify({ sub, exp: Date.now() + days * 86_400_000 } satisfies Session)));
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  const secret = sessionSecret();
  if (!secret || !token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !sameString(sig, await hmac(secret, payload))) return null;
  try {
    const s = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as Session;
    return typeof s.sub === "string" && typeof s.exp === "number" && s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 86_400,
};
