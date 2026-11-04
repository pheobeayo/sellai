import type { Product } from "@/domain/types";

const StockLine = ({ inStock }: { inStock: Product["variants"] }) =>
  inStock.length ? (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#1F5A44]">
      <span className="size-2 rounded-full bg-forest" />
      In stock
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#B4471F]">
      <span className="size-2 rounded-full bg-[#B4471F]" />
      Sold out
    </span>
  );

export default StockLine;
