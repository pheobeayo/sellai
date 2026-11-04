import type { Product } from "@/domain/types";

type Props = { p: Product; tint: string; initials: string; className: string };

/** The product photo, or a colour block with the product's initials when there is no photo. */
const ProductImage = ({ p, tint, initials, className }: Props) => (
  <div
    className={`relative flex flex-none items-center justify-center overflow-hidden rounded-[20px] ${className}`}
    style={{ backgroundColor: p.imageUrl ? "#EFE6D8" : tint }}
  >
    {p.imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={p.imageUrl}
        alt={p.name}
        loading="lazy"
        className="size-full object-cover"
      />
    ) : (
      <span
        aria-hidden
        className="font-display text-[44px] font-bold tracking-[-1px] text-[#F7F4EE]/80"
      >
        {initials}
      </span>
    )}
  </div>
);

export default ProductImage;
