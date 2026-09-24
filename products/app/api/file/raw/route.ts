import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_WORKSPACE,
  readRaw,
  mimeOf,
  resolveWorkspaceDir,
  workspaceHasRequirements,
} from "@/lib/fs";
import { WS_PARAM } from "@/lib/shared";

/** Resolve workspace with fallback to the default when the param is absent */
function wsDirOr403(wsName: string): string | null {
  return resolveWorkspaceDir(wsName) ?? resolveWorkspaceDir(DEFAULT_WORKSPACE);
}

export const dynamic = "force-dynamic";

/**
 * Read a raw (binary) file by path, for image/glb previews.
 * GET /api/file/raw?path=assets/model.glb&ws=product-planet-v2
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
  const buf = await readRaw(wsDir, raw);
  if (!buf) {
    return NextResponse.json(
      { ok: false, message: "文件不存在或路径非法" },
      { status: 404 },
    );
  }
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": mimeOf(raw),
      "Cache-Control": "no-store",
    },
  });
}
