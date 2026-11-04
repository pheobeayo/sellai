const steps = [
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

const BuyingSteps = () => (
  <div className="mb-6 flex flex-col gap-6 rounded-t-[26px] bg-forest px-5 py-8 md:rounded-t-[32px] md:px-10 lg:flex-row lg:items-center lg:gap-5">
    <h2 className="m-0 font-display text-[22px] font-bold leading-[1.05] tracking-[-0.6px] text-[#F7F4EE] md:text-[26px] lg:w-[20%]">
      How buying works
    </h2>
    <ol className="m-0 flex list-none flex-col gap-5 p-0 md:flex-row lg:flex-1">
      {steps.map((s, i) => (
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
);

export default BuyingSteps;
