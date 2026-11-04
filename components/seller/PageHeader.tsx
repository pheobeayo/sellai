import type { ReactNode } from "react";

type Props = { title: string; description?: ReactNode; actions?: ReactNode };

/** Page title, one-line description and any controls on the right. */
const PageHeader = ({ title, description, actions }: Props) => (
  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div className="flex max-w-[640px] flex-col gap-1.5">
      <h1 className="m-0 font-display text-[30px] font-bold leading-[1.05] tracking-[-1px] md:text-[38px]">
        {title}
      </h1>
      {description && (
        <p className="m-0 text-[15px] leading-normal text-[#5C635E]">
          {description}
        </p>
      )}
    </div>
    {actions && (
      <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
    )}
  </div>
);

export default PageHeader;
