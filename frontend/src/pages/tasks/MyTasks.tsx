import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import Breadcrumb from "@/layouts/Breadcrumb";
import { useState } from "react";
import TasksPanel from "./components/TasksPanel";

const MyTasks = () => {
    const { user: actor } = useAuth();
    const [scope, setScope] = useState<"mine" | "all">("mine");

    return (
        <>
            <Breadcrumb title="My Tasks" text="Tasks" />

            <TasksPanel
                title="Tasks"
                assigneeId={scope === "mine" ? actor?.id : undefined}
                showProject
                emptyText={
                    scope === "mine" ? "Nothing is assigned to you right now." : "No tasks are visible to you yet."
                }
                headerExtra={
                    <Tabs value={scope} onValueChange={(value) => setScope(value as "mine" | "all")}>
                        <TabsList>
                            <TabsTrigger value="mine">Assigned to me</TabsTrigger>
                            <TabsTrigger value="all">All tasks</TabsTrigger>
                        </TabsList>
                    </Tabs>
                }
            />
        </>
    );
};

export default MyTasks;
