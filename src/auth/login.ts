import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "@/db/client";

/**
 * "Reverse OTP" over WhatsApp: the seller sends a one-time code FROM their own WhatsApp to the business number.
 * The Meta webhook (signed with the app secret) tells us which number sent it, which proves the seller controls
 * that WhatsApp account. No authentication template is needed, because the seller starts the conversation.
 */

export const LOGIN_TTL_MINUTES = 10;
export const LOGIN_COOKIE = "sellai_login";
/** Matches "SellAI login 123456", however WhatsApp or the seller formats it. */
export const LOGIN_MESSAGE = /^\s*sell\s*ai\s+login\s*:?\s*(\d{6})\s*$/i;

export const normalizePhone = (p: string) => p.replace(/\D/g, "").replace(/^0(?=\d{10}$)/, "234");

/** Sellers allowed to log in: SELLER_WHATSAPP_NUMBERS, comma separated, international format (2348012345678). */
export function allowedSellers(): string[] {
  return (process.env.SELLER_WHATSAPP_NUMBERS ?? "").split(",").map(normalizePhone).filter((n) => n.length >= 8);
}
export const isAllowedSeller = (phone: string) => allowedSellers().includes(normalizePhone(phone));

export function businessNumber(): string | null {
  const n = (process.env.VENDOR_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
  return n.length >= 8 ? n : null;
}

export class LoginError extends Error {}

export interface Challenge {
  id: string;
  code: string;
  phone: string;
  expiresAt: string;
  waLink: string;
}

export async function startChallenge(rawPhone: string): Promise<Challenge> {
  const phone = normalizePhone(rawPhone);
  if (phone.length < 8) throw new LoginError("Enter your WhatsApp number.");
  if (!isAllowedSeller(phone)) throw new LoginError("This number isn't registered as a seller on this SellAI shop.");
  const biz = businessNumber();
  if (!biz) throw new LoginError("Login isn't set up yet: VENDOR_WHATSAPP_NUMBER is missing.");

  const d = await db();
  const { rows } = await d.query<{ n: number }>(
    `select count(*)::int as n from login_challenges where phone = $1 and created_at > now() - interval '10 minutes'`,
    [phone],
  );
  if ((rows[0]?.n ?? 0) >= 5) throw new LoginError("Too many attempts. Wait a few minutes and try again.");

  const id = randomBytes(18).toString("base64url");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + LOGIN_TTL_MINUTES * 60_000).toISOString();
  await d.query(`insert into login_challenges (id, phone, code, expires_at) values ($1,$2,$3,$4)`, [id, phone, code, expiresAt]);
  return { id, code, phone, expiresAt, waLink: `https://wa.me/${biz}?text=${encodeURIComponent(`SellAI login ${code}`)}` };
}

/**
 * Called by the webhook pipeline for a "SellAI login 123456" message. Returns true when it was a login message
 * (handled or not), so the pipeline doesn't treat it as a customer enquiry.
 */
export async function verifyFromWhatsApp(from: string, text: string): Promise<{ isLogin: boolean; verified: boolean }> {
  const m = LOGIN_MESSAGE.exec(text);
  if (!m) return { isLogin: false, verified: false };
  const phone = normalizePhone(from);
  if (!isAllowedSeller(phone)) return { isLogin: true, verified: false };
  const { rows } = await (await db()).query(
    `update login_challenges set verified_at = now()
     where phone = $1 and code = $2 and verified_at is null and claimed_at is null and expires_at > now()
     returning id`,
    [phone, m[1]],
  );
  return { isLogin: true, verified: rows.length > 0 };
}

/** The browser that started the challenge asks whether the WhatsApp message has arrived. Single use. */
export async function claimChallenge(id: string | undefined): Promise<{ status: "pending" | "verified" | "expired"; phone?: string }> {
  if (!id) return { status: "expired" };
  const d = await db();
  const { rows } = await d.query(
    `update login_challenges set claimed_at = now()
     where id = $1 and verified_at is not null and claimed_at is null and expires_at > now() - interval '1 minute'
     returning phone`,
    [id],
  );
  if (rows[0]) return { status: "verified", phone: rows[0].phone };
  const { rows: pending } = await d.query(`select 1 from login_challenges where id = $1 and claimed_at is null and expires_at > now()`, [id]);
  return { status: pending.length ? "pending" : "expired" };
}

/** Optional shared passcode (SELLER_PASSCODE), e.g. for judges or a co-worker without the seller's phone. */
export function passcodeEnabled(): boolean {
  return (process.env.SELLER_PASSCODE ?? "").length >= 6;
}
export function checkPasscode(input: string): boolean {
  const want = process.env.SELLER_PASSCODE ?? "";
  if (want.length < 6) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}
