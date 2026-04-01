import { readFile } from "fs/promises";
import { join, normalize } from "path";
import type { NextRequest } from "next/server";

const BOOKS_AUDIO_DIR = join(process.cwd(), "books", "audio");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;

  // Path traversal guard
  const fullPath = normalize(join(BOOKS_AUDIO_DIR, ...path));
  if (!fullPath.startsWith(BOOKS_AUDIO_DIR + "/") && fullPath !== BOOKS_AUDIO_DIR) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const file = await readFile(fullPath);
    return new Response(file, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}
