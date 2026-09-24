import "server-only";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import type { Dirent } from "node:fs";
import matter from "gray-matter";
import type {
  FileContent,
  FileNode,
  InjectDep,
  TreeNode,
  WorkspaceInfo,
} from "@/lib/shared";
import { fileKind, flattenFiles } from "@/lib/shared";

export { FILE_PARAM, WS_PARAM, flattenFiles } from "@/lib/shared";
export type {
  FileContent,
  FileNode,
  InjectDep,
  MarkdownDoc,
  TreeNode,
  WorkspaceInfo,
} from "@/lib/shared";

/**
 * Workspace 根目录：requirements/ 所在的目录（如仓库根目录）。
 * 同级目录视为其它 workspace，workspace 选择器从中列出。
 * 优先用环境变量 REQUIREMENTS_ROOT 指定默认 workspace 根目录；
 * 否则从 cwd 逐级向上查找 requirements/（支持 products/ 内运行与仓库根目录运行）。
 */
const DEFAULT_WORKSPACE_ROOT = resolveDefaultWorkspaceRoot();

/** 默认 workspace 根目录（含 requirements/ 的目录） */
export const DEFAULT_WORKSPACE = path.basename(DEFAULT_WORKSPACE_ROOT);

/** workspace 的父目录，其下的每个子目录都是一个候选 workspace */
export const WORKSPACE_PARENT = path.dirname(DEFAULT_WORKSPACE_ROOT);

function resolveDefaultWorkspaceRoot(): string {
  const envRoot = process.env.REQUIREMENTS_ROOT;
  if (envRoot) {
    // REQUIREMENTS_ROOT points to the requirements/ folder itself
    return path.resolve(envRoot, "..");
  }
  let dir = process.cwd();
  for (;;) {
    if (fsSync.existsSync(path.join(dir, "requirements"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: assume running inside products/, requirements/ one level up
  return path.resolve(process.cwd(), "..");
}

/**
 * 运行期注册的额外 workspace（文件夹选择器动态注册），name -> 绝对路径。
 * 持久化到文件，确保 dev 模式下多 worker / 服务重启后仍可用。
 */
const REGISTRY_FILE = path.join(
  os.tmpdir(),
  "product-planet-workspace-registry.json",
);

function loadRegistry(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    const raw = fsSync.readFileSync(REGISTRY_FILE, "utf-8");
    const data = JSON.parse(raw) as Record<string, string>;
    for (const [name, abs] of Object.entries(data)) {
      if (typeof abs === "string" && fsSync.existsSync(abs)) map.set(name, abs);
    }
  } catch {
    // No registry yet or unreadable: start empty
  }
  return map;
}

function saveRegistry(map: Map<string, string>): void {
  try {
    fsSync.writeFileSync(
      REGISTRY_FILE,
      JSON.stringify(Object.fromEntries(map), null, 2),
      "utf-8",
    );
  } catch {
    // Best-effort persistence
  }
}

const extraWorkspaces = loadRegistry();

function rememberWorkspace(name: string, abs: string): void {
  extraWorkspaces.set(name, abs);
  saveRegistry(extraWorkspaces);
}

/** 列出所有候选 workspace（父目录下的子目录 + 动态注册项，标注是否含 requirements/） */
export async function listWorkspaces(): Promise<WorkspaceInfo[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(WORKSPACE_PARENT, { withFileTypes: true });
  } catch {
    return [{ name: DEFAULT_WORKSPACE, hasRequirements: true }];
  }
  const list: WorkspaceInfo[] = [
    { name: DEFAULT_WORKSPACE, hasRequirements: true },
  ];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;
    if (entry.name === DEFAULT_WORKSPACE) continue;
    const hasRequirements = fsSync.existsSync(
      path.join(WORKSPACE_PARENT, entry.name, "requirements"),
    );
    list.push({ name: entry.name, hasRequirements });
  }
  // Include dynamically registered workspaces picked via the folder selector
  for (const [name, abs] of extraWorkspaces) {
    if (list.some((ws) => ws.name === name)) continue;
    list.push({ name, hasRequirements: workspaceHasRequirements(abs) });
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

/** Skip heavy / irrelevant directories during the bounded search */
const SEARCH_SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  "Library",
  "Applications",
  "System",
]);

/** Bounded BFS: find a directory with the given name (containing requirements/) under root */
function searchWorkspaceDir(
  root: string,
  name: string,
  maxDepth: number,
): string | null {
  let level: string[] = [root];
  for (let depth = 0; depth <= maxDepth && level.length > 0; depth++) {
    const next: string[] = [];
    for (const dir of level) {
      let entries: Dirent[];
      try {
        entries = fsSync.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(".") || SEARCH_SKIP_DIRS.has(entry.name))
          continue;
        const abs = path.join(dir, entry.name);
        if (entry.name === name && workspaceHasRequirements(abs)) return abs;
        if (depth < maxDepth) next.push(abs);
      }
    }
    level = next;
  }
  return null;
}

