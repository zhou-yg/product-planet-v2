import { NextRequest, NextResponse } from "next/server";
import { readDoc } from "@/lib/fs";

export const dynamic = "force-dynamic";

/**
 * Read a markdown file by path.
 * GET /api/file?path=pages/home.md
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("path") ?? "";
  const doc = await readDoc(raw);
  if (!doc) {
    return NextResponse.json(
      { ok: false, message: "文件不存在或路径非法" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, doc });
}
