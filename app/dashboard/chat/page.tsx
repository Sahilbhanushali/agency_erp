import type { Metadata } from "next"
import { Suspense } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { can } from "@/lib/api-auth"
import { ChatApp } from "@/components/chat/chat-app"

export const metadata: Metadata = { title: "Chat" }

/**
 * Internal chat. The page checks chat:read so someone without it sees an explanation
 * rather than a screen of failing requests — every API route checks it again.
 */
export default async function ChatPage() {
  const session = await getServerSession(authOptions)
  const allowed = await can(session, "chat", "read")

  if (!allowed) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold">Chat isn't enabled for your role</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask an administrator to grant <strong>Chat → Use chat</strong> in Roles &amp; Permissions.
        </p>
      </div>
    )
  }

  return (
    <Suspense fallback={null}>
      <ChatApp meId={Number(session!.user.id)} />
    </Suspense>
  )
}
