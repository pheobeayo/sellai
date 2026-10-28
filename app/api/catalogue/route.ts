import { NextResponse } from "next/server";
import { store } from "@/store/store";

export const runtime = "nodejs";

/** The live catalogue the agent sells from. */
export async function GET() {
  return NextResponse.json({ products: store.products() });
}
