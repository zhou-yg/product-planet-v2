import { NextResponse } from "next/server";
import { renameTo } from "@/lib/fs";
import { errorResponse, readBody, requireWsDir, strArg } from "../_lib";

export const dynamic = "force-dynamic";

/**
 * 重命名
 * POST /api/file/rename  body: { path, name, ws? }
 * 将文件/文件夹在原目录下重命名为 name。返回新路径。
 */
export async function POST(request: Request) {
  const body = await readBody(request);
  if (body instanceof NextResponse) return body;
  const ws = requireWsDir(body.ws);
  if (ws instanceof NextResponse) return ws;

  const path = strArg(body, "path");
  const name = strArg(body, "name");
  if (!path || !name) {
    return NextResponse.json(
      { ok: false, message: "缺少 path 或 name" },
      { status: 400 },
    );
  }

  try {
    const newPath = await renameTo(ws.wsDir, path, name);
    return NextResponse.json({ ok: true, path: newPath });
  } catch (err) {
    return errorResponse(err);
  }
}