/**
 * Register a workspace by folder name (from the client folder picker).
 * Searches known roots for a directory with the same name that contains
 * a requirements/ folder, then registers it for this server session.
 */
export function registerWorkspace(name: string): WorkspaceInfo | null {
  if (
    !name ||
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("\0") ||
    name.startsWith(".")
  ) {
    return null;
  }
  // Already known (registry may have been written by another worker)
  const cached = extraWorkspaces.get(name) ?? loadRegistry().get(name);
  if (cached && workspaceHasRequirements(cached)) {
    return { name, hasRequirements: true };
  }
  // Search roots: workspace parent dir first, then bounded searches below it
  // and below the user's home / common project locations.
  const direct = path.join(WORKSPACE_PARENT, name);
  if (workspaceHasRequirements(direct)) {
    rememberWorkspace(name, direct);
    return { name, hasRequirements: true };
  }
  const searchRoots = [
    WORKSPACE_PARENT,
    process.cwd(),
    path.join(os.homedir(), "Documents"),
    path.join(os.homedir(), "Projects"),
    os.homedir(),
  ];
  for (const root of searchRoots) {
    const found = searchWorkspaceDir(root, name, 4);
    if (found) {
      rememberWorkspace(name, found);
      return { name, hasRequirements: true };
    }
  }
  return null;
}

/** 校验 workspace 名称合法（父目录内的子目录名或已注册项），返回根目录绝对路径或 null */
export function resolveWorkspaceDir(name: string): string | null {
  if (!name || name.includes("/") || name.includes("\\") || name.includes("\0"))
    return null;
  if (name.startsWith(".")) return null;
  // Reload registry lazily: another worker may have registered workspaces
  const extra = extraWorkspaces.get(name) ?? loadRegistry().get(name);
  if (extra) return extra;
  const abs = path.resolve(WORKSPACE_PARENT, name);
  const parentWithSep = WORKSPACE_PARENT.endsWith(path.sep)
    ? WORKSPACE_PARENT
    : WORKSPACE_PARENT + path.sep;
  if (abs !== WORKSPACE_PARENT && !abs.startsWith(parentWithSep)) return null;
  return abs;
}

/** workspace 是否含 requirements 目录 */
export function workspaceHasRequirements(wsDir: string): boolean {
  return fsSync.existsSync(path.join(wsDir, "requirements"));
}

const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", ".turbo"]);

/** 文件树收录的扩展名（md 文档 + 可预览的资源类型） */
const TREE_EXTS = /\.(md|markdown|png|jpe?g|gif|webp|svg|avif|bmp|ico|glb|gltf)$/i;

/** 递归构建某个 workspace requirements/ 下的文件树 */
export async function buildTree(wsDir: string): Promise<TreeNode> {
  return buildDir(wsDir, "", "requirements");
}

async function buildDir(
  wsDir: string,
  relDir: string,
  displayName: string,
): Promise<TreeNode> {
  const absDir = relDir
    ? path.join(wsDir, "requirements", relDir)
    : path.join(wsDir, "requirements");
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
          wsDir,
          relDir ? path.posix.join(relDir, entry.name) : entry.name,
          entry.name,
        ),
      );
    } else if (
      entry.isFile() &&
      TREE_EXTS.test(entry.name) &&
      entry.name.toLowerCase() !== "readme.md"
    ) {
      files.push({
        path: relDir ? `${relDir}/${entry.name}` : entry.name,
        name: entry.name,
        kind: fileKind(entry.name),
      });
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return { dirPath: relDir, name: displayName, dirs, files };
}

