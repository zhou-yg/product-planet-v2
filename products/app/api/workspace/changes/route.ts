import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_WORKSPACE,
  resolveWorkspaceDir,
  workspaceHasRequirements,
} from "@/lib/fs";
import { listGitChanges } from "@/lib/git";

export const dynamic = "force-dynamic";

/**
 * 工作区未提交变更接口（requirements/pages/home/top.md）
 *
 * GET /api/workspace/changes?ws=xx
 * 返回当前 workspace 相对 HEAD 的未提交变更列表（含未跟踪文件）。
 * - gitis：workspace 是否为 git 仓库（false 时前端按「无变更」处理）
 */
export async function GET(req: NextRequest) {
  const wsName = req.nextUrl.searchParams.get("ws") ?? "";
  const wsDir =
    resolveWorkspaceDir(wsName) ?? resolveWorkspaceDir(DEFAULT_WORKSPACE);
  if (!wsDir || !workspaceHasRequirements(wsDir)) {
    return NextResponse.json(
      { ok: false, message: "workspace 不存在或缺少 requirements 文件夹" },
      { status: 400 },
    );
  }

  const changes = await listGitChanges(wsDir);
  return NextResponse.json({
    ok: true,
    isGit: changes !== null,
    changes: changes ?? [],
  });
}
