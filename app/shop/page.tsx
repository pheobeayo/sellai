import Link from "next/link";
import type { Product } from "@/domain/types";
import { seedVendor } from "@/store/seed";
import { store } from "@/store/store";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

export const dynamic = "force-dynamic"; // the shop shows the live catalogue

export const metadata = {
  title: "Shop · SellAI",
  description:
    "Browse the live catalogue and ask about any product on WhatsApp.",
};

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

function waLink(text: string) {
  const number = (
    process.env.VENDOR_WHATSAPP_NUMBER || seedVendor.whatsappNumber
  ).replace(/\D/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

async function loadProducts(): Promise<Product[]> {
  try {
    return (await store.products()).slice(0, 6);
  } catch {
    return []; // the shop must never fail because the database is down
  }
}

// Colour blocks for products without a photo, picked from the name so each product keeps the same one.
const tints = ["#2B2420", "#4A3426", "#6B1F2E", "#1F5A44", "#B4471F"];

function describe(p: Product) {
  const inStock = p.variants.filter((v) => v.stock > 0);
  const from = Math.min(
    ...(inStock.length ? inStock : p.variants).map((v) => v.priceNaira),
  );
  const initials = p.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  const tint =
    tints[[...p.name].reduce((n, c) => n + c.charCodeAt(0), 0) % tints.length];
  return {
    inStock,
    from,
    initials,
    tint,
    href: waLink(`Hi! How much is the ${p.name}?`),
  };
}

const Arrow = ({ className = "" }: { className?: string }) => (
  <svg
    aria-hidden
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

function ProductImage({
  p,
  tint,
  initials,
  className,
}: {
  p: Product;
  tint: string;
  initials: string;
  className: string;
}) {
  return (
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
}

function StockLine({ inStock }: { inStock: Product["variants"] }) {
  return inStock.length ? (
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
}

/** The first product: big photo, every variant with its price, and the WhatsApp message preview. */
function FeaturedCard({ p }: { p: Product }) {
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
          <Arrow />
        </span>
      </div>
    </a>
  );
}

/** Every other product: compact horizontal card. Width is set by where it sits. */
function Card({ p, className = "" }: { p: Product; className?: string }) {
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
      <ProductText p={p} d={d} />
    </a>
  );
}

function ProductText({ p, d }: { p: Product; d: ReturnType<typeof describe> }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 py-1">
      <h2 className="m-0 font-display text-[17px] font-bold leading-tight tracking-[-0.4px] md:text-[19px]">
        {p.name}
      </h2>
      <span className="font-display text-[20px] font-bold leading-none text-[#1F5A44] md:text-[22px]">
        <span className="mr-1 font-[family-name:var(--font-body)] text-[13px] font-medium text-[#5C635E]">
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
        <Arrow className="transition group-hover:translate-x-0.5" />
      </span>
    </div>
  );
}

const buyingSteps = [
  {
    title: "Tap a product",
    body: "WhatsApp opens with your question already typed.",
  },
  {
    title: "Get the real price",
    body: "Price, stock and delivery to your city, checked before it is sent.",
  },
  {
    title: "Confirm your order",
    body: "Tap the order link, send it, and pay the vendor directly.",
  },
];

const Shop = async () => {
  const products = await loadProducts();
  const shop = seedVendor.businessName;
  const [featured, ...rest] = products;
  const side = rest.slice(0, 2); // stacked beside the featured card
  const more = rest.slice(2); // the row underneath
  const shopInitials = shop
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <section className="text-[#15201B]">
      <Header />
      <div className="mx-auto w-[90%] pt-[96px] md:pt-[112px]">
        {/* Store header */}
        <div className="flex flex-col gap-5 border-b border-[#E3DACB] pb-8 md:pb-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex size-[52px] items-center justify-center rounded-full bg-[#B4471F] font-display text-[19px] font-bold text-[#F7F4EE]">
              {shopInitials}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#E2F3EA] px-3.5 py-2 text-[13px] font-bold text-[#1F5A44]">
              <span className="size-2 rounded-full bg-forest" />
              Replies on WhatsApp in minutes
            </span>
          </div>
          <h1 className="m-0 font-display text-[40px] font-bold leading-none tracking-[-1.3px] md:text-[60px] md:tracking-[-2px]">
            Shop {shop}
          </h1>
          <p className="m-0 max-w-[620px] text-base leading-[1.55] text-[#5C635E] md:text-[17px]">
            Live catalogue. Tap a product to ask about it on WhatsApp. SellAI
            answers with the real price, what’s in stock and your delivery fee,
            in whichever language you write.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] text-[#5C635E]">
            {[
              "Prices from the live catalogue",
              "Pidgin, Yoruba, Igbo, Hausa or English",
            ].map((t) => (
              <span key={t} className="inline-flex items-center gap-2">
                <svg
                  aria-hidden
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#2F7A5E"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Catalogue */}
        <div className="py-8 md:py-10">
          {featured ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
                <FeaturedCard p={featured} />
                {side.length > 0 && (
                  <div className="flex flex-col gap-5 md:flex-row lg:w-[calc(33.333%-10px)] lg:flex-col">
                    {side.map((p) => (
                      <Card key={p.id} p={p} className="w-full md:flex-1" />
                    ))}
                  </div>
                )}
              </div>
              {more.length > 0 && (
                <div className="flex flex-wrap gap-5">
                  {more.map((p) => (
                    <Card
                      key={p.id}
                      p={p}
                      className="w-full md:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]"
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-4 rounded-[28px] border border-dashed border-[#E3DACB] bg-white p-8">
              <p className="m-0 font-display text-[22px] font-bold tracking-[-0.5px]">
                The catalogue is loading.
              </p>
              <p className="m-0 text-[15px] text-[#5C635E]">
                You can still ask {shop} anything in the meantime.
              </p>
              <a
                href={waLink(`Hi ${shop}!`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-[50px] items-center gap-2.5 rounded-full bg-forest px-6 text-[15px] font-bold text-[#F7F4EE] no-underline"
              >
                Message the shop on WhatsApp
                <Arrow />
              </a>
            </div>
          )}
        </div>

        {/* How buying works */}
        <div className="mb-6 flex flex-col gap-6 rounded-t-[26px] bg-forest px-5 py-8 md:rounded-t-[32px] md:px-10 lg:flex-row lg:items-center lg:gap-5">
          <h2 className="m-0 font-display text-[22px] font-bold leading-[1.05] tracking-[-0.6px] text-[#F7F4EE] md:text-[26px] lg:w-[20%]">
            How buying works
          </h2>
          <ol className="m-0 flex list-none flex-col gap-5 p-0 md:flex-row lg:flex-1">
            {buyingSteps.map((s, i) => (
              <li key={s.title} className="flex flex-1 items-start gap-3.5">
                <span className="flex size-9 flex-none items-center justify-center rounded-full bg-[#F7F4EE] text-[13px] font-bold text-[#B4471F]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="m-0 mb-1 text-[15.5px] font-bold text-[#F7F4EE]">
                    {s.title}
                  </h3>
                  <p className="m-0 text-[13.5px] leading-normal text-[#CDEBDC]">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <Footer />
    </section>
  );
};

export default Shop;
