import { ShieldAlert } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

/** Shown when a signed-in user reaches a finance page their role does not cover. */
export default function NoAccess({ what }: { what: string }) {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <h1 className="mt-4 text-base font-medium">You do not have access to {what}</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Ask an administrator to grant your role the matching permission.
        </p>
      </CardContent>
    </Card>
  )
}
