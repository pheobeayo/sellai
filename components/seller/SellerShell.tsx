"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartColumn, ExternalLink, Inbox, LogOut, Package } from "lucide-react";

const links = [
  { href: "/inbox", label: "Inbox", icon: Inbox, match: ["/inbox"] },
  {
    href: "/catalogue",
    label: "Catalogue",
    icon: Package,
    match: ["/catalogue"],
  },
  {
    href: "/dashboard",
    label: "Analytics",
    icon: ChartColumn,
    match: ["/dashboard", "/customers"],
  },
];

const Logo = ({ light = false }: { light?: boolean }) => (
  <Link
    href="/"
    aria-label="SellAI home"
    className={`flex items-center gap-2.5 no-underline ${light ? "text-[#F7F4EE]" : "text-[#15201B]"}`}
  >
    <span
      className={`flex size-[34px] items-center justify-center rounded-[11px_11px_11px_3px] font-display text-[19px] font-bold ${
        light ? "bg-[#F7F4EE] text-forest" : "bg-forest text-[#F7F4EE]"
      }`}
    >
      S
    </span>
    <span className="font-display text-[22px] font-bold tracking-[-0.7px]">
      SellAI
    </span>
  </Link>
);

/** Sidebar on desktop, top bar plus bottom tabs on phones. Wrap every seller page in this. */
export default function SellerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [who, setWho] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((m) => setWho(m.who ?? null))
      .catch(() => {});
  }, []);
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.replace("/login");
  }
  const isActive = (match: string[]) =>
    match.some((m) => pathname === m || pathname.startsWith(`${m}/`));

  return (
    <div className="min-h-dvh bg-[#F7F4EE] text-[#15201B]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[max(20%,240px)] flex-col gap-2 bg-forest px-5 py-7 lg:flex">
        <div className="mb-12 px-2">
          <Logo light />
        </div>
        <nav aria-label="Seller" className="flex flex-col gap-1">
          {links.map(({ href, label, icon: Icon, match }) => {
            const active = isActive(match);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-bold no-underline transition ${
                  active
                    ? "bg-[#F7F4EE] text-forest"
                    : "text-[#CDEBDC] hover:bg-white/10 hover:text-[#F7F4EE]"
                }`}
              >
                <Icon aria-hidden size={19} strokeWidth={2.2} />
                {label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/shop"
          className="mt-auto flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold text-[#CDEBDC] no-underline transition hover:bg-white/10 hover:text-[#F7F4EE]"
        >
          <ExternalLink aria-hidden size={17} strokeWidth={2.2} />
          View my shop
        </Link>
        {who && <p className="m-0 truncate px-3 pt-2 text-xs text-[#CDEBDC]/80">Signed in as {who}</p>}
        <button
          type="button"
          onClick={signOut}
          className="flex h-11 cursor-pointer items-center gap-3 rounded-xl border-0 bg-transparent px-3 text-left text-sm font-bold text-[#CDEBDC] transition hover:bg-white/10 hover:text-[#F7F4EE]"
        >
          <LogOut aria-hidden size={17} strokeWidth={2.2} />
          Sign out
        </button>
      </aside>

      {/* Phone and tablet top bar */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#E3DACB] bg-[#F7F4EE]/95 px-4 backdrop-blur-md md:px-8 lg:hidden">
        <Logo />
        <div className="flex items-center gap-4">
          <Link
            href="/shop"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-forest no-underline"
          >
            View shop
            <ExternalLink aria-hidden size={15} strokeWidth={2.2} />
          </Link>
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className="inline-flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 text-[#5C635E]"
          >
            <LogOut aria-hidden size={18} strokeWidth={2.2} />
          </button>
        </div>
      </header>

      <main className="pb-28 lg:pb-0 lg:pl-[max(20%,240px)]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-6 md:px-8 lg:py-10">
          {children}
        </div>
      </main>

      {/* Phone and tablet bottom tabs */}
      <nav
        aria-label="Seller"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[#E3DACB] bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {links.map(({ href, label, icon: Icon, match }) => {
          const active = isActive(match);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11.5px] font-bold no-underline ${
                active ? "text-forest" : "text-[#5C635E]"
              }`}
            >
              <span
                className={`flex h-7 w-12 items-center justify-center rounded-full ${active ? "bg-[#E2F3EA]" : ""}`}
              >
                <Icon aria-hidden size={19} strokeWidth={2.2} />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
