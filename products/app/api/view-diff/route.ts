import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { CONTENT_ROOT, readDoc } from "@/lib/fs";

export const dynamic = "force-dynamic";

const exec = promisify(execFile);

/** Get uncommitted git diff (vs HEAD) for a file, empty string when none */
async function fileDiff(relPath: string): Promise<string> {
  try {
    const { stdout } = await exec(
      "git",
      ["diff", "HEAD", "--", `requirements/${relPath}`],
      { cwd: CONTENT_ROOT },
    );
    return stdout.trim();
  } catch {
    // Untracked or git-unavailable files have no diff
    return "";
  }
}

/**
 * View-and-diff endpoint.
 * GET /api/view-diff?path=pages/home.md
 * Returns assembled markdown: file content, inject contents
 * (wrapped in <inject content="...">) and per-file diffs
 * (wrapped in <diff content="...">).
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

  // Involved files: the selected file + its inject dependencies
  const injects = Array.isArray(doc.meta.inject)
    ? doc.meta.inject.filter((v): v is string => typeof v === "string")
    : [];
  const involved = [doc.path, ...injects];

  /** Read the raw file (frontmatter included) relative to CONTENT_ROOT */
  async function rawContent(relPath: string): Promise<string | null> {
    try {
      return await readFile(path.join(CONTENT_ROOT, relPath), "utf-8");
    } catch {
      return null;
    }
  }

  const parts: string[] = [];

  // 1. Selected file content (with meta/frontmatter)
  parts.push((await rawContent(doc.path)) ?? doc.content);

  // 2. Inject contents (with meta) wrapped in <inject content="path">
  for (const dep of injects) {
    const raw = await rawContent(dep);
    if (raw === null) continue;
    parts.push(`<inject content="${dep}">\n${raw.trimEnd()}\n</inject>`);
  }

  // 3. Per-file diffs wrapped in <diff content="path">
  for (const file of involved) {
    const diff = await fileDiff(file);
    if (!diff) continue;
    parts.push(`<diff content="${file}">\n${diff}\n</diff>`);
  }

  return NextResponse.json({
    ok: true,
    content: parts.join("\n\n") + "\n",
  });
}
