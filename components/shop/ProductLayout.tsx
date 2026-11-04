import type { Product } from "@/domain/types";
import FeaturedCard from "./FeatureCard";
import ProductCard from "./ProductCard";

/** Featured product with two cards stacked beside it, then the rest three across. */
const ProductLayout = ({ products }: { products: Product[] }) => {
  const [featured, ...rest] = products;
  const side = rest.slice(0, 2);
  const more = rest.slice(2);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
        <FeaturedCard p={featured} />
        {side.length > 0 && (
          <div className="flex flex-col gap-5 md:flex-row lg:w-[calc(33.333%-10px)] lg:flex-col">
            {side.map((p) => (
              <ProductCard key={p.id} p={p} className="w-full md:flex-1" />
            ))}
          </div>
        )}
      </div>
      {more.length > 0 && (
        <div className="flex flex-wrap gap-5">
          {more.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              className="w-full md:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductLayout;
