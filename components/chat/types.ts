/** Client-side shapes. They mirror toWire() in lib/chat/service.ts and the list route. */

export interface ChatAttachmentWire {
  id: string
  name: string
  mimeType: string
  size: number
  kind: "IMAGE" | "VIDEO" | "DOCUMENT" | "FILE"
  url: string
}

export interface ChatMessage {
  id: string
  conversationId: string
  seq: number
  type: "TEXT" | "ATTACHMENT" | "SYSTEM"
  body: string | null
  forwarded: boolean
  clientId: string | null
  editedAt: string | null
  deletedAt: string | null
  createdAt: string
  sender: { id: number; name: string; avatar: string | null } | null
  replyTo: { id: string; senderName: string | null; deleted: boolean; preview: string | null } | null
  attachments: ChatAttachmentWire[]
  reactions: { emoji: string; userId: number }[]
  /** Client-only: an optimistic message not yet confirmed by the server. */
  pending?: "sending" | "failed"
  /** Client-only: upload progress 0-100 while an attachment is sending. */
  progress?: number
}

export interface ChatConversation {
  id: string
  type: "DIRECT" | "GROUP"
  name: string | null
  description: string | null
  avatarUrl: string | null
  membersCanEditInfo: boolean
  memberCount: number
  other: { id: number; name: string; online: boolean; active: boolean } | null
  lastSeq: number
  lastMessageAt: string
  lastMessage: ChatMessage | null
  unread: number
  me: { role: "MEMBER" | "ADMIN"; active: boolean; lastReadSeq: number; mutedUntil: string | null }
}

export type ChatEvent =
  | { type: "message"; conversationId: string; message: ChatMessage }
  | { type: "message_updated"; conversationId: string; message: ChatMessage }
  | { type: "read"; conversationId: string; userId: number; seq: number }
  | { type: "delivered"; conversationId: string; userIds: number[]; seq: number }
  | { type: "typing"; conversationId: string; userId: number; name: string }
  | { type: "presence"; userId: number; online: boolean }
  | { type: "conversation"; conversationId: string }
  | { type: "removed"; conversationId: string }
