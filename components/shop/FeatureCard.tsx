import type { Product } from "@/domain/types";
import { ArrowRight } from "lucide-react";
import ProductImage from "./ProductImage";
import StockLine from "./StockLine";
import { describe, naira } from "./utils";

const FeaturedCard = ({ p }: { p: Product }) => {
  const d = describe(p);
  return (
    <a
      href={d.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex w-full flex-col gap-5 rounded-[28px] border border-[#E3DACB] bg-white p-3.5 text-[#15201B] no-underline transition hover:-translate-y-0.5 hover:border-forest motion-reduce:transition-none md:flex-row md:items-center md:gap-7 lg:w-[calc(66.666%-10px)]"
    >
      <div className="relative md:w-[260px] md:flex-none xl:w-[300px]">
        <ProductImage
          p={p}
          tint={d.tint}
          initials={d.initials}
          className="aspect-[4/3] w-full md:aspect-square"
        />
        <span className="absolute left-3.5 top-3.5 rounded-full bg-[#F2C14E] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.6px] text-[#15201B]">
          Featured
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4 px-2 pb-2 md:py-2 md:pr-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h2 className="m-0 font-display text-[26px] font-bold tracking-[-0.8px] md:text-[28px]">
              {p.name}
            </h2>
            <StockLine inStock={d.inStock} />
          </div>
          <span className="font-display text-[28px] font-bold tracking-[-1px] text-[#1F5A44] md:text-[32px]">
            <span className="mr-1 font-[family-name:var(--font-body)] text-[13px] font-medium tracking-normal text-[#5C635E]">
              from
            </span>
            {naira(d.from)}
          </span>
        </div>

        {p.variants.length > 0 && (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {p.variants.map((v) => (
              <li
                key={v.label}
                className={`flex items-center gap-2 rounded-xl border-2 px-3.5 py-2 text-sm font-bold ${
                  v.stock > 0
                    ? "border-[#E3DACB] text-[#15201B]"
                    : "border-dashed border-[#E3DACB] text-[#5C635E] line-through"
                }`}
              >
                {v.label}
                <span className="font-medium text-[#5C635E]">
                  {naira(v.priceNaira)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-2xl bg-[#F7F4EE] px-3.5 py-3 text-[13.5px] leading-normal">
          <span className="mb-0.5 block text-[11px] font-bold uppercase tracking-[0.8px] text-[#B4471F]">
            WhatsApp opens with
          </span>
          “Hi! How much is the {p.name}?”
        </div>

        <span className="inline-flex h-[50px] w-full items-center justify-center gap-2.5 rounded-full bg-forest px-6 text-[15px] font-bold text-[#F7F4EE] transition group-hover:brightness-110 sm:w-fit">
          Ask on WhatsApp
          <ArrowRight aria-hidden size={18} strokeWidth={2.4} />
        </span>
      </div>
    </a>
  );
};

export default FeaturedCard;
