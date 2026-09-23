import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ChevronRight, Home } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface BreadcrumbData {
  title: string;
  text: string;
  description?: string;
  actions?: ReactNode;
}

const DashboardBreadcrumb = ({
  title,
  text,
  description,
  actions,
}: BreadcrumbData) => {
  return (
    <div className="flex flex-col gap-3 pb-6">
      <Breadcrumb>
        <BreadcrumbList className="gap-1.5 text-xs text-muted-foreground">
          <BreadcrumbItem>
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="w-3 h-3 text-muted-foreground/60" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium text-foreground">
              {text}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2.5 shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
};

export default DashboardBreadcrumb;