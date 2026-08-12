import { Skeleton } from "@/components/ui/skeleton"

export default function LoadingSkeleton() {
  return (
    <div className="flex flex-col space-y-3 h-full min-h-[400px] bg-muted p-6 rounded-xl">
      <Skeleton className="h-[200px] w-[250px] rounded-xl bg-muted w-full" />
      <div className="space-y-2">
        <Skeleton className="h-5 bg-muted w-full" />
        <Skeleton className="h-5 bg-muted w-full" />
      </div>
    </div>
  )
}