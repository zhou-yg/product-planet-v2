import { NextResponse } from "next/server";
import { deletePath } from "@/lib/fs";
import { errorResponse, readBody, requireWsDir, strArg } from "../_lib";

export const dynamic = "force-dynamic";

/**
 * 删除
 * POST /api/file/delete  body: { path, ws? }
 * 删除文件或文件夹，文件夹连同内部内容一并（递归）删除。
 */
export async function POST(request: Request) {
  const body = await readBody(request);
  if (body instanceof NextResponse) return body;
  const ws = requireWsDir(body.ws);
  if (ws instanceof NextResponse) return ws;

  const path = strArg(body, "path");
  if (!path) {
    return NextResponse.json(
      { ok: false, message: "缺少 path" },
      { status: 400 },
    );
  }

  try {
    await deletePath(ws.wsDir, path);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
