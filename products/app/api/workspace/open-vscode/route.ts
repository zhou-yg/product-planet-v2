import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  DEFAULT_WORKSPACE,
  resolveWorkspaceDir,
} from "@/lib/fs";

const execFileAsync = promisify(execFile);

export const dynamic = "force-dynamic";

/**
 * POST /api/workspace/open-vscode
 * Body: { ws?: string }
 * Open the workspace directory in VSCode via the `code` CLI.
 */
export async function POST(request: Request) {
  let ws = "";
  try {
    const body = (await request.json()) as { ws?: unknown };
    if (typeof body.ws === "string") ws = body.ws;
  } catch {
    // fall through with empty ws
  }

  const dir = resolveWorkspaceDir(ws) ?? resolveWorkspaceDir(DEFAULT_WORKSPACE);
  if (!dir) {
    return NextResponse.json({ error: "未找到可用的 workspace" }, { status: 404 });
  }

  try {
    await execFileAsync("code", [dir]);
    return NextResponse.json({ ok: true, dir });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? `VSCode 打开失败：${error.message}`
        : "VSCode 打开失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
