"use client"

import { useEffect } from "react"

/** Any overlay that legitimately blocks the page while it is open. */
const OPEN_OVERLAY =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"]'

/**
 * Un-freezes the page when an overlay leaves it locked.
 *
 * Radix dialogs, sheets and modal menus put `pointer-events: none` on <body> while
 * open and remove it on close. When one overlay closes in the same moment another
 * opens or the component holding it unmounts — Delete from a message menu, leaving a
 * group from its info sheet — the removal can be skipped. Nothing on the page then
 * reacts to clicks until a refresh: the "chat freezes" report.
 *
 * This watches <body>; if it is locked with no overlay open, it unlocks it. An open
 * overlay is left alone, so this never defeats a real modal.
 * ponytail: a guard for a library race, not a fix inside Radix; harmless once Radix
 * stops racing.
 */
export function useStuckOverlayGuard() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const check = () => {
      if (timer) clearTimeout(timer)
      if (document.body.style.pointerEvents !== "none") return
      // Give a closing overlay its exit animation and an opening one time to mount.
      timer = setTimeout(() => {
        if (document.body.style.pointerEvents === "none" && !document.querySelector(OPEN_OVERLAY)) {
          document.body.style.pointerEvents = ""
        }
      }, 400)
    }
    const observer = new MutationObserver(check)
    observer.observe(document.body, { attributes: true, attributeFilter: ["style"] })
    // An overlay removed from the DOM does not touch body's style; re-check then too.
    const tree = new MutationObserver(check)
    tree.observe(document.body, { childList: true })
    return () => {
      observer.disconnect()
      tree.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [])
}
