import { initialsOf } from "./utils";

const checks = [
  "Prices from the live catalogue",
  "Pidgin, Yoruba, Igbo, Hausa or English",
];

/** Store name, reply badge and short intro at the top of the shop. */
const ShopHeader = ({ shop }: { shop: string }) => (
  <div className="flex flex-col gap-5 border-b border-[#E3DACB] pb-8 md:pb-10">
    <div className="flex flex-wrap items-center gap-3">
      <span className="flex size-[52px] items-center justify-center rounded-full bg-[#B4471F] font-display text-[19px] font-bold text-[#F7F4EE]">
        {initialsOf(shop)}
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
      Live catalogue. Tap a product to ask about it on WhatsApp. SellAI answers
      with the real price, what’s in stock and your delivery fee, in whichever
      language you write.
    </p>
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] text-[#5C635E]">
      {checks.map((t) => (
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
);

export default ShopHeader;
