import "server-only";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { Dirent } from "node:fs";
import matter from "gray-matter";
import type {
  FileNode,
  InjectDep,
  MarkdownDoc,
  TreeNode,
} from "@/lib/shared";
import { flattenFiles } from "@/lib/shared";

export { FILE_PARAM, flattenFiles } from "@/lib/shared";
export type {
  FileNode,
  InjectDep,
  MarkdownDoc,
  TreeNode,
} from "@/lib/shared";

/**
 * 根目录：markdown 内容库（文件树展示、内容浏览的范围）。
 * 应用代码在 products/ 下运行，requirements/ 位于仓库根目录（上一级），
 * 因此优先用环境变量 REQUIREMENTS_ROOT 指定；否则从 cwd 逐级向上查找
 * （支持 products/ 内运行与仓库根目录运行两种情况）。
 */
export const CONTENT_ROOT = resolveContentRoot();

function resolveContentRoot(): string {
  if (process.env.REQUIREMENTS_ROOT) {
    return path.resolve(process.env.REQUIREMENTS_ROOT);
  }
  let dir = process.cwd();
  for (;;) {
    const candidate = path.join(dir, "requirements");
    if (fsSync.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // 兜底：假定从 products/ 内运行，requirements/ 在上一级
  return path.join(process.cwd(), "..", "requirements");
}

const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", ".turbo"]);

/** 递归构建 markdown 文件树 */
export async function buildTree(): Promise<TreeNode> {
  return buildDir("", "requirements");
}

async function buildDir(relDir: string, displayName: string): Promise<TreeNode> {
  const absDir = relDir ? path.join(CONTENT_ROOT, relDir) : CONTENT_ROOT;
  let entries: Dirent[];
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return { dirPath: relDir, name: displayName, dirs: [], files: [] };
  }

  const dirs: TreeNode[] = [];
  const files: FileNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (IGNORED_DIRS.has(entry.name)) continue;
    if (entry.isDirectory()) {
      dirs.push(
        await buildDir(
          relDir ? path.posix.join(relDir, entry.name) : entry.name,
          entry.name,
        ),
      );
    } else if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".md") &&
      entry.name.toLowerCase() !== "readme.md"
    ) {
      files.push({
        path: relDir ? `${relDir}/${entry.name}` : entry.name,
        name: entry.name,
      });
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return { dirPath: relDir, name: displayName, dirs, files };
}

/** 校验路径合法（在 CONTENT_ROOT 内、是 .md 文件），返回绝对路径或 null */
function resolveSafe(relPath: string): string | null {
  if (!relPath || relPath.includes("\0")) return null;
  if (!relPath.toLowerCase().endsWith(".md")) return null;
  const abs = path.resolve(CONTENT_ROOT, relPath);
  const rootWithSep = CONTENT_ROOT.endsWith(path.sep)
    ? CONTENT_ROOT
    : CONTENT_ROOT + path.sep;
  if (abs !== CONTENT_ROOT && !abs.startsWith(rootWithSep)) return null;
  return abs;
}

/** 读取文件并解析 frontmatter；路径非法或不存在时返回 null */
export async function readDoc(relPath: string): Promise<MarkdownDoc | null> {
  const abs = resolveSafe(relPath);
  if (!abs) return null;
  let raw: string;
  try {
    raw = await fs.readFile(abs, "utf-8");
  } catch {
    return null;
  }
  const parsed = matter(raw);
  const meta = (parsed.data ?? {}) as Record<string, unknown>;
  return {
    path: relPath,
    name: path.basename(relPath, path.extname(relPath)),
    meta,
    content: parsed.content,
  };
}

/**
 * 解析 inject 依赖：inject 为文件路径数组，如 inject: ["common/base.md"]。
 * 逐个读取依赖文件，解析出展示名称（frontmatter title → 一级标题 → 文件名）；
 * 路径不存在时 exists 为 false（展示但仍可看到路径）。
 */
export async function resolveInject(
  meta: Record<string, unknown>,
): Promise<InjectDep[]> {
  const value = meta.inject;
  if (!Array.isArray(value)) return [];
  const deps: InjectDep[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const p = item.trim();
    if (!p) continue;
    const abs = resolveSafe(p);
    if (!abs) continue; // 非法路径（越界 / 非 .md）直接忽略
    let name = path.basename(p, path.extname(p));
    let exists = false;
    try {
      const raw = await fs.readFile(abs, "utf-8");
      exists = true;
      const parsed = matter(raw);
      const metaObj = (parsed.data ?? {}) as Record<string, unknown>;
      const title =
        typeof metaObj.title === "string" && metaObj.title.trim()
          ? metaObj.title.trim()
          : firstH1(parsed.content);
      if (title) name = title;
    } catch {
      // 文件不存在：保留文件名作为名称
    }
    deps.push({ name, path: p, exists });
  }
  return deps;
}

/** 取正文第一个一级标题文本 */
function firstH1(content: string): string | null {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

/** 默认打开的文件：优先 requirements/pages/home.md */
export async function defaultFile(): Promise<string> {
  const candidates = ["pages/home.md", "common/base.md"];
  for (const candidate of candidates) {
    const abs = resolveSafe(candidate);
    if (!abs) continue;
    try {
      await fs.access(abs);
      return candidate;
    } catch {
      // continue
    }
  }
  const tree = await buildTree();
  const first = flattenFiles(tree)[0];
  return first?.path ?? "";
}
