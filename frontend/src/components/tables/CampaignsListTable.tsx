import StatusBadge from "@/components/shared/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { humanizeEnum, type Campaign } from "@/types/campaign";
import RowActions from "./RowActions";
import { cellClass, headClass, rowClass } from "./table-styles";

interface CampaignsListTableProps {
  campaigns: Campaign[];
  onView: (campaign: Campaign) => void;
  onEdit: (campaign: Campaign) => void;
  onDelete: (campaign: Campaign) => void;
}

function formatBudget(campaign: Campaign) {
  if (!campaign.budget) return "—";
  const amount = Number(campaign.budget);
  if (!Number.isFinite(amount)) return "—";
  const symbol = campaign.currency === "INR" ? "₹" : `${campaign.currency} `;
  return `${symbol}${amount.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function formatRange(campaign: Campaign) {
  const start = campaign.startDate?.slice(0, 10);
  const end = campaign.endDate?.slice(0, 10);
  if (!start && !end) return "—";
  return `${start ?? "—"} → ${end ?? "—"}`;
}

export default function CampaignsListTable({
  campaigns,
  onView,
  onEdit,
  onDelete,
}: CampaignsListTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={`${headClass} w-14 text-center`}>#</TableHead>
          <TableHead className={headClass}>Campaign</TableHead>
          <TableHead className={headClass}>Client</TableHead>
          <TableHead className={headClass}>Objective</TableHead>
          <TableHead className={headClass}>Run Dates</TableHead>
          <TableHead className={headClass}>Budget</TableHead>
          <TableHead className={headClass}>Status</TableHead>
          <TableHead className={`${headClass} text-end pe-6`}>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.map((campaign, index) => (
          <TableRow
            key={campaign.id}
            className={`cursor-pointer ${rowClass}`}
            onClick={() => onView(campaign)}
          >
            <TableCell
              className={`${cellClass} text-center font-mono text-xs text-muted-foreground`}
            >
              {String(index + 1).padStart(2, "0")}
            </TableCell>
            <TableCell className={cellClass}>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {campaign.name}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {campaign._count?.posts
                    ? `${campaign._count.posts} post${campaign._count.posts === 1 ? "" : "s"}`
                    : "No content yet"}
                  {campaign.project ? ` · ${campaign.project.title}` : ""}
                </span>
              </div>
            </TableCell>
            <TableCell
              className={`${cellClass} text-xs font-medium text-foreground/80`}
            >
              {campaign.client?.name ?? "—"}
            </TableCell>
            <TableCell className={`${cellClass} text-xs text-foreground/90`}>
              {humanizeEnum(campaign.objective)}
            </TableCell>
            <TableCell
              className={`${cellClass} text-xs text-muted-foreground font-mono`}
            >
              {formatRange(campaign)}
            </TableCell>
            <TableCell
              className={`${cellClass} text-xs font-mono text-foreground/90`}
            >
              {formatBudget(campaign)}
            </TableCell>
            <TableCell className={cellClass}>
              <StatusBadge status={campaign.status} />
            </TableCell>
            <TableCell className={`${cellClass} text-end pe-6`}>
              <RowActions
                label={campaign.name}
                onView={() => onView(campaign)}
                onEdit={() => onEdit(campaign)}
                onDelete={() => onDelete(campaign)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
