import { z } from "zod";
import { extractNairaAmounts } from "@/agent/grounding";
import { completeJSON, MODELS, meta } from "@/lib/meta";
import type { Dashboard } from "./metrics";

/**
 * Muse Spark reads ONLY the aggregated numbers and suggests what to post next.
 * Guardrails in code, not just in the prompt:
 *   - any ₦ amount an insight mentions must exist in the data, otherwise the insight is dropped
 *   - the small-sample warning is computed here, never left to the model
 */

const InsightSchema = z.object({
  insights: z
    .array(
      z.object({
        title: z.string().max(80),
        finding: z.string().max(300).describe("What the numbers show, citing the posts and figures"),
        action: z.string().max(200).describe("One concrete thing to try next"),
        post_ids: z.array(z.string()).max(4),
      }),
    )
    .max(3),
});
export type Insight = z.infer<typeof InsightSchema>["insights"][number];

const SYSTEM = `You advise a small Nigerian online vendor on which social posts turn into sales.
You get aggregated funnel numbers per post for a period. Write up to 3 insights.
Rules:
- Use ONLY the numbers provided. Quote figures exactly as given; do not compute new money totals.
- Compare posts (e.g. which converts buying signals into paid orders best) and point to where buyers drop off.
- Each insight ends with one concrete, cheap action (what to post or change next).
- If the data is too thin to compare, say so plainly instead of guessing.
- Write for a busy vendor in plain English. Refer to posts by their caption in quotes, never by id.
  Never write field names (no underscores, no camelCase). Write money as ₦ with commas, e.g. ₦55,500.
Return ONLY JSON: {"insights":[{"title","finding","action","post_ids"}]}`;

export const MIN_ORDERS_FOR_CONFIDENCE = 5;

export interface InsightsResult {
  insights: Insight[];
  dropped: number;
  sampleWarning?: string;
  model: string;
}

export async function generateInsights(dash: Dashboard): Promise<InsightsResult> {
  const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
  const posts = dash.posts.map((p) => ({
    post_id: p.postId,
    post: p.caption,
    "messages": p.enquiries,
    "buying signals": p.buyingSignals,
    "ready to buy": p.readyToBuy,
    "checkout links sent": p.checkoutLinks,
    "links opened": p.linksClicked,
    "orders confirmed": p.confirmed,
    "orders paid": p.paid,
    "revenue": naira(p.revenueNaira),
    "average reply time (minutes)": p.avgReplyMinutes,
  }));
  const t = dash.totals;
  const totals = {
    "messages": t.enquiries, "buying signals": t.buyingSignals, "ready to buy": t.readyToBuy,
    "checkout links sent": t.checkoutLinks, "links opened": t.linksClicked, "orders confirmed": t.confirmed,
    "orders paid": t.paid, "revenue": naira(t.revenueNaira), "confirmed but unpaid": naira(t.pipelineNaira),
    "average reply time (minutes)": t.avgReplyMinutes,
  };
  const data = { "period (days)": dash.periodDays, totals, posts };

  const { data: out } = await completeJSON({
    client: meta(),
    model: MODELS.agent,
    system: SYSTEM,
    user: JSON.stringify(data),
    schema: InsightSchema,
  });

  // Every ₦ figure in an insight must appear in the data.
  const allowed = new Set<number>([
    dash.totals.revenueNaira,
    dash.totals.pipelineNaira,
    ...dash.posts.flatMap((p) => [p.revenueNaira, p.pipelineNaira]),
  ]);
  const kept = out.insights.filter((i) => extractNairaAmounts(`${i.finding} ${i.action}`).every((n) => allowed.has(n)));

  const orders = dash.totals.confirmed;
  return {
    insights: kept,
    dropped: out.insights.length - kept.length,
    sampleWarning:
      orders < MIN_ORDERS_FOR_CONFIDENCE
        ? `Only ${orders} confirmed order${orders === 1 ? "" : "s"} so far. Treat these as early signals, not conclusions.`
        : undefined,
    model: MODELS.agent,
  };
}
