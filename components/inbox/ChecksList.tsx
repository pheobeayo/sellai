import { Check, CircleAlert, X } from "lucide-react";
import type { CheckReport } from "@/agent/checks";

export default function ChecksList({
  report,
  edited,
}: {
  report: CheckReport;
  edited?: boolean;
}) {
  const failed = report.checks.filter((c) => !c.ok);
  const blocked = failed.filter((c) => c.severity === "block").length;

  const summary = report.clean ? (
    <span className="text-[#1F5A44]">
      All {report.checks.length} checks passed
    </span>
  ) : report.passed ? (
    <span className="text-[#7A5A0B]">
      Safe to send · {failed.length} warning{failed.length > 1 ? "s" : ""}
    </span>
  ) : (
    <span className="text-[#9A3A16]">
      Held: {blocked} check{blocked > 1 ? "s" : ""} failed
    </span>
  );

  return (
    <details
      open={failed.length > 0}
      className="group rounded-2xl border border-[#E3DACB] bg-[#FBFAF7]"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
        <span
          className={`flex size-5 items-center justify-center rounded-full ${
            report.clean
              ? "bg-forest text-white"
              : report.passed
                ? "bg-[#F2C14E] text-[#15201B]"
                : "bg-[#B4471F] text-white"
          }`}
        >
          {report.clean || report.passed ? (
            <Check aria-hidden size={13} strokeWidth={3} />
          ) : (
            <X aria-hidden size={13} strokeWidth={3} />
          )}
        </span>
        {summary}
        {edited && (
          <span className="font-medium text-[#5C635E]">
            · rechecked after your edit
          </span>
        )}
        <span className="ml-auto text-xs font-medium text-[#5C635E] group-open:hidden">
          Show
        </span>
        <span className="ml-auto hidden text-xs font-medium text-[#5C635E] group-open:inline">
          Hide
        </span>
      </summary>
      <ul className="m-0 flex list-none flex-col gap-2 border-t border-[#E3DACB] px-4 py-3">
        {report.checks.map((c) => {
          const tone = c.ok
            ? "text-[#1F5A44]"
            : c.severity === "block"
              ? "text-[#9A3A16]"
              : "text-[#7A5A0B]";
          const Icon = c.ok ? Check : c.severity === "block" ? X : CircleAlert;
          return (
            <li
              key={c.id}
              className="flex items-start gap-2 text-[13px] leading-normal"
            >
              <Icon
                aria-hidden
                size={15}
                strokeWidth={2.6}
                className={`mt-0.5 flex-none ${tone}`}
              />
              <span>
                <span className="sr-only">
                  {c.ok
                    ? "Passed: "
                    : c.severity === "block"
                      ? "Failed: "
                      : "Warning: "}
                </span>
                {c.label}
                {c.detail && (
                  <span className="text-[#5C635E]"> · {c.detail}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
