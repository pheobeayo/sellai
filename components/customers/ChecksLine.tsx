import { Check, CircleAlert, X } from "lucide-react";
import type { CheckReport } from "@/agent/checks";

export default function ChecksLine({ report }: { report: CheckReport }) {
  const failed = report.checks.filter((c) => !c.ok);
  if (!failed.length)
    return (
      <p className="m-0 flex items-center gap-1.5 text-[13px] font-bold text-[#1F5A44]">
        <Check aria-hidden size={14} strokeWidth={3} />
        All {report.checks.length} message checks passed
      </p>
    );
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {failed.map((c) => {
        const block = c.severity === "block";
        const Icon = block ? X : CircleAlert;
        return (
          <li
            key={c.id}
            className={`flex items-start gap-1.5 text-[13px] leading-normal ${block ? "font-bold text-[#9A3A16]" : "text-[#7A5A0B]"}`}
          >
            <Icon
              aria-hidden
              size={14}
              strokeWidth={2.6}
              className="mt-0.5 flex-none"
            />
            <span>
              {c.label}
              {c.detail ? `: ${c.detail}` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
