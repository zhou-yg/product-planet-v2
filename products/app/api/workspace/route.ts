import { NextResponse } from "next/server";
import { registerWorkspace } from "@/lib/fs";

export const dynamic = "force-dynamic";

/**
 * POST /api/workspace
 * Body: { name: string }
 * Register a workspace by folder name (from the client folder picker).
 * Returns the WorkspaceInfo on success, 404 when not found.
 */
export async function POST(request: Request) {
  let name = "";
  try {
    const body = (await request.json()) as { name?: unknown };
    if (typeof body.name === "string") name = body.name;
  } catch {
    // fall through with empty name
  }
  const info = registerWorkspace(name);
  if (!info) {
    return NextResponse.json(
      { error: `未找到名为「${name}」的 workspace（需含 requirements 文件夹）` },
      { status: 404 },
    );
  }
  return NextResponse.json(info);
}
