import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import type { Dirent } from "node:fs";
import {
  DEFAULT_WORKSPACE,
  resolveWorkspaceDir,
  workspaceHasRequirements,
} from "@/lib/fs";

export const dynamic = "force-dynamic";

/** Recursively collect md file paths (relative to requirements/) sorted by path */
async function collectMdFiles(
  absDir: string,
  relDir: string,
): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await collectMdFiles(path.join(absDir, entry.name), rel)));
    } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
      out.push(rel);
    }
  }
  out.sort();
  return out;
}

/**
 * Sync requirements md files into the workspace AGENTS.md.
 * POST /api/sync-agents  body: { ws? }
 */
export async function POST(req: NextRequest) {
  let body: { ws?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const wsName = typeof body.ws === "string" ? body.ws : "";
  const wsDir = resolveWorkspaceDir(wsName) ?? resolveWorkspaceDir(DEFAULT_WORKSPACE);
  if (!wsDir || !workspaceHasRequirements(wsDir)) {
    return NextResponse.json(
      { ok: false, message: "workspace 不存在或缺少 requirements 文件夹" },
      { status: 400 },
    );
  }

  const reqDir = path.join(wsDir, "requirements");
  const files = await collectMdFiles(reqDir, "");
  if (files.length === 0) {
    return NextResponse.json(
      { ok: false, message: "requirements 下没有 md 文件" },
      { status: 400 },
    );
  }

  // Concatenate every md file as "## requirements/<path>" + raw content
  const parts: string[] = [];
  for (const rel of files) {
    let raw: string;
    try {
      raw = await fs.readFile(path.join(reqDir, rel), "utf-8");
    } catch (err) {
      return NextResponse.json(
        { ok: false, message: `读取 requirements/${rel} 失败：${String(err)}` },
        { status: 500 },
      );
    }
    parts.push(`## requirements/${rel}\n\n${raw.trim()}`);
  }

  const workspaceName = wsDir.split("/").pop() ?? "";
  const output = `# AGENTS.md — ${workspaceName}\n\n由 requirements 下的 md 文件自动生成（sync-agents）。\n\n${parts.join("\n\n")}\n`;

  const target = path.join(wsDir, "AGENTS.md");
  try {
    await fs.writeFile(target, output, "utf-8");
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: `写入 AGENTS.md 失败：${String(err)}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, count: files.length });
}
