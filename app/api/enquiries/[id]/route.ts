import { NextResponse } from "next/server";
import { z } from "zod";
import { store } from "@/store/store";

export const runtime = "nodejs";

const Body = z.object({ status: z.enum(["new", "ignored"]) });

/** Dismiss a message (ignored) or bring it back (new). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "bad_request", message: parsed.error.message } }, { status: 400 });
  if (!(await store.enquiry(id))) return NextResponse.json({ error: { code: "not_found", message: "Enquiry not found" } }, { status: 404 });
  await store.setEnquiryStatus(id, parsed.data.status);
  return NextResponse.json({ enquiry: await store.enquiry(id) });
}
