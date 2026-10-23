import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { APP_BASE_URL } from "@/lib/utils";

/**
 * Serves files saved under public/uploads.
 *
 * Unauthenticated on purpose — post media is read by client share links and by Meta
 * when publishing — which makes containment the whole of its security. It used to join
 * URL segments straight onto the uploads folder. Next decodes each segment, so
 * `/api/uploads/..%2F..%2F.env` arrived as "../../.env" and returned the app's .env —
 * database password, NEXTAUTH_SECRET and all — to anyone who asked.
 *
 * Now every path is resolved, symlinks included, and must land inside an uploads root.
 *
 * This is the only route serving uploads. There used to be two more — [filename] and
 * audio/[filename] — with the same unchecked join, and [filename] took precedence for
 * single-segment paths, so fixing this file alone left the leak open. Their lookups
 * (the projects/clients/audio subfolders) live here now.
 */

const ROOTS = ["uploads", "Uploads"].map((dir) => path.resolve(process.cwd(), "public", dir));

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".qt": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
};

const notFound = () => NextResponse.json({ error: "File not found" }, { status: 404 });

/**
 * A segment is a single file or folder name. After decoding, anything that could change
 * directory — a separator, a dot-dot, a NUL — means the request is not a file path.
 */
const safeSegment = (s: string) =>
  s.length > 0 && s !== "." && s !== ".." && !/[\\/\0]/.test(s);

/** The real path of `rel` under `root`, or null if it does not exist or escapes. */
async function resolveInside(root: string, rel: string): Promise<string | null> {
  const candidate = path.resolve(root, rel);
  if (!candidate.startsWith(root + path.sep)) return null;
  try {
    // realpath follows symlinks, so a link inside uploads cannot point outside it.
    const [real, realRoot] = await Promise.all([fs.realpath(candidate), fs.realpath(root)]);
    if (!real.startsWith(realRoot + path.sep)) return null;
    const stat = await fs.stat(real);
    return stat.isFile() ? real : null;
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const segments = (await params).path ?? [];
  if (segments.length === 0 || !segments.every(safeSegment)) return notFound();
  // Employee documents (ID proofs, bank papers) were once written here. They are served
  // only by /api/users/[id]/documents/[docId]/file, which checks who is asking.
  if (segments[0].toLowerCase() === "users") return notFound();

  const subPath = segments.join("/");
  const filename = segments[segments.length - 1];

  // The exact path first, then the bare name in the places older links point to.
  const candidates = [subPath, filename, `projects/${filename}`, `clients/${filename}`, `audio/${filename}`];
  let file: string | null = null;
  for (const root of ROOTS) {
    for (const rel of candidates) {
      file = await resolveInside(root, rel);
      if (file) break;
    }
    if (file) break;
  }

  if (!file) {
    // Development convenience only: pull a file the live server has but this machine
    // does not. Never in production, where APP_BASE_URL is this same server and a
    // missing file used to make the route request itself, over and over.
    const ownHost = new URL(request.url).host;
    if (process.env.NODE_ENV !== "production" && new URL(APP_BASE_URL).host !== ownHost) {
      try {
        const remote = await fetch(`${APP_BASE_URL}/api/uploads/${segments.map(encodeURIComponent).join("/")}`);
        if (remote.ok) {
          return new NextResponse(Buffer.from(await remote.arrayBuffer()) as unknown as BodyInit, {
            headers: {
              "Content-Type": remote.headers.get("content-type") || "application/octet-stream",
              "Cache-Control": "private, max-age=300",
              "X-Content-Type-Options": "nosniff",
            },
          });
        }
      } catch {
        // Fall through to 404.
      }
    }
    return notFound();
  }

  try {
    const data = await fs.readFile(file);
    const ext = path.extname(file).toLowerCase();
    // Voice notes are .webm audio; served as video/webm, some browsers refuse to play them.
    const isAudioNote = file.split(path.sep).includes("audio") && ext === ".webm";
    return new NextResponse(data as unknown as BodyInit, {
      headers: {
        "Content-Type": isAudioNote ? "audio/webm" : (CONTENT_TYPES[ext] ?? "application/octet-stream"),
        "Cache-Control": "public, max-age=31536000, immutable",
        // Same origin as the app: an uploaded SVG or HTML file must not run script here.
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code !== "ENOENT") console.error("[uploads] read failed:", error);
    return notFound();
  }
}
