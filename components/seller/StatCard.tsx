type Props = { label: string; value: string; sub?: string; hero?: boolean };

/** One number with a label. The hero version is the big green card. */
const StatCard = ({ label, value, sub, hero = false }: Props) => (
  <div
    className={`flex min-w-[140px] flex-1 flex-col gap-1.5 rounded-[24px] p-5 md:p-6 ${
      hero
        ? "basis-full bg-forest text-[#F7F4EE] md:basis-[calc(40%-12px)]"
        : "basis-[calc(50%-8px)] border border-[#E3DACB] bg-white md:basis-0"
    }`}
  >
    <span
      className={`text-[11px] font-bold uppercase tracking-[0.8px] ${hero ? "text-[#CDEBDC]" : "text-[#5C635E]"}`}
    >
      {label}
    </span>
    <span
      className={`font-display font-bold leading-none tracking-[-1px] ${hero ? "text-[38px] md:text-[44px]" : "text-[28px] md:text-[32px]"}`}
    >
      {value}
    </span>
    {sub && (
      <span
        className={`text-[13px] leading-normal ${hero ? "text-[#DCEFE5]" : "text-[#5C635E]"}`}
      >
        {sub}
      </span>
    )}
  </div>
);

export default StatCard;
