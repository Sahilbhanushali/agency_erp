import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import type { Project, ProjectStatus } from "@/types/project";
import RowActions from "./RowActions";
import { cellClass, headClass, rowClass } from "./table-styles";

const STATUS_STYLES: Record<ProjectStatus, string> = {
    DRAFT: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-300 border-neutral-400/30",
    ACTIVE: "bg-success/15 text-success border-success/30",
    ON_HOLD: "bg-warning/20 text-warning-foreground dark:text-warning border-warning/40",
    IN_REVIEW: "bg-info/15 text-info border-info/30",
    COMPLETED: "bg-success/15 text-success border-success/30",
    ARCHIVED: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-300 border-neutral-400/30",
    CANCELLED: "bg-destructive/15 text-destructive border-destructive/30",
};

interface ProjectsListTableProps {
    projects: Project[];
    onView: (project: Project) => void;
    onEdit: (project: Project) => void;
    onDelete: (project: Project) => void;
}

export default function ProjectsListTable({ projects, onView, onEdit, onDelete }: ProjectsListTableProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow className="hover:bg-transparent">
                    <TableHead className={`${headClass} rounded-tl-xl w-[64px]`}>#</TableHead>
                    <TableHead className={headClass}>Title</TableHead>
                    <TableHead className={headClass}>Client</TableHead>
                    <TableHead className={headClass}>Manager</TableHead>
                    <TableHead className={headClass}>Deadline</TableHead>
                    <TableHead className={headClass}>Status</TableHead>
                    <TableHead className={`${headClass} text-center rounded-tr-xl`}>Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {projects.map((project, index) => (
                    <TableRow key={project.id} className={`cursor-pointer ${rowClass}`} onClick={() => onView(project)}>
                        <TableCell className={`${cellClass} text-neutral-400`}>{String(index + 1).padStart(2, "0")}</TableCell>
                        <TableCell className={cellClass}>
                            <div className="flex items-center gap-2.5">
                                <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: project.colorHex ?? "#94a3b8" }}
                                />
                                <span className="font-medium text-neutral-900 dark:text-white">{project.title}</span>
                            </div>
                        </TableCell>
                        <TableCell className={cellClass}>{project.client.name}</TableCell>
                        <TableCell className={cellClass}>{project.manager.firstName} {project.manager.lastName}</TableCell>
                        <TableCell className={cellClass}>{project.deadline ? project.deadline.slice(0, 10) : "—"}</TableCell>
                        <TableCell className={cellClass}>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[project.status]}`}>
                                {project.status.replace("_", " ")}
                            </span>
                        </TableCell>
                        <TableCell className={cellClass}>
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
