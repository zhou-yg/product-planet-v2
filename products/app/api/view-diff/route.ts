import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_WORKSPACE,
  readDoc,
  readFileContent,
  resolveWorkspaceDir,
  workspaceHasRequirements,
} from "@/lib/fs";
import { WS_PARAM } from "@/lib/shared";

/** Resolve workspace with fallback to the default when the param is absent */
function wsDirOr403(wsName: string): string | null {
  return resolveWorkspaceDir(wsName) ?? resolveWorkspaceDir(DEFAULT_WORKSPACE);
}

export const dynamic = "force-dynamic";

const exec = promisify(execFile);

/** Get uncommitted git diff (vs HEAD) for a file, empty string when none */
async function fileDiff(wsDir: string, relPath: string): Promise<string> {
  try {
    const { stdout } = await exec(
      "git",
      ["diff", "HEAD", "--", `requirements/${relPath}`],
      { cwd: wsDir },
    );
    return stdout.trim();
  } catch {
    // Untracked or git-unavailable files have no diff
    return "";
  }
}

/**
 * View-and-diff endpoint.
 * GET /api/view-diff?path=pages/home.md&ws=product-planet-v2
 * Returns assembled markdown: file content, inject contents
 * (wrapped in <inject content="...">) and per-file diffs
 * (wrapped in <diff content="...">).
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("path") ?? "";
  const wsName = req.nextUrl.searchParams.get(WS_PARAM) ?? "";
  const wsDir = wsDirOr403(wsName);
  if (!wsDir || !workspaceHasRequirements(wsDir)) {
    return NextResponse.json(
      { ok: false, message: "workspace 不存在或缺少 requirements 文件夹" },
      { status: 400 },
    );
  }

  const doc = await readDoc(wsDir, raw);
  if (!doc) {
    return NextResponse.json(
      { ok: false, message: "文件不存在或路径非法" },
      { status: 404 },
    );
  }

  /** Read the raw file (frontmatter included) relative to workspace requirements/ */
  const requirementsRoot = path.join(wsDir, "requirements");
  async function rawContent(relPath: string): Promise<string | null> {
    try {
      return await readFile(path.join(requirementsRoot, relPath), "utf-8");
    } catch {
      return null;
    }
  }

  /** Collect inject deps (text md files only) from parsed frontmatter */
  function injectsOf(meta: Record<string, unknown>): string[] {
    return Array.isArray(meta.inject)
      ? meta.inject.filter((v): v is string => typeof v === "string")
      : [];
  }

  // Recursively collect inject dependencies in BFS order with dedup
  // (each dependency's own injects are also expanded, cycles are skipped)
  const injects: string[] = [];
  const seen = new Set<string>([doc.path]);
  const queue = injectsOf(doc.meta);
  while (queue.length > 0) {
    const dep = queue.shift()!;
    if (seen.has(dep)) continue; // skip duplicates and cycles
    seen.add(dep);
    injects.push(dep);
    // Only md deps may carry further injects
    const depDoc = await readFileContent(wsDir, dep);
    if (depDoc?.kind === "md") queue.push(...injectsOf(depDoc.meta));
  }

  const involved = [doc.path, ...injects];

  const parts: string[] = [];

  // 1. Selected file path (relative to requirements/) and content (with meta/frontmatter)
  parts.push(
    `# ${doc.path}\n\n${(await rawContent(doc.path)) ?? doc.content}`,
  );

  // 2. Inject contents (with meta) wrapped in <inject content="path">,
  //    recursively including nested injects
  for (const dep of injects) {
    const raw = await rawContent(dep);
    if (raw === null) continue;
    parts.push(`<inject content="${dep}">\n${raw.trimEnd()}\n</inject>`);
  }

  // 3. Per-file diffs wrapped in <diff content="path">
  for (const file of involved) {
    const diff = await fileDiff(wsDir, file);
    if (!diff) continue;
    parts.push(`<diff content="${file}">\n${diff}\n</diff>`);
  }

  return NextResponse.json({
    ok: true,
    content: parts.join("\n\n") + "\n",
  });
}
