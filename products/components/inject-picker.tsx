"use client";

import { useEffect, useMemo, useState } from "react";
import type { FileNode, TreeNode } from "@/lib/shared";
import { flattenFiles } from "@/lib/shared";

interface Props {
  /** 弹窗是否可见 */
  open: boolean;
  /** 关闭弹窗（取消 / 遮罩 / Esc） */
  onClose: () => void;
  /** requirements 文件树（选择列表数据源） */
  tree: TreeNode | null;
  /** 当前 markdown 文件路径（列表中排除自身） */
  docPath: string;
  /** 已声明的 inject 依赖路径（展示为「已添加」，不可再选） */
  existing: string[];
  /** 确定：提交所选路径；返回结果，成功时由本组件关闭弹窗 */
  onConfirm: (paths: string[]) => Promise<{ ok: boolean; message?: string }>;
}

function FolderIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />
    </svg>
  );
}

function FileIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5L13 3.5Z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 shrink-0 text-zinc-400 transition-transform ${
        open ? "rotate-90" : ""
      }`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M9 5l7 7-7 7V5Z" />
    </svg>
  );
}

/**
 * inject 依赖选择器（requirements/pages/home/right.md）
 *
 * 文件树选择器弹窗：
 * - 展示 requirements/ 下的所有文件（树形，文件夹可展开/收起）
 * - 支持前端搜索（按文件名或路径过滤，搜索时展示扁平匹配列表）
 * - 支持多选（checkbox）；已声明的依赖展示为「已添加」，不可再选
 * - 点击确定后提交所选路径，成功后关闭
 */
export default function InjectPicker({
  open,
  onClose,
  tree,
  docPath,
  existing,
  onConfirm,
}: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const existingSet = useMemo(() => new Set(existing), [existing]);

  // 打开时重置状态
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(new Set());
      setCollapsed(new Set());
      setBusy(false);
      setError("");
    }
  }, [open]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onClose]);

  const toggleDir = (dirPath: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
  };

  const toggleFile = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const confirm = async () => {
    if (busy || selected.size === 0) return;
    setBusy(true);
    setError("");
    const result = await onConfirm([...selected]);
    setBusy(false);
    if (result.ok) {
      onClose();
    } else {
      setError(result.message ?? "新增依赖失败");
    }
  };

  // 搜索：扁平匹配列表（按文件名或路径，忽略大小写）
  const q = query.trim().toLowerCase();
  const searching = q !== "";
  const matched: FileNode[] = useMemo(() => {
    if (!tree || !searching) return [];
    return flattenFiles(tree).filter(
      (f) =>
        f.path !== docPath &&
        (f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)),
    );
  }, [tree, searching, q, docPath]);

  /** 文件行（checkbox + 图标 + 文件名；搜索时附带路径） */
  const renderFile = (f: FileNode, pad: number, showPath: boolean) => {
    const isExisting = existingSet.has(f.path);
    const checked = isExisting || selected.has(f.path);
    return (
      <li key={f.path}>
        <label
          className={`flex items-center gap-2 rounded-md py-1.5 pr-2 text-sm transition-colors ${
            isExisting
              ? "cursor-default opacity-60"
              : "cursor-pointer hover:bg-zinc-50"
          }`}
          style={{ paddingLeft: `${pad}px` }}
        >
          <input
            type="checkbox"
            checked={checked}
            disabled={isExisting}
            onChange={() => toggleFile(f.path)}
            aria-label={f.path}
            className="h-3.5 w-3.5 shrink-0 accent-blue-600"
          />
          <FileIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <span className="min-w-0 flex-1 truncate text-zinc-700">{f.name}</span>
          {isExisting ? (
            <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-400">
              已添加
            </span>
          ) : showPath ? (
            <span className="shrink-0 truncate font-mono text-[10px] text-zinc-400">
              {f.path}
            </span>
          ) : null}
        </label>
      </li>
    );
  };

  /** 目录行（可展开/收起），递归渲染子目录与文件 */
  const renderDir = (node: TreeNode, depth: number) => {
    const isRoot = node.dirPath === "";
    const isCollapsed = collapsed.has(node.dirPath);
    // 根目录无行；文件夹行缩进 depth，其内文件再进一层
    const rowPad = 8 + depth * 14;
    const filePad = 8 + (isRoot ? 0 : depth + 1) * 14;
    return (
      <li key={isRoot ? "__root__" : node.dirPath}>
        {!isRoot ? (
          <button
            type="button"
            onClick={() => toggleDir(node.dirPath)}
            aria-expanded={!isCollapsed}
            className="flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
            style={{ paddingLeft: `${rowPad}px` }}
          >
            <ChevronIcon open={!isCollapsed} />
            <FolderIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            <span className="truncate">{node.name}</span>
          </button>
        ) : null}
        {!isCollapsed ? (
          <ul>
            {node.files
              .filter((f) => f.path !== docPath)
              .map((f) => renderFile(f, filePad, false))}
            {node.dirs.map((d) => renderDir(d, depth + 1))}
          </ul>
        ) : null}
      </li>
    );
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="新增 inject 依赖"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex max-h-[32rem] w-[30rem] max-w-full flex-col rounded-lg border border-zinc-200 bg-white shadow-xl">
        {/* 标题 */}
        <div className="shrink-0 px-4 pb-2 pt-4">
          <h3 className="text-sm font-semibold text-zinc-900">新增 inject 依赖</h3>
          <p className="mt-0.5 truncate font-mono text-xs text-zinc-400">
            {docPath}
          </p>
        </div>

        {/* 前端搜索 */}
        <div className="shrink-0 px-4 pb-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="搜索文件"
            placeholder="搜索文件名或路径"
            className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-400"
          />
        </div>

        {/* 文件树 / 搜索结果 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {!tree ? (
            <p className="px-2 py-4 text-sm text-zinc-400">暂无文件</p>
          ) : searching ? (
            matched.length === 0 ? (
              <p className="px-2 py-4 text-sm text-zinc-400">无匹配文件</p>
            ) : (
              <ul>{matched.map((f) => renderFile(f, 8, true))}</ul>
            )
          ) : (
            <ul>{renderDir(tree, -1)}</ul>
          )}
        </div>

        {/* 底部：错误提示 + 已选数量 + 操作 */}
        <div className="shrink-0 border-t border-zinc-100 px-4 py-3">
          {error ? (
            <p className="mb-2 truncate text-xs text-red-600" title={error}>
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-500">已选 {selected.size} 项</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={busy || selected.size === 0}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "提交中…" : "确定"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
