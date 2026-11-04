import type { Product } from "@/domain/types";
import { ArrowRight } from "lucide-react";
import ProductImage from "./ProductImage";
import StockLine from "./StockLine";
import { describe, naira } from "./utils";

const ProductCard = ({
  p,
  className = "",
}: {
  p: Product;
  className?: string;
}) => {
  const d = describe(p);
  return (
    <a
      href={d.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex items-center gap-4 rounded-[24px] border border-[#E3DACB] bg-white p-3 text-[#15201B] no-underline transition hover:-translate-y-0.5 hover:border-forest motion-reduce:transition-none ${className}`}
    >
      <ProductImage
        p={p}
        tint={d.tint}
        initials={d.initials}
        className="size-[112px] md:size-[128px] [&_span]:text-[30px]"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2 py-1">
        <h2 className="m-0 font-display text-[17px] font-bold leading-tight tracking-[-0.4px] md:text-[19px]">
          {p.name}
        </h2>
        <span className="font-display text-[20px] font-bold leading-none text-[#1F5A44] md:text-[22px]">
          <span className="mr-1 font-body text-[13px] font-medium text-[#5C635E]">
            from
          </span>
          {naira(d.from)}
        </span>
        {d.inStock.length ? (
          <div className="flex flex-wrap gap-1.5">
            {d.inStock.map((v) => (
              <span
                key={v.label}
                className="rounded-lg border-[1.5px] border-[#E3DACB] px-2.5 py-1 text-[12.5px] font-bold"
              >
                {v.label}
              </span>
            ))}
          </div>
        ) : (
          <StockLine inStock={d.inStock} />
        )}
        <span className="inline-flex min-h-9 items-center gap-2 text-[14px] font-bold text-forest">
          Ask on WhatsApp
          <ArrowRight
            aria-hidden
            size={18}
            strokeWidth={2.4}
            className="transition group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </a>
  );
};

export default ProductCard;
