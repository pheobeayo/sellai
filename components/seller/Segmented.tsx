type Option<T extends string | number> = { value: T; label: string };
type Props<T extends string | number> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
};

/** Pill-shaped segmented control for filters and periods. */
export default function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: Props<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex max-w-full overflow-x-auto rounded-full bg-[#EFE6D8] p-1 [scrollbar-width:none]"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`h-9 cursor-pointer whitespace-nowrap rounded-full border-0 px-4 text-[13px] font-bold transition ${
              on
                ? "bg-white text-[#15201B] shadow-[0_1px_3px_rgba(21,32,27,0.12)]"
                : "bg-transparent text-[#5C635E] hover:text-[#15201B]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
