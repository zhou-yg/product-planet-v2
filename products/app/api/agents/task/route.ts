import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_WORKSPACE,
  resolveWorkspaceDir,
  workspaceHasRequirements,
} from "@/lib/fs";

export const dynamic = "force-dynamic";

/**
 * agents 工具连接配置（requirements/service/agents.md）
 *
 * agents 工具底层是 dick-harness 的 web-task-ref 插件（dsh web 内注册的本地
 * HTTP 路由）。产品应用不感知这些细节，通过本接口把「内容 + 当前工作区」
 * 转发为一次任务创建。
 *
 * - DSH_WEB_ORIGIN：dsh web 服务地址，默认 http://127.0.0.1:8080
 *   （浏览器端跨域请求会被 web-task-ref 的 Host/Origin 防护 403 拦截，
 *   必须由服务端同源转发）
 */
const DSH_WEB_ORIGIN = process.env.DSH_WEB_ORIGIN ?? "http://127.0.0.1:8080";

/** 与 web-task-ref 插件约定的请求体 */
interface CreateTaskBody {
  /** 任务提示词（view-prompts 内容 + 用户补充内容） */
  readonly prompt?: string;
  /** 任务工作区（项目所在目录，绝对路径） */
  readonly cwd?: string;
}

/** /api/web-task-ref/create 的响应 */
interface CreateTaskResponse {
  readonly ok?: boolean;
  readonly sessionId?: string;
  readonly error?: string;
}

/**
 * agents 工具：创建任务（requirements/service/agents.md）
 *
 * POST /api/agents/task  body: { ws, prompt }
 * - ws：当前选中的 workspace 名称，解析为项目所在目录（cwd）
 * - prompt：任务内容（必传）
 *
 * 底层调用 dsh web 的 POST /api/web-task-ref/create（dick-harness 的
 * web-task-ref 插件），在 dsh web 进程内创建会话并投递首条提示词。
 */
export async function POST(req: NextRequest) {
  let body: { ws?: unknown; prompt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "请求体必须是 JSON" },
      { status: 400 },
    );
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const wsName = typeof body.ws === "string" ? body.ws : "";

  if (!prompt) {
    return NextResponse.json(
      { ok: false, message: "缺少任务内容（prompt）" },
      { status: 400 },
    );
  }

  // 解析任务工作区：优先入参 ws，回退默认 workspace
  const wsDir =
    resolveWorkspaceDir(wsName) ?? resolveWorkspaceDir(DEFAULT_WORKSPACE);
  if (!wsDir || !workspaceHasRequirements(wsDir)) {
    return NextResponse.json(
      { ok: false, message: "workspace 不存在或缺少 requirements 文件夹" },
      { status: 400 },
    );
  }

  // 转发给 dsh web 的 web-task-ref 创建任务
  try {
    const res = await fetch(`${DSH_WEB_ORIGIN}/api/web-task-ref/create`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt,
        cwd: wsDir,
      } satisfies CreateTaskBody),
      // 任务创建应快速返回，避免长时间挂住
      signal: AbortSignal.timeout(30_000),
    });

    const data = (await res.json().catch(() => ({}))) as CreateTaskResponse;
    if (!res.ok || !data.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: data.error ?? `创建任务失败（HTTP ${res.status}）`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      sessionId: data.sessionId ?? "",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: `创建任务失败：${String(err)}` },
      { status: 502 },
    );
  }
}
