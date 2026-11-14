import { promises as fs } from "fs";
import path from "path";

/**
 * Safely removes a file from local disk (under public/uploads or public/uploads/...)
 * Returns true if the file was deleted, false if not found or outside uploads dir.
 */
export async function deleteLocalFile(fileUrlOrPath?: string | null): Promise<boolean> {
  if (!fileUrlOrPath || typeof fileUrlOrPath !== "string") return false;

  // If it's a remote URL (http/https), do nothing
  if (fileUrlOrPath.startsWith("http://") || fileUrlOrPath.startsWith("https://")) {
    return false;
  }

  try {
    // Strip query strings or hash parameters (e.g., ?v=123 or #preview)
    const cleanUrl = fileUrlOrPath.split("?")[0].split("#")[0].trim();
    if (!cleanUrl) return false;

    const publicUploadsDir = path.join(process.cwd(), "public", "uploads");
    let targetFilePath: string;

    if (path.isAbsolute(cleanUrl) && cleanUrl.startsWith(publicUploadsDir)) {
      targetFilePath = cleanUrl;
    } else {
      // Normalize and extract the relative path
      let cleanedPath = cleanUrl
        .replace(/^\/?api\/uploads\//i, "")
        .replace(/^\/?public\/uploads\//i, "")
        .replace(/^\/?uploads\//i, "");

      // Prevent directory traversal
      cleanedPath = path.normalize(cleanedPath).replace(/^(\.\.[\/\\])+/, "");
      targetFilePath = path.join(publicUploadsDir, cleanedPath);
    }

    // Ensure the target is strictly inside public/uploads
    if (!targetFilePath.startsWith(publicUploadsDir)) {
      console.warn(`[storage] Attempted deletion outside uploads directory: ${targetFilePath}`);
      return false;
    }

    // Attempt direct deletion first
    try {
      await fs.access(targetFilePath);
      await fs.unlink(targetFilePath);
      console.log(`[storage] Successfully deleted local file: ${targetFilePath}`);
      return true;
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        console.warn(`[storage] Could not delete ${targetFilePath}:`, err.message);
        return false;
      }
    }

    // If direct target was not found and the path has no directory separators (just a filename),
    // check known upload subdirectories as a fallback
    const baseName = path.basename(targetFilePath);
    if (baseName && !cleanUrl.includes("/") && !cleanUrl.includes("\\")) {
      const knownSubdirs = ["avatars", "projects", "clients", "audio", "finance", "contracts", "expenses", "payslips", "users"];
      for (const subdir of knownSubdirs) {
        const fallbackPath = path.join(publicUploadsDir, subdir, baseName);
        try {
          await fs.access(fallbackPath);
          await fs.unlink(fallbackPath);
          console.log(`[storage] Successfully deleted local file from subdirectory: ${fallbackPath}`);
          return true;
        } catch {
          // Continue to next subdir
        }
      }
    }

    return false;
  } catch (error) {
    console.error(`[storage] Error deleting file for ${fileUrlOrPath}:`, error);
    return false;
  }
}

/**
 * Batch delete multiple local files safely.
 */
export async function deleteLocalFiles(fileUrlsOrPaths: (string | null | undefined)[]): Promise<number> {
  if (!Array.isArray(fileUrlsOrPaths) || fileUrlsOrPaths.length === 0) return 0;
  const results = await Promise.allSettled(fileUrlsOrPaths.filter(Boolean).map((u) => deleteLocalFile(u)));
  return results.filter((r) => r.status === "fulfilled" && r.value === true).length;
}

/**
 * A client-supplied filename made safe to put in a path.
 *
 * Upload routes used to build paths like `${Date.now()}-${file.name}`. The browser picks
 * file.name, and one like "x/../../../../.env" is normalised by path.join to a location
 * outside the uploads folder — an arbitrary file write. Only the last path component
 * survives here, reduced to letters, digits, dot, dash and underscore.
 */
export function safeUploadName(original: string | null | undefined, fallback = "file"): string {
  const base = (original ?? "").split(/[\\/]/).pop() ?? ""
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "")
  return (cleaned || fallback).slice(0, 120)
}

/** An id or label from a form, reduced to characters that cannot form a path. */
export function safePathToken(value: string | null | undefined, fallback = "general"): string {
  const cleaned = (value ?? "").replace(/[^a-zA-Z0-9_-]/g, "")
  return (cleaned || fallback).slice(0, 64)
}

/** A short alphanumeric extension from a filename, or the fallback. */
export function safeExtension(original: string | null | undefined, fallback: string): string {
  const ext = (original ?? "").split(".").pop() ?? ""
  return /^[a-zA-Z0-9]{1,5}$/.test(ext) ? ext.toLowerCase() : fallback
}

/**
 * Absolute path of a stored upload, or null when it is missing, remote, or would
 * resolve outside public/uploads (symlinks included). For reading files server-side.
 */
export async function resolveUploadFile(fileUrl: string | null | undefined): Promise<string | null> {
  if (!fileUrl || /^https?:\/\//i.test(fileUrl)) return null;
  const root = path.join(process.cwd(), "public", "uploads");
  const relative = fileUrl
    .split("?")[0]
    .split("#")[0]
    .replace(/^\/?api\/uploads\//i, "")
    .replace(/^\/?public\/uploads\//i, "")
    .replace(/^\/?uploads\//i, "");
  const candidate = path.resolve(root, relative);
  if (!candidate.startsWith(root + path.sep)) return null;
  try {
    const [realRoot, real] = await Promise.all([fs.realpath(root), fs.realpath(candidate)]);
    return real.startsWith(realRoot + path.sep) ? real : null;
  } catch {
    return null;
  }
}