/** 校验路径合法（在 workspace requirements/ 内、是受支持的文件类型），返回绝对路径或 null */
function resolveSafe(wsDir: string, relPath: string): string | null {
  if (!relPath || relPath.includes("\0")) return null;
  if (!TREE_EXTS.test(relPath)) return null;
  const abs = path.resolve(path.join(wsDir, "requirements"), relPath);
  const root = path.join(wsDir, "requirements");
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (abs !== root && !abs.startsWith(rootWithSep)) return null;
  return abs;
}

/**
 * 读取文件信息：md 文件解析 frontmatter 与正文；
 * image/glb 文件只返回元信息（二进制内容由 /api/file/raw 加载）。
 */
export async function readFileContent(
  wsDir: string,
  relPath: string,
): Promise<FileContent | null> {
  const abs = resolveSafe(wsDir, relPath);
  if (!abs) return null;
  const kind = fileKind(relPath);
  const name = path.basename(relPath, path.extname(relPath));
  if (kind !== "md") {
    return { path: relPath, name, kind, meta: {}, content: "" };
  }
  let raw: string;
  try {
    raw = await fs.readFile(abs, "utf-8");
  } catch {
    return null;
  }
  const parsed = matter(raw);
  const meta = (parsed.data ?? {}) as Record<string, unknown>;
  return { path: relPath, name, kind, meta, content: parsed.content };
}

/** 向后兼容：读取 markdown 文档（等价于 readFileContent，非 md 返回 null） */
export async function readDoc(
  wsDir: string,
  relPath: string,
): Promise<FileContent | null> {
  const doc = await readFileContent(wsDir, relPath);
  return doc && doc.kind === "md" ? doc : null;
}

/**
 * 解析 inject 依赖：inject 为文件路径数组，如 inject: ["common/base.md"]。
 * 逐个读取依赖文件，解析出展示名称（frontmatter title → 一级标题 → 文件名）；
 * 路径不存在时 exists 为 false（展示但仍可看到路径）。
 */
export async function resolveInject(
  wsDir: string,
  meta: Record<string, unknown>,
): Promise<InjectDep[]> {
  const value = meta.inject;
  if (!Array.isArray(value)) return [];
  const deps: InjectDep[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const p = item.trim();
    if (!p) continue;
    const abs = resolveSafe(wsDir, p);
    if (!abs) continue; // 非法路径（越界 / 不支持的类型）直接忽略
    let name = path.basename(p, path.extname(p));
    let exists = false;
    try {
      const raw = await fs.readFile(abs, "utf-8");
      exists = true;
      if (fileKind(p) === "md") {
        const parsed = matter(raw);
        const metaObj = (parsed.data ?? {}) as Record<string, unknown>;
        const title =
          typeof metaObj.title === "string" && metaObj.title.trim()
            ? metaObj.title.trim()
            : firstH1(parsed.content);
        if (title) name = title;
      }
    } catch {
      // 文件不存在：保留文件名作为名称
    }
    deps.push({ name, path: p, exists });
  }
  return deps;
}

/** 读取原始二进制文件（image/glb 预览用），返回 Buffer 或 null */
export async function readRaw(
  wsDir: string,
  relPath: string,
): Promise<Buffer | null> {
  const abs = resolveSafe(wsDir, relPath);
  if (!abs) return null;
  try {
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}

/** 文件的 MIME 类型（raw 接口返回用） */
export function mimeOf(relPath: string): string {
  const kind = fileKind(relPath);
  if (kind === "md") return "text/markdown; charset=utf-8";
  const ext = relPath.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    avif: "image/avif",
    bmp: "image/bmp",
    ico: "image/x-icon",
    glb: "model/gltf-binary",
    gltf: "model/gltf+json",
  };
  return map[ext] ?? "application/octet-stream";
}

/** 取正文第一个一级标题文本 */
function firstH1(content: string): string | null {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

/** 默认打开的文件：优先 requirements/pages/home.md */
export async function defaultFile(wsDir: string): Promise<string> {
  const candidates = ["pages/home.md", "common/base.md"];
  for (const candidate of candidates) {
    const abs = resolveSafe(wsDir, candidate);
    if (!abs) continue;
    try {
      await fs.access(abs);
      return candidate;
    } catch {
      // continue
    }
  }
  const tree = await buildTree(wsDir);
  const first = flattenFiles(tree).find((f) => f.kind === "md");
  return first?.path ?? "";
}
