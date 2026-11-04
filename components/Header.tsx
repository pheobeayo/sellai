"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Squash as Hamburger } from "hamburger-react";

const links = [
  { href: "/shop", label: "Shop" },
  { href: "/#how", label: "How it works" },
];

const Header = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const desktop = window.matchMedia("(min-width: 768px)");
    const onResize = (e: MediaQueryListEvent) => e.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onResize);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onResize);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-200  ${
        scrolled || open
          ? "bg-[#F7F4EE]/90 shadow-[0_1px_0_#E3DACB] backdrop-blur-md"
          : "bg-[#F7F4EE]"
      }`}
    >
      <div className="flex items-center justify-between gap-6 w-[90%] mx-auto py-6">
        <Link
          href="/"
          aria-label="SellAI home"
          onClick={close}
          className="flex items-center gap-2.5 text-[#15201B] no-underline"
        >
          <span className="flex size-9.5 items-center justify-center rounded-[12px_12px_12px_3px] bg-forest font-display text-[21px] font-bold text-[#F7F4EE]">
            S
          </span>
          <span className="font-display text-[25px] font-bold tracking-[-0.8px]">
            SellAI
          </span>
        </Link>
        <nav
          aria-label="Main"
          className="hidden items-center gap-8 text-[15px] font-medium md:flex"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[#5C635E] no-underline hover:text-[#15201B]"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="flex h-11 items-center rounded-full border-2 border-[#2F7A5E] px-5 font-bold text-[#2F7A5E] no-underline hover:bg-[#2F7A5E] hover:text-[#F7F4EE]"
          >
            Seller login
          </Link>
        </nav>
        <div className="-mr-2.5 md:hidden">
          <Hamburger
            toggled={open}
            toggle={setOpen}
            size={22}
            color="#15201B"
            rounded
            label={open ? "Close menu" : "Open menu"}
          />
        </div>
      </div>
      {open && (
        <nav
          aria-label="Mobile"
          className="flex h-[calc(100dvh-72px)] flex-col overflow-y-auto border-t border-[#E3DACB] bg-[#F7F4EE] pb-8 pt-2 md:hidden lg:hidden px-6"
        >
          <ul className="m-0 list-none p-0">
            {links.map((l, i) => (
              <li key={l.href} className="border-b border-[#E3DACB]">
                <Link
                  href={l.href}
                  onClick={close}
                  className="flex items-center justify-between py-5 font-display text-[18px] font-bold tracking-[-0.6px] text-[#15201B] no-underline"
                >
                  {l.label}
                  <span className="text-[13px] font-bold text-[#B4471F]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/login"
            onClick={close}
            className="mt-auto flex h-14 items-center justify-center rounded-2xl bg-forest text-base font-bold text-[#F7F4EE] no-underline"
          >
            Seller login
          </Link>
        </nav>
      )}
    </header>
  );
};

export default Header;
