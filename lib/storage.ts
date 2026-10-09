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
    // Normalize and extract the relative path
    let cleanedPath = fileUrlOrPath
      .replace(/^\/api\/uploads\//, "")
      .replace(/^\/uploads\//, "")
      .replace(/^uploads\//, "");

    // Prevent directory traversal
    cleanedPath = path.normalize(cleanedPath).replace(/^(\.\.[\/\\])+/, "");

    const publicUploadsDir = path.join(process.cwd(), "public", "uploads");
    const targetFilePath = path.join(publicUploadsDir, cleanedPath);

    // Ensure the target is strictly inside public/uploads
    if (!targetFilePath.startsWith(publicUploadsDir)) {
      console.warn(`[storage] Attempted deletion outside uploads directory: ${targetFilePath}`);
      return false;
    }

    try {
      await fs.access(targetFilePath);
      await fs.unlink(targetFilePath);
      console.log(`[storage] Successfully deleted local file: ${targetFilePath}`);
      return true;
    } catch (err: any) {
      if (err.code === "ENOENT") {
        // File already absent
        return false;
      }
      console.warn(`[storage] Could not access or delete ${targetFilePath}:`, err.message);
      return false;
    }
  } catch (error) {
    console.error(`[storage] Error deleting file for ${fileUrlOrPath}:`, error);
    return false;
  }
}
