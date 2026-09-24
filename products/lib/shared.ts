/**
 * 客户端 / 服务端共享的纯常量与类型（不依赖 node API）。
 */

/** URL 查询参数名：当前选中的文件路径锚点 */
export const FILE_PARAM = "file";

/** URL 查询参数名：当前选中的 workspace 名称 */
export const WS_PARAM = "ws";

/** workspace 信息：父目录下的一个子目录，requirements/ 所在的目录 */
export interface WorkspaceInfo {
  /** workspace 名称（目录名） */
  name: string;
  /** 是否包含 requirements/ 文件夹 */
  hasRequirements: boolean;
}

/** 文件类型：决定中间内容区使用哪种编辑器/预览器 */
export type FileKind = "md" | "image" | "glb" | "other";

const IMAGE_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "avif",
  "bmp",
  "ico",
]);

/** 按扩展名判断文件类型 */
export function fileKind(name: string): FileKind {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "md" || ext === "markdown") return "md";
  if (IMAGE_EXTS.has(ext)) return "image";
  if (ext === "glb" || ext === "gltf") return "glb";
  return "other";
}

/** 文件树节点 */
export interface TreeNode {
  /** 目录相对路径，如 "common"、"pages"；根节点为空字符串 */
  dirPath: string;
  /** 目录名，根节点为 "requirements" */
  name: string;
  /** 子目录（按名称排序） */
  dirs: TreeNode[];
  /** 目录内的文件（按名称排序） */
  files: FileNode[];
}

/** 文件节点 */
export interface FileNode {
  /** 相对 CONTENT_ROOT 的路径，如 "pages/home.md"，也是 URL 锚点 */
  path: string;
  /** 文件名，如 "home.md" */
  name: string;
  /** 文件类型（决定编辑器/预览器） */
  kind: FileKind;
}

/**
 * 选中文件的完整信息（由服务端读取）。
 * markdown 文件带 meta 与 content；image/glb 只带元信息，
 * 二进制内容由前端通过 /api/file/raw 按需加载。
 */
export interface FileContent {
  /** 相对路径 */
  path: string;
  /** 文件名（去扩展名），如 "home" */
  name: string;
  /** 文件类型 */
  kind: FileKind;
  /** frontmatter 元数据（仅 md，无则空对象） */
  meta: Record<string, unknown>;
  /** 正文（仅 md，去掉 frontmatter 后的内容） */
  content: string;
}

/** markdown 文件的完整信息（向后兼容别名） */
export type MarkdownDoc = FileContent;

/**
 * frontmatter 的 meta 中声明的一个依赖。
 * inject 为文件路径数组：inject: ["common/base.md", ...]
 * 展示名称由目标文件解析（frontmatter title → 一级标题 → 文件名）。
 */
export interface InjectDep {
  /** 展示名称：frontmatter title → 一级标题 → 文件名 */
  name: string;
  /** 依赖文件路径（相对 requirements 根目录） */
  path: string;
  /** 路径在内容库中是否存在（存在才可点击跳转） */
  exists: boolean;
}

/** 树 -> 文件列表（深度优先，纯函数） */
export function flattenFiles(tree: TreeNode): FileNode[] {
  const out: FileNode[] = [];
  const walk = (node: TreeNode) => {
    for (const file of node.files) out.push(file);
    for (const dir of node.dirs) walk(dir);
  };
  walk(tree);
  return out;
}
