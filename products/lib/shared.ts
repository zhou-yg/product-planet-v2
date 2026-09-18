/**
 * 客户端 / 服务端共享的纯常量与类型（不依赖 node API）。
 */

/** URL 查询参数名：当前选中的文件路径锚点 */
export const FILE_PARAM = "file";

/** 文件树节点 */
export interface TreeNode {
  /** 目录相对路径，如 "common"、"pages"；根节点为空字符串 */
  dirPath: string;
  /** 目录名，根节点为 "requirements" */
  name: string;
  /** 子目录（按名称排序） */
  dirs: TreeNode[];
  /** 目录内的 markdown 文件（按名称排序） */
  files: FileNode[];
}

/** 文件节点 */
export interface FileNode {
  /** 相对 CONTENT_ROOT 的路径，如 "pages/home.md"，也是 URL 锚点 */
  path: string;
  /** 文件名，如 "home.md" */
  name: string;
}

/** markdown 文件的完整信息：元数据 + 正文 */
export interface MarkdownDoc {
  /** 相对路径 */
  path: string;
  /** 文件名（去扩展名），如 "home" */
  name: string;
  /** frontmatter 元数据（无则空对象） */
  meta: Record<string, unknown>;
  /** 正文（去掉 frontmatter 后的内容） */
  content: string;
}

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
