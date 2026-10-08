
import { Button } from "@/components/ui/button";
import { Table, Grid, Calendar, Users } from "lucide-react";

interface ViewModeSelectorProps {
  viewMode: "table" | "date" | "project" | "grid";
  setViewMode: (mode: "table" | "date" | "project" | "grid") => void;
}

export default function ViewModeSelector({ viewMode, setViewMode }: ViewModeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant={viewMode === "table" ? "default" : "outline"}
        size="sm"
        onClick={() => setViewMode("table")}
        className="h-8 text-xs"
      >
        <Table className="mr-1 h-4 w-4" />
        Table
      </Button>
      <Button
        variant={viewMode === "grid" ? "default" : "outline"}
        size="sm"
        onClick={() => setViewMode("grid")}
        className="h-8 text-xs"
      >
        <Grid className="mr-1 h-4 w-4" />
        Grid
      </Button>
      {/* <Button
        variant={viewMode === "date" ? "default" : "outline"}
        size="sm"
        onClick={() => setViewMode("date")}
        className="h-8 text-xs"
      >
        <Calendar className="mr-1 h-4 w-4" />
        Date
      </Button>
      <Button
        variant={viewMode === "project" ? "default" : "outline"}
        size="sm"
        onClick={() => setViewMode("project")}
        className="h-8 text-xs"
      >
        <Users className="mr-1 h-4 w-4" />
        Project
      </Button> */}
    </div>
  );
}
