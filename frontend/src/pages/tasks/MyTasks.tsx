import PageHeader from "@/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import TasksPanel from "./components/TasksPanel";

export default function MyTasks() {
  const { user: actor } = useAuth();
  const [scope, setScope] = useState<"mine" | "all">("mine");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Kanban workflow for production deliverables, design reviews, and engineering tickets."
        breadcrumbs={[{ label: "Tasks" }]}
      />

      <TasksPanel
        title={scope === "mine" ? "Assigned to Me" : "All Tasks"}
        assigneeId={scope === "mine" ? actor?.id : undefined}
        showProject
        emptyText={
          scope === "mine"
            ? "Nothing is assigned to you right now. You are all caught up!"
            : "No tasks are visible to you yet."
        }
        headerExtra={
          <Tabs
            value={scope}
            onValueChange={(value) => setScope(value as "mine" | "all")}
          >
            <TabsList className="h-8 p-0.5 bg-muted rounded-lg border border-border/80">
              <TabsTrigger value="mine" className="h-7 text-xs px-3">
                Assigned to me
              </TabsTrigger>
              <TabsTrigger value="all" className="h-7 text-xs px-3">
                All tasks
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
    </div>
  );
}
