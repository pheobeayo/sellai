"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard", label: "Sales" },
  { href: "/customers", label: "Customers" },
];

/** Sales and Customers tabs at the top of the Analytics pages. */
export default function AnalyticsTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Analytics"
      className="flex gap-6 border-b border-[#E3DACB]"
    >
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex min-h-11 items-center border-b-[3px] text-[15px] font-bold no-underline transition ${
              active
                ? "border-forest text-[#15201B]"
                : "border-transparent text-[#5C635E] hover:text-[#15201B]"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
