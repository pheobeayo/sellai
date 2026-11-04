import { ArrowRight } from "lucide-react";
import { waLink } from "./utils";

const EmptyCatalogue = ({ shop }: { shop: string }) => (
  <div className="flex flex-col items-start gap-4 rounded-[28px] border border-dashed border-[#E3DACB] bg-white p-8">
    <p className="m-0 font-display text-[22px] font-bold tracking-[-0.5px]">
      The catalogue is loading.
    </p>
    <p className="m-0 text-[15px] text-[#5C635E]">
      You can still ask {shop} anything in the meantime.
    </p>
    <a
      href={waLink(`Hi ${shop}!`)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-[50px] items-center gap-2.5 rounded-full bg-forest px-6 text-[15px] font-bold text-[#F7F4EE] no-underline"
    >
      Message the shop on WhatsApp
      <ArrowRight aria-hidden size={18} strokeWidth={2.4} />
    </a>
  </div>
);

export default EmptyCatalogue;
