import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/auth/session";

/**
 * Seller pages and seller APIs need a signed-in seller. Public: the landing page, the shop, login, privacy,
 * checkout links (/o/…), the Meta webhook and the login endpoints themselves.
 */
const SELLER_PAGES = ["/inbox", "/catalogue", "/dashboard", "/customers"];
const PUBLIC_API = ["/api/webhooks/", "/api/auth/"];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    return session ? NextResponse.redirect(new URL(safeNext(req.nextUrl.searchParams.get("next")), req.url)) : NextResponse.next();
  }
  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API.some((p) => pathname.startsWith(p)) || session) return NextResponse.next();
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in as the seller first." } }, { status: 401 });
  }
  if (SELLER_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !session) {
    const to = new URL("/login", req.url);
    to.searchParams.set("next", pathname + search);
    return NextResponse.redirect(to);
  }
  return NextResponse.next();
}

/** Only same-site paths, so ?next= can't send a seller to another website. */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/inbox";
}

export const config = {
  matcher: ["/login", "/inbox/:path*", "/catalogue/:path*", "/dashboard/:path*", "/customers/:path*", "/api/:path*"],
};
