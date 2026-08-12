import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
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

export default function CompaniesListTable({ companies, onView, onEdit, onDelete }: CompaniesListTableProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow className="hover:bg-transparent">
                    <TableHead className={`${headClass} rounded-tl-xl w-[64px]`}>#</TableHead>
                    <TableHead className={headClass}>Name</TableHead>
                    <TableHead className={headClass}>Email</TableHead>
                    <TableHead className={headClass}>Phone</TableHead>
                    <TableHead className={headClass}>Currency</TableHead>
                    <TableHead className={headClass}>Status</TableHead>
                    <TableHead className={`${headClass} text-center rounded-tr-xl`}>Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {companies.map((company, index) => (
                    <TableRow key={company.id} className={`cursor-pointer ${rowClass}`} onClick={() => onView(company)}>
                        <TableCell className={`${cellClass} text-neutral-400`}>{String(index + 1).padStart(2, "0")}</TableCell>
                        <TableCell className={cellClass}>
                            <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary font-semibold shrink-0">
                                    {company.name[0]?.toUpperCase()}
                                </span>
                                <span className="font-medium text-neutral-900 dark:text-white">{company.name}</span>
                            </div>
                        </TableCell>
                        <TableCell className={cellClass}>{company.email || "—"}</TableCell>
                        <TableCell className={cellClass}>{company.phone || "—"}</TableCell>
                        <TableCell className={cellClass}>{company.currency}</TableCell>
                        <TableCell className={cellClass}>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${company.isActive ? "bg-success/15 text-success border-success/30" : "bg-neutral-500/15 text-neutral-500 dark:text-neutral-300 border-neutral-400/30"}`}>
                                {company.isActive ? "ACTIVE" : "INACTIVE"}
                            </span>
                        </TableCell>
                        <TableCell className={cellClass}>
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
