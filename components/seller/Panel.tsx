import type { ReactNode } from "react";

type Props = {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** White rounded card used for every section of the dashboard. */
const Panel = ({
  title,
  description,
  action,
  children,
  className = "",
}: Props) => (
  <section
    className={`flex min-w-0 flex-col gap-4 rounded-[24px] border border-[#E3DACB] bg-white p-5 md:p-6 ${className}`}
  >
    {(title || action) && (
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {title && (
            <h2 className="m-0 font-display text-[19px] font-bold tracking-[-0.4px]">
              {title}
            </h2>
          )}
          {description && (
            <p className="m-0 text-[13px] leading-normal text-[#5C635E]">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
    )}
    {children}
  </section>
);

export default Panel;
