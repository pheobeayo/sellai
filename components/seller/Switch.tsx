type Props = { checked: boolean; onChange: () => void; label: string };

/** Accessible on/off switch. */
const Switch = ({ checked, onChange, label }: Props) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    className={`relative h-7 w-12 flex-none cursor-pointer rounded-full border-0 transition ${checked ? "bg-forest" : "bg-[#D9CFBF]"}`}
  >
    <span
      className={`absolute left-1 top-1 size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}
    />
  </button>
);

export default Switch;
