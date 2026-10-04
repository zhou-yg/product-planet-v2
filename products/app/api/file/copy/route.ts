import { NextResponse } from "next/server";
import { copyTo } from "@/lib/fs";
import { errorResponse, readBody, requireWsDir, strArg } from "../_lib";

export const dynamic = "force-dynamic";

/**
 * 复制
 * POST /api/file/copy  body: { path, dir, ws? }
 * 将文件/文件夹复制到 dir 下（文件夹递归复制）。返回新路径。
 */
export async function POST(request: Request) {
  const body = await readBody(request);
  if (body instanceof NextResponse) return body;
  const ws = requireWsDir(body.ws);
  if (ws instanceof NextResponse) return ws;

  const path = strArg(body, "path");
  const dir = strArg(body, "dir");
  if (!path || dir === null) {
    return NextResponse.json(
      { ok: false, message: "缺少 path 或 dir" },
      { status: 400 },
    );
  }

  try {
    const newPath = await copyTo(ws.wsDir, path, dir);
    return NextResponse.json({ ok: true, path: newPath });
  } catch (err) {
    return errorResponse(err);
  }
}
