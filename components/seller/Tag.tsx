import type { ReactNode } from "react";

export type TagTone =
  | "green"
  | "solidGreen"
  | "clay"
  | "sand"
  | "grey"
  | "ink"
  | "yellow"
  | "mint"
  | "plum";

const tones: Record<TagTone, string> = {
  green: "bg-[#E2F3EA] text-[#1F5A44]",
  solidGreen: "bg-forest text-[#F7F4EE]",
  clay: "bg-[#FBEDE6] text-[#9A3A16]",
  sand: "bg-[#EFE6D8] text-[#15201B]",
  grey: "bg-[#EEEEEA] text-[#5C635E]",
  ink: "bg-[#15201B] text-[#F7F4EE]",
  yellow: "bg-[#FDF0C8] text-[#6B4E06]",
  mint: "bg-[#DDF1E7] text-[#1F5A44]",
  plum: "bg-[#F3E6EE] text-[#7A2452]",
};

/** Small rounded label for intents, channels, tiers and statuses. */
const Tag = ({
  tone = "sand",
  children,
  icon,
}: {
  tone?: TagTone;
  children: ReactNode;
  icon?: ReactNode;
}) => (
  <span
    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold leading-none ${tones[tone]}`}
  >
    {icon}
    {children}
  </span>
);

export default Tag;
