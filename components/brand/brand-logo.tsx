import Image from "next/image"

/**
 * The itsmeDezino wordmark, correct in both themes.
 *
 * There are two files — a dark mark for light backgrounds and a white one for dark —
 * and the right one has to win without a flash of the wrong logo on first paint. A
 * `useTheme()` hook cannot do that: it only knows the theme after hydration, so the
 * server would have to guess. Both images are rendered instead and CSS picks one, which
 * resolves before the first paint and needs no JavaScript at all.
 *
 * `dark:` here follows next-themes' `class` strategy, which is what ThemeProvider in
 * app/layout.tsx is configured with.
 */
export function BrandLogo({
  className = "",
  size = 32,
  priority = false,
}: {
  className?: string
  /** The mark is square; one number is enough. */
  size?: number
  priority?: boolean
}) {
  const shared = "object-contain"
  return (
    <span className={`inline-flex items-center ${className}`}>
      <Image
        src="/brand/logo-light.png"
        alt="itsmeDezino"
        width={size}
        height={size}
        priority={priority}
        className={`${shared} dark:hidden`}
      />
      <Image
        src="/brand/logo-dark.png"
        alt="itsmeDezino"
        width={size}
        height={size}
        priority={priority}
        // aria-hidden on the duplicate: the logo must be announced once, not twice.
        aria-hidden="true"
        className={`${shared} hidden dark:block`}
      />
    </span>
  )
}

/**
 * Alias kept for call sites that asked for the compact mark. The brand files are square
 * lockups, so the "mark" and the "logo" are the same artwork — rendering a separate
 * non-theme-aware file here would show a black logo on a dark sidebar.
 */
export function BrandMark({
  className = "",
  size = 28,
  priority = false,
}: {
  className?: string
  size?: number
  priority?: boolean
}) {
  return <BrandLogo className={className} size={size} priority={priority} />
}
