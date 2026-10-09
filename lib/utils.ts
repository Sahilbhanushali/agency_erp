import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const PROD_BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "https://automation.rndtechnosoft.com").replace(/\/+$/, "");

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
        parsed.hostname === "automation.rndtechnosoft.com" ||
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
