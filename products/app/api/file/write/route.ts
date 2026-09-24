import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_WORKSPACE,
  readDoc,
  resolveWorkspaceDir,
  workspaceHasRequirements,
} from "@/lib/fs";

/** Resolve workspace with fallback to the default when the param is absent */
function wsDirOr403(wsName: string): string | null {
  return resolveWorkspaceDir(wsName) ?? resolveWorkspaceDir(DEFAULT_WORKSPACE);
}

export const dynamic = "force-dynamic";

/**
 * Write markdown content to a file by path.
 * POST /api/file/write  body: { path, content, ws? }
 */
export async function POST(req: NextRequest) {
  let body: { path?: unknown; content?: unknown; ws?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "请求体必须是 JSON" },
      { status: 400 },
    );
  }

  const filePath = typeof body.path === "string" ? body.path : "";
  const content = typeof body.content === "string" ? body.content : null;
  const wsName = typeof body.ws === "string" ? body.ws : "";
  if (!filePath || content === null) {
    return NextResponse.json(
      { ok: false, message: "缺少 path 或 content" },
      { status: 400 },
    );
  }

  // Resolve workspace before touching the filesystem
  const wsDir = wsDirOr403(wsName);
  if (!wsDir || !workspaceHasRequirements(wsDir)) {
    return NextResponse.json(
      { ok: false, message: "workspace 不存在或缺少 requirements 文件夹" },
      { status: 400 },
    );
  }

  // Validate path before touching the filesystem (reuse readDoc's resolver)
  const existing = await readDoc(wsDir, filePath);
  if (!existing) {
    return NextResponse.json(
      { ok: false, message: "路径非法或文件不存在" },
      { status: 404 },
    );
  }

  const abs = path.resolve(path.join(wsDir, "requirements"), filePath);

  // Preserve original frontmatter (e.g. inject deps) when rewriting content
  let output = content;
  try {
    const raw = await fs.readFile(abs, "utf-8");
    const { data } = matter(raw);
    if (Object.keys(data).length > 0) {
      output = matter.stringify(content, data);
    }
  } catch {
    // fall through: write content as-is
  }

  try {
    await fs.writeFile(abs, output, "utf-8");
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: `写入失败：${String(err)}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
