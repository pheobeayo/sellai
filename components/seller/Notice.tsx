import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

type Tone = "error" | "success" | "warning" | "info";

const tones: Record<Tone, { box: string; Icon: typeof Info }> = {
  error: {
    box: "border-[#F1C9B6] bg-[#FBEDE6] text-[#8A3214]",
    Icon: CircleAlert,
  },
  success: {
    box: "border-[#BFE3D0] bg-[#E2F3EA] text-[#1F5A44]",
    Icon: CircleCheck,
  },
  warning: {
    box: "border-[#F0D99A] bg-[#FDF4DC] text-[#7A5A0B]",
    Icon: TriangleAlert,
  },
  info: { box: "border-[#E3DACB] bg-[#F7F4EE] text-[#15201B]", Icon: Info },
};

/** Coloured message strip for errors, confirmations and warnings. */
const Notice = ({
  tone,
  children,
  className = "",
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) => {
  const { box, Icon } = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm leading-normal ${box} ${className}`}
    >
      <Icon
        aria-hidden
        size={18}
        strokeWidth={2.2}
        className="mt-px flex-none"
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
};

export default Notice;