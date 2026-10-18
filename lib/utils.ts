import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Where this installation is reachable. The single source for every absolute URL the
 * app builds — asset links in email, dashboard links, share links.
 *
 * Set NEXT_PUBLIC_BASE_URL. There is deliberately no production domain baked in here:
 * this used to default to a previous customer's hostname, which meant a missing
 * environment variable silently sent clients links to somebody else's server. A
 * localhost default is obviously wrong instead of quietly wrong.
 */
export const APP_BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");

const PROD_BASE_URL = APP_BASE_URL;

export function getMediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;

  let cleanPath = url;

  // If full URL with protocol
  if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
    try {
      const parsed = new URL(cleanPath);
      // If it points to localhost, 127.0.0.1, or the production domain, extract pathname + search
      if (
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === new URL(APP_BASE_URL).hostname ||
        (typeof window !== "undefined" && parsed.hostname === window.location.hostname)
      ) {
        cleanPath = parsed.pathname + parsed.search;
      } else {
        return cleanPath;
      }
    } catch {
      return cleanPath;
    }
  }

  // Ensure leading slash or handle bare filenames
  if (!url.includes("/")) {
    cleanPath = `/api/uploads/${url}`;
  } else if (!cleanPath.startsWith("/")) {
    cleanPath = `/${cleanPath}`;
  }

  // Map /uploads/ or /Uploads/ to /api/uploads/ so Next.js dynamic file server handles runtime uploads on production
  if (cleanPath.toLowerCase().startsWith("/uploads/")) {
    const subPath = cleanPath.substring(9);
    cleanPath = `/api/uploads/${subPath}`;
  }

  return cleanPath;
}

export function getGoogleDriveEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (match && match[1]) {
    return `https://drive.google.com/file/d/${match[1]}/preview`;
  }
  return null;
}
