import { checkGrounding } from "./grounding";

/**
 * Independent checks on a reply, run in code after the agent finishes. The agent can't see or
 * override them. A failed "block" check stops the reply from being sent automatically and
 * makes the vendor confirm before it goes out manually. "warn" checks are shown but don't block.
 */

export type CheckId =
  | "amounts_grounded"
  | "stock_available"
  | "no_bank_details"
  | "no_unsupported_promises"
  | "links_valid"
  | "complaint_escalated"
  | "language_match"
  | "length_ok";

export interface CheckResult {
  id: CheckId;
  label: string;
  ok: boolean;
  severity: "block" | "warn";
  detail?: string;
}

export interface CheckReport {
  checks: CheckResult[];
  /** No blocking check failed. */
  passed: boolean;
  /** No check failed at all, warnings included. Autopilot requires this. */
  clean: boolean;
}

export interface CheckContext {
  reply: string;
  /** Every ₦ amount the tools returned for this draft. */
  groundedAmounts: number[];
  /** Order refs the agent created in this run. */
  orderRefs: string[];
  /** Current stock for each of those orders' variants vs the quantity ordered. */
  orderStock?: Array<{ ref: string; quantity: number; stock: number }>;
  intent?: string;
  escalated: boolean;
  customerLanguage?: string;
  /** Public base URL; checkout links must be `${appUrl}/o/<ref>`. */
  appUrl: string;
}

// 10-digit NUBAN account numbers, or account/bank wording next to a long number.
const ACCOUNT_NUMBER = /(?<![\d,.])\d{10}(?![\d,.])/;
const BANK_WORDS = /\b(acct|account\s*(no|number|num|details)?|a\/c|bank|opay|palmpay|kuda|moniepoint|gtb|gtbank|access|zenith|uba|first\s*bank|fidelity|sterling|wema|union\s*bank)\b/i;
const LONG_NUMBER = /\d[\d\s-]{8,}\d/;

// Things the agent has no tool for, in English and Pidgin.
const PROMISES: Array<[RegExp, string, { exceptWhenEscalated?: boolean }?]> = [
  [/\breserv(e|ed|ing)\b/i, "reserve"],
  [/\b(hold|keep)\s+(it|am|one|dem)\b(\s+for\s+you)?/i, "hold/keep it"],
  [/\bset\s+(it\s+)?aside\b/i, "set aside"],
  [/\bdiscount|\breduce\s+(am|it|the\s+price)|\bprice\s+(cut|slash)|%\s*off\b/i, "discount"],
  [/\bfree\s+delivery\b/i, "free delivery"],
  [/\brefund(ed|s)?\b/i, "refund", { exceptWhenEscalated: true }], // "we'll look into your refund" is fine when the vendor takes over
  [/\bguarantee[ds]?\b/i, "guarantee"],
];

const URL_RE = /https?:\/\/[^\s)]+/gi;

// A light heuristic, so this check only warns.
const PIDGIN_MARKERS = /\b(dey|na|wetin|abeg|una|wan|don|sabi|oya|dem|wahala|wey|sef|sha|shey|nawa|abi|ehn|kuku|(?:we|i|e|dem|una|you)\s+go\s+\w+|(?<!\b[Ii]\s)am(?=\b)|e\s+(dey|go|don)|make\s+(we|i|you))\b/gi;

export function runChecks(ctx: CheckContext): CheckReport {
  const r = ctx.reply;
  const checks: CheckResult[] = [];

  const g = checkGrounding(r, ctx.groundedAmounts);
  checks.push({
    id: "amounts_grounded",
    label: "Every ₦ amount comes from your catalogue",
    ok: g.ok,
    severity: "block",
    detail: g.ok ? undefined : `Not from a tool: ${g.ungrounded.map((n) => `₦${n.toLocaleString("en-NG")}`).join(", ")}`,
  });

  const short = (ctx.orderStock ?? []).filter((o) => o.stock < o.quantity);
  checks.push({
    id: "stock_available",
    label: "Enough stock for any order in the reply",
    ok: short.length === 0,
    severity: "block",
    detail: short.length ? short.map((o) => `${o.ref}: ${o.quantity} ordered, ${o.stock} left`).join("; ") : undefined,
  });

  const hasAccount = ACCOUNT_NUMBER.test(r.replace(URL_RE, "")) || (BANK_WORDS.test(r) && LONG_NUMBER.test(r.replace(URL_RE, "")));
  checks.push({
    id: "no_bank_details",
    label: "No bank or account details",
    ok: !hasAccount,
    severity: "block",
    detail: hasAccount ? "Looks like an account number. Send payment details yourself." : undefined,
  });

  const promised = PROMISES.filter(([re, , o]) => re.test(r) && !(o?.exceptWhenEscalated && ctx.escalated)).map(([, name]) => name);
  checks.push({
    id: "no_unsupported_promises",
    label: "No promises the agent can't keep",
    ok: promised.length === 0,
    severity: "block",
    detail: promised.length ? `Mentions: ${promised.join(", ")}` : undefined,
  });

  const base = ctx.appUrl.replace(/\/+$/, "");
  const allowed = new Set(ctx.orderRefs.map((ref) => `${base}/o/${ref}`));
  const badLinks = (r.match(URL_RE) ?? []).map((u) => u.replace(/[.,!?]+$/, "")).filter((u) => !allowed.has(u));
  checks.push({
    id: "links_valid",
    label: "Links are real checkout links for this order",
    ok: badLinks.length === 0,
    severity: "block",
    detail: badLinks.length ? `Unexpected link: ${badLinks.join(", ")}` : undefined,
  });

  const complaintOk = ctx.intent !== "complaint" || ctx.escalated;
  checks.push({
    id: "complaint_escalated",
    label: "Complaints go to you",
    ok: complaintOk,
    severity: "block",
    detail: complaintOk ? undefined : "This is a complaint but the agent didn't escalate it.",
  });

  const markers = (r.match(PIDGIN_MARKERS) ?? []).length;
  const lang = ctx.customerLanguage;
  const langOk = lang === "pidgin" ? markers >= 1 : lang === "english" ? markers <= 2 : true;
  checks.push({
    id: "language_match",
    label: "Reply matches the customer's language",
    ok: langOk,
    severity: "warn",
    detail: langOk ? undefined : lang === "pidgin" ? "Customer wrote Pidgin; the reply reads as English." : "Customer wrote English; the reply is heavy on Pidgin.",
  });

  const words = r.trim().split(/\s+/).filter(Boolean).length;
  checks.push({
    id: "length_ok",
    label: "Short enough for chat",
    ok: words <= 90,
    severity: "warn",
    detail: words > 90 ? `${words} words` : undefined,
  });

  return {
    checks,
    passed: checks.every((c) => c.ok || c.severity === "warn"),
    clean: checks.every((c) => c.ok),
  };
}
