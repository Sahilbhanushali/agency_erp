import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get("host")?.toLowerCase() || ""
  const hostname = host.split(":")[0]

  // Gracefully handle Vercel analytics on self-hosted instances (avoid 404 console errors)
  if (pathname.startsWith("/_vercel")) {
    if (pathname.endsWith(".js")) {
      return new NextResponse("// no-op analytics", {
        status: 200,
        headers: { "Content-Type": "application/javascript" },
      })
    }
    return NextResponse.json({}, { status: 200 })
  }

  const shareDomain = (process.env.SHARE_DOMAIN || process.env.CONFIRM_DOMAIN)?.toLowerCase()
  const isShareSubdomain =
    hostname.startsWith("share.") ||
    (shareDomain ? hostname === shareDomain : false)

  // 1. Handling for customer share subdomain
  if (isShareSubdomain) {
    // Gracefully return empty session for NextAuth client probe on share subdomain
    if (pathname === "/api/auth/session") {
      return NextResponse.json({})
    }

    // Strictly block internal admin routes and auth actions on customer domain
    if (
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/projects") ||
      pathname.startsWith("/users") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/clients") ||
      pathname.startsWith("/calendar") ||
      pathname.startsWith("/api/auth")
    ) {
      return new NextResponse("Access Denied", { status: 403 })
    }

    // Allow static assets, public uploads, and share APIs directly
    if (
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api/uploads") ||
      pathname.startsWith("/api/share") ||
      pathname.startsWith("/icon") ||
      pathname.startsWith("/globals.css")
    ) {
      return NextResponse.next()
    }

    // If already on /share, let it through
    if (pathname.startsWith("/share")) {
      return NextResponse.next()
    }

    // Rewrite root or /:token to /share or /share/:token
    const cleanPath = pathname.replace(/^\//, "")
    const targetUrl = cleanPath
      ? new URL(`/share/${cleanPath}`, request.url)
      : new URL("/share", request.url)

    return NextResponse.rewrite(targetUrl)
  }

  // 2. Redirect legacy /confirm and /api/confirm paths to /share and /api/share
  if (pathname.startsWith("/confirm")) {
    const shareUrl = new URL(pathname.replace(/^\/confirm/, "/share"), request.url)
    shareUrl.search = request.nextUrl.search
    return NextResponse.redirect(shareUrl)
  }
  if (pathname.startsWith("/api/confirm")) {
    const shareApiUrl = new URL(pathname.replace(/^\/api\/confirm/, "/api/share"), request.url)
    shareApiUrl.search = request.nextUrl.search
    return NextResponse.redirect(shareApiUrl)
  }

  // 3. Allow share pages and share APIs on any host without authentication
  if (pathname.startsWith("/share") || pathname.startsWith("/api/share")) {
    return NextResponse.next()
  }

  // 3. Existing redirect logic for posts
  if (pathname.startsWith("/posts/") && !pathname.startsWith("/posts/api")) {
    const postId = pathname.split("/posts/")[1]
    if (postId && !pathname.startsWith("/posts/dashboard")) {
      const dashboardUrl = new URL(`/dashboard/posts/${postId}`, request.url)
      return NextResponse.redirect(dashboardUrl)
    }
  }

  // 4. Authentication check for protected admin paths
  const isProtectedPath =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/clients") ||
    pathname.startsWith("/calendar") ||
    (pathname.startsWith("/posts") && !pathname.startsWith("/posts/api"))

  if (isProtectedPath) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: process.env.NODE_ENV === "production",
    })

    if (!token) {
      const signInUrl = new URL("/auth/signin", request.url)
      signInUrl.searchParams.set("callbackUrl", request.url)
      return NextResponse.redirect(signInUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}

