import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion, ArrowLeft, LayoutDashboard } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="size-16 rounded-2xl bg-muted/60 border border-border/80 flex items-center justify-center mx-auto shadow-xs">
          <FileQuestion className="size-8 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Page Not Found</h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The page you are looking for does not exist, has been removed, or is temporarily unavailable.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
            <Link href="/dashboard">
              <ArrowLeft className="size-3.5" />
              Back to Dashboard
            </Link>
          </Button>
          <Button asChild size="sm" className="gap-1.5 text-xs">
            <Link href="/dashboard/projects">
              <LayoutDashboard className="size-3.5" />
              View Projects
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
