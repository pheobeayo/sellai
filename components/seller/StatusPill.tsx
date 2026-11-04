import Tag, { type TagTone } from "./Tag";

const tone: Record<string, TagTone> = {
  draft: "sand",
  confirmed: "yellow",
  paid: "green",
  cancelled: "grey",
};

/** Order or reward status. Unknown statuses fall back to a neutral tag. */
const StatusPill = ({ status, label }: { status: string; label?: string }) => (
  <Tag tone={tone[status] ?? "sand"}>
    <span className="capitalize">{label ?? status}</span>
  </Tag>
);

export default StatusPill;
