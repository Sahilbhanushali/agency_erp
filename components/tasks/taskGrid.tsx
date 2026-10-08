import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle } from "lucide-react"
import TaskCard from "./taskCard"

enum PostStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  SCHEDULED = "SCHEDULED",
  POSTED = "POSTED",
  RESUBMITTED = "RESUBMITTED",
  NEEDS_MINOR_CHANGE = "NEEDS_MINOR_CHANGE",
}

export interface Task {
  id: string
  title: string
  caption?: string
  type: string
  status: PostStatus
  contentStatus?: string
  scheduledAt?: string
  designDueDate?: string
  createdAt?: string
  updatedAt?: string
  project?: {
    id?: string
    name?: string
    client?: {
      name: string
    }
  }
  assets: Array<{
    id: string
    filename: string
    url: string
    createdAt?: string
    type: string
    isReference: boolean
  }>
  platforms?: Array<{
    id: string
    platform: string
  }>
  assignedToId?: number
  assignedTo?: {
    name: string
    email: string
  }
  feedback?: string
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
}

interface TaskGridProps {
  tasks: Task[]
  title: string
  showDeadlines?: boolean
  showOverdue?: boolean
  showStatus?: boolean
  showAll?: boolean
  emptyMessage?: string
  emptySubMessage?: string
  currentUserId?: number
  mutate?: () => void;
}

export default function TaskGrid({ 
  tasks, 
  title, 
  showDeadlines = false, 
  showOverdue = false, 
  showStatus = false,
  showAll = false,
  emptyMessage = "No tasks found for this category",
  emptySubMessage = "Great job staying on top of your work!",
  currentUserId,
  mutate
}: TaskGridProps) {
  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="space-y-2">
            <CheckCircle className="h-12 w-12 mx-auto text-gray-400" />
            <p className="text-gray-500 font-medium">{emptyMessage}</p>
            <p className="text-sm text-gray-400">{emptySubMessage}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Sort tasks by priority and deadline
  const sortedTasks = [...tasks].sort((a, b) => {
    // First by priority
    const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 3
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 3
    
    if (aPriority !== bPriority) return aPriority - bPriority
    
    // Then by deadline
    if (a.scheduledAt && b.scheduledAt) {
      const aDesignDue = new Date(a.scheduledAt)
      aDesignDue.setDate(aDesignDue.getDate() - 7)
      const bDesignDue = new Date(b.scheduledAt)
      bDesignDue.setDate(bDesignDue.getDate() - 7)
      return aDesignDue.getTime() - bDesignDue.getTime()
    }
    
    // Tasks with deadlines come first
    if (a.scheduledAt && !b.scheduledAt) return -1
    if (!a.scheduledAt && b.scheduledAt) return 1
    
    // Finally by creation date (newest first)
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
    
    return 0
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
        {sortedTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            showDeadlines={showDeadlines}
            showOverdue={showOverdue}
            showStatus={showStatus}
            showAll={showAll}
            currentUserId={currentUserId}
            mutate={mutate}
          />
        ))}
      </div>
    </div>
  )
}