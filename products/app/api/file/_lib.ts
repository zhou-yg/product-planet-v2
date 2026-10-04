import { NextResponse } from "next/server";
import {
  DEFAULT_WORKSPACE,
  resolveWorkspaceDir,
  workspaceHasRequirements,
} from "@/lib/fs";
import type { FsOpError } from "@/lib/fs";

/**
 * 文件管理接口的共用逻辑：
 * - 解析 JSON 请求体（非法时 400）
 * - 解析 workspace（缺省用默认，非法或缺 requirements/ 时 400）
 */
export async function readBody(
  request: Request,
): Promise<Record<string, unknown> | NextResponse> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {
    // fall through
  }
  return NextResponse.json(
    { ok: false, message: "请求体必须是 JSON 对象" },
    { status: 400 },
  );
}

/** 解析 workspace：缺省用默认 workspace，不存在或缺 requirements/ 时 400 */
export function requireWsDir(
  wsName: unknown,
): { wsDir: string } | NextResponse {
  const name = typeof wsName === "string" ? wsName : "";
  const wsDir = name
    ? resolveWorkspaceDir(name)
    : resolveWorkspaceDir(DEFAULT_WORKSPACE);
  if (!wsDir || !workspaceHasRequirements(wsDir)) {
    return NextResponse.json(
      { ok: false, message: "workspace 不存在或缺少 requirements 文件夹" },
      { status: 400 },
    );
  }
  return { wsDir };
}

/** 统一错误响应：FsOpError 携带 http 状态码，其余按 500 处理 */
export function errorResponse(err: unknown): NextResponse {
  const opErr = err as Partial<FsOpError>;
  if (opErr && typeof opErr.status === "number" && typeof opErr.message === "string") {
    return NextResponse.json(
      { ok: false, message: opErr.message },
      { status: opErr.status },
    );
  }
  return NextResponse.json(
    { ok: false, message: `操作失败：${String(err)}` },
    { status: 500 },
  );
}

/** 读取字符串入参（非法或缺失返回 null） */
export function strArg(body: Record<string, unknown>, key: string): string | null {
  const v = body[key];
  return typeof v === "string" ? v : null;
}
