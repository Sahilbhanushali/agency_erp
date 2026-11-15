"use client"

/** How long a copied secret stays on the clipboard. */
export const CLIPBOARD_CLEAR_SECONDS = 30

let pending: { timer: ReturnType<typeof setTimeout>; cancel: () => void } | null = null

/**
 * Copies a secret and overwrites the clipboard after CLIPBOARD_CLEAR_SECONDS — what
 * password managers do. Browsers give a page no reliable way to clear the clipboard, so
 * this is best effort:
 *  - if the page may read the clipboard, it is cleared only while it still holds the secret;
 *  - otherwise it is cleared unless something else was copied on this page meanwhile;
 *  - browsers refuse clipboard writes from a background tab, so if the tab is not
 *    focused when time is up, it clears the moment the tab is focused again.
 */
export async function copySecret(secret: string): Promise<void> {
  await navigator.clipboard.writeText(secret)
  pending?.cancel()

  let copiedElsewhere = false
  const onCopy = () => {
    copiedElsewhere = true
  }
  const clear = async () => {
    try {
      // Read only with permission already granted: asking would pop a prompt out of nowhere.
      const mayRead = await navigator.permissions
        .query({ name: "clipboard-read" as PermissionName })
        .then((p) => p.state === "granted")
        .catch(() => false)
      const current = mayRead ? await navigator.clipboard.readText().catch(() => null) : null
      if (current === null ? copiedElsewhere : current !== secret) return
      await navigator.clipboard.writeText("")
    } catch {
      // Not focused: try again when the person comes back to this tab.
      window.addEventListener("focus", clear, { once: true })
      return
    }
    cleanup()
  }
  const cleanup = () => {
    document.removeEventListener("copy", onCopy)
    window.removeEventListener("focus", clear)
    if (pending) clearTimeout(pending.timer)
    pending = null
  }

  document.addEventListener("copy", onCopy)
  pending = { timer: setTimeout(() => void clear(), CLIPBOARD_CLEAR_SECONDS * 1000), cancel: cleanup }
}
