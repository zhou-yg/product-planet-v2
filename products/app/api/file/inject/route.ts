import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_WORKSPACE,
  readDoc,
  readFileContent,
  resolveWorkspaceDir,
  workspaceHasRequirements,
} from "@/lib/fs";

/** Resolve workspace with fallback to the default when the param is absent */
function wsDirOr403(wsName: string): string | null {
  return resolveWorkspaceDir(wsName) ?? resolveWorkspaceDir(DEFAULT_WORKSPACE);
}

export const dynamic = "force-dynamic";

/**
 * Add inject deps to a markdown file's frontmatter.
 * POST /api/file/inject  body: { path, deps: string[], ws? }
 *
 * - 目标必须是已存在的 markdown 文件
 * - deps 须为非空字符串数组，且都是 requirements/ 下已存在的受支持文件
 * - 合并进已有 inject 数组：保留原有顺序，追加新依赖（去重），忽略自身
 */
export async function POST(req: NextRequest) {
  let body: { path?: unknown; deps?: unknown; ws?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "请求体必须是 JSON" },
      { status: 400 },
    );
  }

  const filePath = typeof body.path === "string" ? body.path : "";
  const wsName = typeof body.ws === "string" ? body.ws : "";
  const deps = Array.isArray(body.deps)
    ? body.deps.filter((v): v is string => typeof v === "string" && v.trim() !== "")
    : [];
  if (!filePath || deps.length === 0) {
    return NextResponse.json(
      { ok: false, message: "缺少 path 或 deps" },
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

  // Target must be an existing markdown file (readDoc validates path & existence)
  const doc = await readDoc(wsDir, filePath);
  if (!doc) {
    return NextResponse.json(
      { ok: false, message: "路径非法或文件不存在" },
      { status: 404 },
    );
  }

  // Validate every dep: must be an existing supported file under requirements/
  for (const dep of deps) {
    const depFile = await readFileContent(wsDir, dep);
    if (!depFile) {
      return NextResponse.json(
        { ok: false, message: `依赖文件不存在或路径非法：${dep}` },
        { status: 404 },
      );
    }
  }

  const abs = path.resolve(path.join(wsDir, "requirements"), filePath);

  try {
    const raw = await fs.readFile(abs, "utf-8");
    const parsed = matter(raw);
    const meta = (parsed.data ?? {}) as Record<string, unknown>;

    // Merge: keep existing order first, append new deps (dedup, skip self)
    const existing = Array.isArray(meta.inject)
      ? meta.inject.filter((v): v is string => typeof v === "string" && v.trim() !== "")
      : [];
    const merged = [...existing];
    for (const dep of deps) {
      if (dep !== filePath && !merged.includes(dep)) merged.push(dep);
    }

    meta.inject = merged;
    const output = matter.stringify(parsed.content, meta);
    await fs.writeFile(abs, output, "utf-8");
    return NextResponse.json({ ok: true, inject: merged });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: `写入失败：${String(err)}` },
      { status: 500 },
    );
  }
}
