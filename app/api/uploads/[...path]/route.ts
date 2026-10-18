import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { APP_BASE_URL } from "@/lib/utils"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const pathSegments = resolvedParams.path || [];

    if (pathSegments.length === 0) {
      return NextResponse.json({ error: "File path required" }, { status: 400 });
    }

    const subPath = pathSegments.join("/");
    const filename = pathSegments[pathSegments.length - 1];

    const possiblePaths = [
      path.join(process.cwd(), "public", "uploads", subPath),
      path.join(process.cwd(), "public", "Uploads", subPath),
      path.join(process.cwd(), "public", "uploads", filename),
      path.join(process.cwd(), "public", "Uploads", filename),
    ];

    let fileBuffer: Buffer | null = null;

    for (const filePath of possiblePaths) {
      try {
        fileBuffer = await fs.readFile(filePath);
        break;
      } catch {
        continue;
      }
    }

    if (!fileBuffer) {
      const PROD_BASE_URL = APP_BASE_URL;
      try {
        const prodUrl = `${PROD_BASE_URL}/api/uploads/${pathSegments.map(encodeURIComponent).join("/")}`;
        const prodRes = await fetch(prodUrl);
        if (prodRes.ok) {
          const contentType = prodRes.headers.get("content-type") || "application/octet-stream";
          const arrayBuffer = await prodRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Save to local disk so subsequent requests don't need network call
          try {
            const cachePath = path.join(process.cwd(), "public", "uploads", subPath);
            await fs.mkdir(path.dirname(cachePath), { recursive: true });
            await fs.writeFile(cachePath, buffer).catch(() => {});
          } catch {}

          return new NextResponse(buffer as unknown as BodyInit, {
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        }
      } catch (prodErr) {
        console.warn(`[uploads] Could not fetch ${subPath} from production:`, prodErr);
      }

      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const ext = path.extname(filename).toLowerCase();
    let contentType = "application/octet-stream";

    if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    else if (ext === ".png") contentType = "image/png";
    else if (ext === ".gif") contentType = "image/gif";
    else if (ext === ".webp") contentType = "image/webp";
    else if (ext === ".svg") contentType = "image/svg+xml";
    else if (ext === ".mp4") contentType = "video/mp4";
    else if (ext === ".webm") contentType = "video/webm";
    else if (ext === ".mov" || ext === ".qt") contentType = "video/quicktime";
    else if (ext === ".mp3") contentType = "audio/mpeg";
    else if (ext === ".wav") contentType = "audio/wav";
    else if (ext === ".pdf") contentType = "application/pdf";

    return new NextResponse(fileBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    if (error?.code !== "ENOENT") {
      console.error("Error serving upload path:", error);
    }
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
