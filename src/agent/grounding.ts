/**
 * Verifies that every Naira amount in a drafted reply came from a tool result.
 * This is the guardrail that stops the agent from inventing prices.
 */

const AMOUNT_PATTERNS: RegExp[] = [
  /(?:₦|\bN|\bNGN\s?)\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(\s?[kK])?/g, // ₦75,000  N75000  NGN 75k
  /\b(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(\s?[kK])?\s?(?:naira|NGN)\b/gi, // 75,000 naira  75k naira
  /\b(\d{2,4})(\s?[kK])\b/g, // bare "75k"
];

export function extractNairaAmounts(text: string): number[] {
  const found = new Set<number>();
  for (const re of AMOUNT_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const n = parseFloat(m[1].replace(/,/g, ""));
      if (Number.isNaN(n)) continue;
      found.add(Math.round(m[2] ? n * 1000 : n));
    }
  }
  return [...found];
}

export interface GroundingReport {
  ok: boolean;
  amountsInReply: number[];
  ungrounded: number[];
}

export function checkGrounding(reply: string, grounded: Iterable<number>): GroundingReport {
  const allowed = new Set(grounded);
  const amountsInReply = extractNairaAmounts(reply);
  const ungrounded = amountsInReply.filter((a) => !allowed.has(a));
  return { ok: ungrounded.length === 0, amountsInReply, ungrounded };
}