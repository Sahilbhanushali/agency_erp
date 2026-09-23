import StatusBadge from "@/components/shared/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Company } from "@/types/company";
import RowActions from "./RowActions";
import { cellClass, headClass, rowClass } from "./table-styles";

interface CompaniesListTableProps {
  companies: Company[];
  onView: (company: Company) => void;
  onEdit: (company: Company) => void;
  onDelete: (company: Company) => void;
}

export default function CompaniesListTable({
  companies,
  onView,
  onEdit,
  onDelete,
}: CompaniesListTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={`${headClass} w-14 text-center`}>#</TableHead>
          <TableHead className={headClass}>Company Name</TableHead>
          <TableHead className={headClass}>Email Address</TableHead>
          <TableHead className={headClass}>Phone Number</TableHead>
          <TableHead className={headClass}>Base Currency</TableHead>
          <TableHead className={headClass}>Status</TableHead>
          <TableHead className={`${headClass} text-end pe-6`}>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {companies.map((company, index) => (
          <TableRow
            key={company.id}
            className={`cursor-pointer ${rowClass}`}
            onClick={() => onView(company)}
          >
            <TableCell
              className={`${cellClass} text-center font-mono text-xs text-muted-foreground`}
            >
              {String(index + 1).padStart(2, "0")}
            </TableCell>
            <TableCell className={cellClass}>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-xs shrink-0 border border-primary/20">
                  {company.name[0]?.toUpperCase()}
                </div>
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {company.name}
                </span>
              </div>
            </TableCell>
            <TableCell className={`${cellClass} text-xs text-muted-foreground font-mono`}>
              {company.email || "—"}
            </TableCell>
            <TableCell className={`${cellClass} text-xs text-muted-foreground font-mono`}>
              {company.phone || "—"}
            </TableCell>
            <TableCell className={`${cellClass} text-xs font-mono font-medium text-foreground/80`}>
              {company.currency}
            </TableCell>
            <TableCell className={cellClass}>
              <StatusBadge status={company.isActive} />
            </TableCell>
            <TableCell className={`${cellClass} text-end pe-6`}>
              <RowActions
                label={company.name}
                onView={() => onView(company)}
                onEdit={() => onEdit(company)}
                onDelete={() => onDelete(company)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
