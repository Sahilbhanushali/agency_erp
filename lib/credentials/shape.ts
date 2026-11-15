import type { Prisma } from "@prisma/client"

/** What a credential looks like to callers — never the password. */
export const CREDENTIAL_SELECT = {
  id: true,
  label: true,
  category: true,
  clientId: true,
  projectId: true,
  location: true,
  platform: true,
  userId: true,
  url: true,
  // Selected only to say whether there is one: notes are sealed and come from reveal.
  notes: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true, company: true, phone: true } },
  project: { select: { id: true, name: true } },
} satisfies Prisma.CredentialSelect

/** Notes are secrets too: callers learn only that one exists. */
export function withoutNotes<T extends { notes: string | null }>({ notes, ...rest }: T) {
  return { ...rest, hasNotes: !!notes }
}
