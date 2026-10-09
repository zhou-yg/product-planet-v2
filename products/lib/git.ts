import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitChange, GitChangeStatus } from "@/lib/shared";

const execFileAsync = promisify(execFile);

/** git status --porcelain 行状态码 -> GitChangeStatus */
function parseStatus(code: string): GitChangeStatus | null {
  // XY：X 为暂存区状态，Y 为工作区状态，任一为非空状态即视为变更
  const x = code[0];
  const y = code[1];
  const kind = (c: string): GitChangeStatus | null => {
    if (c === "A" || c === "?" || c === "!") return "added";
    if (c === "M" || c === "R" || c === "C" || c === "T") return "modified";
    if (c === "D") return "deleted";
    return null;
  };
  return kind(y) ?? kind(x);
}

/**
 * 列出 workspace 的未提交变更（git status --porcelain，含未跟踪文件）。
 * 非 git 仓库时返回 null（调用方按「无 git」处理）。
 */
export async function listGitChanges(
  wsDir: string,
): Promise<GitChange[] | null> {
  let stdout: string;
  try {
    const result = await execFileAsync(
      "git",
      ["status", "--porcelain=v1", "-z", "-uall"],
      { cwd: wsDir, maxBuffer: 16 * 1024 * 1024 },
    );
    stdout = result.stdout;
  } catch {
    // 非 git 仓库 / git 不可用
    return null;
  }

  const changes: GitChange[] = [];
  // -z：以 NUL 分隔，重命名条目为 "XY new\0old\0"
  const fields = stdout.split("\0");
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (!field) continue;
    const code = field.slice(0, 2);
    const path = field.slice(3);
    if (!path) continue;
    const status = parseStatus(code);
    if (!status) continue;
    if (code[0] === "R" || code[0] === "C") i++; // 跳过重命名/复制的原路径
    changes.push({ status, path });
  }
  // 目录序 + 字典序排序，展示更稳定
  changes.sort((a, b) => a.path.localeCompare(b.path));
  return changes;
}
