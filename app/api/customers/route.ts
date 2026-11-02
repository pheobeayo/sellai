import { NextResponse } from "next/server";
import { getCustomers, getLoyaltyRules, summarise, type Source } from "@/loyalty/customers";
import { listRewards } from "@/loyalty/rewards";
import { describeReward } from "@/loyalty/rules";
import { store } from "@/store/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCES = new Set(["facebook", "instagram", "whatsapp", "other"]);

/** Customers built from confirmed and paid orders, with loyalty tiers and rewards. ?source=facebook filters by where sales started. */
export async function GET(req: Request) {
  const s = new URL(req.url).searchParams.get("source");
  const source = s && SOURCES.has(s) ? (s as Source) : undefined;
  const [all, rules, rewards, products] = await Promise.all([getCustomers(), getLoyaltyRules(), listRewards(), store.products()]);
  const customers = source ? all.filter((c) => c.sources.includes(source)) : all;
  return NextResponse.json({
    customers,
    summary: summarise(customers),
    rules,
    rewards: rewards.map((r) => ({ ...r, description: describeReward(r, products) })),
    whatsappConnected: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  });
}
