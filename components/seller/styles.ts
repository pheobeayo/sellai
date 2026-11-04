// Shared Tailwind class strings for the seller dashboard, so every page looks the same.

export const btn =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full border-0 bg-forest px-5 text-sm font-bold text-[#F7F4EE] no-underline transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";

export const btnGhost =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-[#E3DACB] bg-white px-5 text-sm font-bold text-[#15201B] no-underline transition hover:border-[#15201B] disabled:cursor-not-allowed disabled:opacity-50";

export const btnSm =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full border-0 bg-forest px-3.5 text-[13px] font-bold text-[#F7F4EE] transition hover:brightness-110 disabled:opacity-50";

export const btnSmGhost =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full border-2 border-[#E3DACB] bg-white px-3.5 text-[13px] font-bold text-[#15201B] transition hover:border-[#15201B] disabled:opacity-50";

export const input =
  "h-11 w-full min-w-0 rounded-xl border-2 border-[#E3DACB] bg-white px-3.5 text-[15px] font-normal text-[#15201B] outline-none transition placeholder:text-[#9AA19C] focus:border-forest disabled:bg-[#F7F4EE]";

export const textarea =
  "w-full rounded-xl border-2 border-[#E3DACB] bg-white p-3.5 text-[15px] font-normal leading-relaxed text-[#15201B] outline-none transition placeholder:text-[#9AA19C] focus:border-forest disabled:bg-[#F7F4EE]";

export const fieldLabel =
  "flex flex-col gap-1.5 text-[13px] font-bold text-[#5C635E]";

export const fileInput =
  "block w-full text-sm font-normal text-[#5C635E] file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-forest file:px-4 file:py-2.5 file:text-sm file:font-bold file:text-[#F7F4EE] hover:file:brightness-110 disabled:opacity-50";

export const muted = "text-[13px] leading-normal text-[#5C635E]";

export const code =
  "whitespace-nowrap rounded-md bg-[#EFE6D8] px-1.5 py-0.5 font-mono text-[12.5px] text-[#15201B]";

// Tables
export const tableWrap = "relative -mx-5 overflow-x-auto md:-mx-6";
export const table =
  "w-full min-w-[720px] border-collapse text-sm [&_tbody_tr:last-child_td]:border-b-0";
export const th =
  "whitespace-nowrap border-b border-[#E3DACB] px-3 py-3 text-left text-[11px] font-bold uppercase tracking-[0.8px] text-[#5C635E] first:pl-5 last:pr-5 md:first:pl-6 md:last:pr-6";
export const thNum = `${th} text-right`;
export const td =
  "border-b border-[#EFE6D8] px-3 py-3.5 align-top first:pl-5 last:pr-5 md:first:pl-6 md:last:pr-6";
export const tdNum = `${td} text-right tabular-nums`;
