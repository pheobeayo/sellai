import { NextResponse } from "next/server";
import { getDashboard } from "@/dashboard/metrics";
import { generateInsights } from "@/dashboard/insights";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Muse Spark insights from the aggregated numbers only. */
export async function POST(req: Request) {
  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 30));
  try {
    const dash = await getDashboard(days);
    if (dash.totals.enquiries === 0) {
      return NextResponse.json({ insights: [], dropped: 0, sampleWarning: "No enquiries in this period yet.", model: "none" });
    }
    return NextResponse.json(await generateInsights(dash));
  } catch (e) {
    return NextResponse.json({ error: { code: "insights_failed", message: (e as Error).message } }, { status: 502 });
  }
}
