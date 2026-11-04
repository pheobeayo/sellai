"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  ChartColumn,
  House,
  Inbox,
  LogIn,
  Package,
  Store,
  type LucideIcon,
} from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import SellerShell from "../components/seller/SellerShell";

export const SELLER_PATHS = [
  "/inbox",
  "/catalogue",
  "/dashboard",
  "/customers",
];

type RouteLink = { href: string; label: string; sub: string; icon: LucideIcon };

const sellerLinks: RouteLink[] = [
  {
    href: "/inbox",
    label: "Inbox",
    sub: "Messages and draft replies",
    icon: Inbox,
  },
  {
    href: "/catalogue",
    label: "Catalogue",
    sub: "Turn photos into listings",
    icon: Package,
  },
  {
    href: "/dashboard",
    label: "Analytics",
    sub: "Sales and loyal customers",
    icon: ChartColumn,
  },
];

const publicLinks: RouteLink[] = [
  {
    href: "/",
    label: "Home",
    sub: "What SellAI does for vendors",
    icon: House,
  },
  {
    href: "/shop",
    label: "Shop",
    sub: "Browse the live catalogue",
    icon: Store,
  },
  {
    href: "/login",
    label: "Seller login",
    sub: "Open your sales desk",
    icon: LogIn,
  },
];

const isSellerPath = (path: string) =>
  SELLER_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

function Chat({ reply }: { reply: string }) {
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-3" aria-hidden>
      <span className="font-display text-[96px] font-bold leading-none tracking-[-4px] text-[#E3DACB] md:text-[140px]">
        404
      </span>
      <div className="max-w-[300px] -rotate-2 self-start rounded-[18px_18px_18px_4px] bg-white px-4 py-3 text-[15px] leading-normal shadow-[0_14px_34px_rgba(21,32,27,0.12)]">
        <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.8px] text-[#B4471F]">
          You
        </span>
        Abeg, where this page dey?
      </div>
      <div className="max-w-[320px] rotate-1 self-end rounded-[18px_18px_4px_18px] bg-[#E2F3EA] px-4 py-3 text-[15px] leading-normal shadow-[0_14px_34px_rgba(21,32,27,0.12)]">
        <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.8px] text-forest">
          SellAI
        </span>
        {reply}
      </div>
    </div>
  );
}

function WayBack({
  title,
  body,
  links,
}: {
  title: string;
  body: string;
  links: RouteLink[];
}) {
  return (
    <div className="flex w-full max-w-[460px] flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 font-display text-[36px] font-bold leading-[1.05] tracking-[-1.2px] md:text-[44px]">
          {title}
        </h1>
        <p className="m-0 text-base leading-[1.55] text-[#5C635E]">{body}</p>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {links.map(({ href, label, sub, icon: Icon }, i) => (
          <li key={href}>
            <Link
              href={href}
              className={`group flex items-center gap-4 rounded-2xl border-2 px-4 py-3.5 no-underline transition hover:-translate-y-0.5 motion-reduce:transition-none ${
                i === 0
                  ? "border-forest bg-forest text-[#F7F4EE]"
                  : "border-[#E3DACB] bg-white text-[#15201B] hover:border-forest"
              }`}
            >
              <span
                className={`flex size-10 flex-none items-center justify-center rounded-xl ${i === 0 ? "bg-[#F7F4EE] text-forest" : "bg-[#E2F3EA] text-forest"}`}
              >
                <Icon aria-hidden size={19} strokeWidth={2.2} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[15px] font-bold">{label}</span>
                <span
                  className={`text-[13px] ${i === 0 ? "text-[#DCEFE5]" : "text-[#5C635E]"}`}
                >
                  {sub}
                </span>
              </span>
              <ArrowRight
                aria-hidden
                size={18}
                strokeWidth={2.4}
                className={`ml-auto transition group-hover:translate-x-0.5 ${i === 0 ? "" : "text-forest"}`}
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function NotFound() {
  const pathname = usePathname() ?? "/";

  if (isSellerPath(pathname)) {
    return (
      <SellerShell>
        <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-12 md:flex-row md:gap-16">
          <Chat reply="This one no dey your sales desk o. Make I carry you go back." />
          <WayBack
            title="This page isn’t in your sales desk."
            body="The link may be old or mistyped. Pick up where you left off."
            links={sellerLinks}
          />
        </div>
      </SellerShell>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#F7F4EE] text-[#15201B]">
      <Header />
      <main className="mx-auto flex w-[90%] max-w-[1120px] flex-1 flex-col items-center justify-center gap-12 pb-16 pt-[112px] md:flex-row md:gap-16 md:pt-[128px]">
        <Chat reply="This page no dey o. Make I carry you go where you fit find wetin you want." />
        <WayBack
          title="This page doesn’t exist."
          body="The link may be old or mistyped. Here’s where you can go instead."
          links={publicLinks}
        />
      </main>
      <Footer />
    </div>
  );
}
