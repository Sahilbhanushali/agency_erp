import StatusBadge from "@/components/shared/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Project } from "@/types/project";
import RowActions from "./RowActions";
import { cellClass, headClass, rowClass } from "./table-styles";

interface ProjectsListTableProps {
  projects: Project[];
  onView: (project: Project) => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}

export default function ProjectsListTable({
  projects,
  onView,
  onEdit,
  onDelete,
}: ProjectsListTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={`${headClass} w-14 text-center`}>#</TableHead>
          <TableHead className={headClass}>Project Title</TableHead>
          <TableHead className={headClass}>Client</TableHead>
          <TableHead className={headClass}>Project Manager</TableHead>
          <TableHead className={headClass}>Target Deadline</TableHead>
          <TableHead className={headClass}>Status</TableHead>
          <TableHead className={`${headClass} text-end pe-6`}>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((project, index) => (
          <TableRow
            key={project.id}
            className={`cursor-pointer ${rowClass}`}
            onClick={() => onView(project)}
          >
            <TableCell
              className={`${cellClass} text-center font-mono text-xs text-muted-foreground`}
            >
              {String(index + 1).padStart(2, "0")}
            </TableCell>
            <TableCell className={cellClass}>
              <div className="flex items-center gap-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-border/50"
                  style={{ backgroundColor: project.colorHex ?? "var(--primary)" }}
                />
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {project.title}
                  </span>
                  {project.description && (
                    <span className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                      {project.description}
                    </span>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell className={`${cellClass} text-xs font-medium text-foreground/80`}>
              {project.client?.name ?? "—"}
            </TableCell>
            <TableCell className={cellClass}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground font-semibold text-[10px] flex items-center justify-center shrink-0 border border-border">
                  {project.manager?.firstName?.[0]?.toUpperCase() ?? "U"}
                </div>
                <span className="text-xs text-foreground/90">
                  {project.manager
                    ? `${project.manager.firstName} ${project.manager.lastName}`
                    : "Unassigned"}
                </span>
              </div>
            </TableCell>
            <TableCell className={`${cellClass} text-xs text-muted-foreground font-mono`}>
              {project.deadline ? project.deadline.slice(0, 10) : "—"}
            </TableCell>
            <TableCell className={cellClass}>
              <StatusBadge status={project.status} />
            </TableCell>
            <TableCell className={`${cellClass} text-end pe-6`}>
              <RowActions
                label={project.title}
                onView={() => onView(project)}
                onEdit={() => onEdit(project)}
                onDelete={() => onDelete(project)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
