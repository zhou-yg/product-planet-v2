import { NextResponse } from "next/server";
import { createFileIn } from "@/lib/fs";
import { errorResponse, readBody, requireWsDir, strArg } from "../_lib";

export const dynamic = "force-dynamic";

/**
 * 新建文件
 * POST /api/file/create  body: { dir, name, ws? }
 * 在 dir（相对 requirements/ 的路径，空表示根目录）下创建名为 name 的空文件。
 * 返回新文件的相对路径。
 */
export async function POST(request: Request) {
  const body = await readBody(request);
  if (body instanceof NextResponse) return body;
  const ws = requireWsDir(body.ws);
  if (ws instanceof NextResponse) return ws;

  const dir = strArg(body, "dir") ?? "";
  const name = strArg(body, "name");
  if (!name) {
    return NextResponse.json(
      { ok: false, message: "缺少 name" },
      { status: 400 },
    );
  }

  try {
    const path = await createFileIn(ws.wsDir, dir, name);
    return NextResponse.json({ ok: true, path });
  } catch (err) {
    return errorResponse(err);
  }
}
