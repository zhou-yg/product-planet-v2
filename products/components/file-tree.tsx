"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { FileNode, TreeNode, WorkspaceInfo } from "@/lib/shared";
import { FILE_PARAM, WS_PARAM } from "@/lib/shared";

interface Props {
  tree: TreeNode | null;
  selected: string;
  fallbackHint?: string;
  workspaces: WorkspaceInfo[];
  activeWs: string;
  missingRequirements: boolean;
}

interface DirectoryPickerDirHandle {
  kind: "directory";
  name: string;
}

interface WindowWithDirPicker extends Window {
  showDirectoryPicker?: (options?: {
    mode?: "read" | "readwrite";
  }) => Promise<DirectoryPickerDirHandle>;
}

/** 点点点 icon（hover 后显示，点击弹出菜单） */
function MoreIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
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

/** 菜单动作 */
type MenuAction = "createFile" | "createDir" | "rename" | "delete";

/** 菜单定位与目标 */
interface MenuState {
  /** 菜单锚点：对应节点行的 DOM 元素 */
  anchor: HTMLElement;
  /** 动作目标：文件夹 dirPath（"" 为根目录） */
  dirPath: string;
  /** 动作目标：文件路径（文件夹节点为 null） */
  filePath: string | null;
  /** 目标名称（弹窗默认值） */
  name: string;
  isRoot: boolean;
}

/** 弹窗状态 */
interface DialogState {
  mode: "createFile" | "createDir" | "rename" | "delete";
  /** 目标路径（文件路径 / 文件夹 dirPath；根目录为 ""） */
  target: string;
  /** 文件夹节点为 true（重命名/删除时用于提示） */
  isDir: boolean;
  /** 输入框默认值 */
  initial: string;
}

/** 名称输入校验：非空、不以 `.` 开头；文件名不含 `/`；文件夹名可含 `/`（多级） */
function validateName(raw: string, mode: DialogState["mode"]): string | null {
  const name = raw.trim();
  if (!name) return "名称不能为空";
  if (name.startsWith(".")) return "名称不能以 . 开头";
  if (name.includes("\\")) return "名称不能包含 \\";
  if (name.includes(":")) return "名称不能包含 :";
  if (mode === "createFile" || mode === "rename") {
    if (name.includes("/")) {
      // 重命名文件夹时不允许改名的同时移动（与规范一致：重命名在原目录下）
      return "名称不能包含 /";
    }
  }
  if (mode === "createDir") {
    // 文件夹名可用 `/` 一次创建多级，校验每一段
    const segs = name.split("/");
    for (const seg of segs) {
      if (!seg) return "文件夹名不能包含空路径段（如 a//b）";
      if (seg.startsWith(".")) return "名称段不能以 . 开头";
    }
  }
  return null;
}

/** 文件树节点行（递归渲染：文件夹可展开/收起，文件可选中） */
function TreeRow({
  node,
  depth,
  expanded,
  selected,
  onToggle,
  onPick,
  onMenu,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  selected: string;
  onToggle: (dirPath: string) => void;
  onPick: (path: string) => void;
  onMenu: (state: Omit<MenuState, "anchor">, anchor: HTMLElement) => void;
}) {
  const open = expanded.has(node.dirPath);
  const childEntries: Array<
    { type: "dir"; node: TreeNode } | { type: "file"; node: FileNode }
  > = useMemo(() => {
    // 排序：文件夹在前、文件在后，各自按名称排序
    const dirs = node.dirs.map((d) => ({ type: "dir" as const, node: d }));
    const files = node.files.map((f) => ({ type: "file" as const, node: f }));
    return [...dirs, ...files];
  }, [node.dirs, node.files]);

  const hasChildren = node.dirs.length > 0 || node.files.length > 0;

  return (
    <li>
      <div
        className={`group flex items-center gap-1 rounded-md pr-1 text-left text-sm transition-colors hover:bg-zinc-100 ${
          open ? "bg-zinc-50" : ""
        }`}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        <button
          type="button"
          onClick={() => onToggle(node.dirPath)}
          aria-expanded={open}
          aria-label={open ? `收起 ${node.name}` : `展开 ${node.name}`}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1.5 pr-1 text-left font-medium text-zinc-700"
          data-tree-dir={node.dirPath}
        >
          <ChevronIcon open={open} />
          <FolderIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <span className="truncate">{node.name}</span>
        </button>
        <button
          type="button"
          aria-label={`${node.name} 的操作菜单`}
          title="更多操作"
          onClick={(e) => {
            e.stopPropagation();
            onMenu(
              {
                dirPath: node.dirPath,
                filePath: null,
                name: node.name,
                isRoot: false,
              },
              e.currentTarget,
            );
          }}
          className="invisible rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 group-hover:visible"
        >
          <MoreIcon />
        </button>
      </div>

      {open ? (
        hasChildren ? (
          <ul>
            {childEntries.map((entry) =>
              entry.type === "dir" ? (
                <TreeRow
                  key={entry.node.dirPath}
                  node={entry.node}
                  depth={depth + 1}
                  expanded={expanded}
                  selected={selected}
                  onToggle={onToggle}
                  onPick={onPick}
                  onMenu={onMenu}
                />
              ) : (
                <li key={entry.node.path}>
                  <div
                    className={`group flex items-center gap-1 rounded-md pr-1 text-sm transition-colors ${
                      selected === entry.node.path
                        ? "bg-blue-50"
                        : "hover:bg-zinc-100"
                    }`}
                    style={{ paddingLeft: `${(depth + 1) * 12 + 14}px` }}
                  >
                    <button
                      type="button"
                      onClick={() => onPick(entry.node.path)}
                      aria-current={
                        selected === entry.node.path ? "true" : undefined
                      }
                      className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1.5 pr-1 text-left ${
                        selected === entry.node.path
                          ? "font-medium text-blue-700"
                          : "text-zinc-700"
                      }`}
                      data-tree-file={entry.node.path}
                    >
                      <FileIcon
                        className={`h-3.5 w-3.5 shrink-0 ${
                          selected === entry.node.path
                            ? "text-blue-500"
                            : "text-zinc-400"
                        }`}
                      />
                      <span className="truncate">{entry.node.name}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`${entry.node.name} 的操作菜单`}
                      title="更多操作"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMenu(
                          {
                            dirPath: node.dirPath,
                            filePath: entry.node.path,
                            name: entry.node.name,
                            isRoot: false,
                          },
                          e.currentTarget,
                        );
                      }}
                      className="invisible rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 group-hover:visible"
                    >
                      <MoreIcon />
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        ) : (
          <p
            className="px-2 py-1.5 text-xs text-zinc-400"
            style={{ paddingLeft: `${(depth + 1) * 12 + 26}px` }}
          >
            暂无文件
          </p>
        )
      ) : null}
    </li>
  );
}

export default function FileTree({
  tree,
  selected,
  fallbackHint,
  workspaces,
  activeWs,
  missingRequirements,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // 展开的文件夹集合（默认展开：初始为树中全部文件夹）
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>();
    const walk = (node: TreeNode) => {
      s.add(node.dirPath);
      node.dirs.forEach(walk);
    };
    if (tree) walk(tree);
    return s;
  });

  // 树变化时（切换 workspace / 增删文件后 router.refresh）合并新文件夹为展开
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      const walk = (node: TreeNode) => {
        if (prev.has(node.dirPath) || prev.size === 0) next.add(node.dirPath);
        node.dirs.forEach(walk);
      };
      if (tree) walk(tree);
      return next;
    });
  }, [tree]);

  // 点点点菜单状态
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 弹窗状态
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogValue, setDialogValue] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [dialogBusy, setDialogBusy] = useState(false);
  const dialogInputRef = useRef<HTMLInputElement>(null);

  // 操作提示条（错误 / 成功反馈）
  const [notice, setNotice] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const onPick = useCallback(
    (path: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(FILE_PARAM, path);
      startTransition(() => {
        router.push(`/?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams],
  );

  // Switch workspace: refresh the tree under the new workspace's requirements/
  const onSwitchWs = useCallback(
    (ws: string) => {
      const params = new URLSearchParams();
      params.set(WS_PARAM, ws);
      startTransition(() => {
        router.push(`/?${params.toString()}`, { scroll: false });
      });
    },
    [router],
  );

  // System-style folder picker (File System Access API).
  const [pickError, setPickError] = useState("");
  const [registering, setRegistering] = useState(false);

  const pickAndSwitchWs = useCallback(
    async (folder: string) => {
      setPickError("");
      setRegistering(true);
      try {
        let matched = workspaces.find((ws) => ws.name === folder);
        if (!matched || !matched.hasRequirements) {
          const res = await fetch("/api/workspace", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: folder }),
          });
          if (res.ok) {
            matched = (await res.json()) as WorkspaceInfo;
          }
        }
        if (!matched) {
          setPickError(
            `未找到名为「${folder}」的 workspace（需含 requirements 文件夹）`,
          );
          return;
        }
        if (!matched.hasRequirements) {
          setPickError(`所选 workspace「${folder}」缺少 requirements 文件夹`);
        }
        onSwitchWs(folder);
      } catch (err) {
        setPickError(`选择文件夹失败：${String(err)}`);
      } finally {
        setRegistering(false);
      }
    },
    [onSwitchWs, workspaces],
  );

  const pickFolder = useCallback(async () => {
    setPickError("");
    const w = window as WindowWithDirPicker;
    if (typeof w.showDirectoryPicker === "function") {
      try {
        const handle = await w.showDirectoryPicker({ mode: "read" });
        await pickAndSwitchWs(handle.name);
      } catch (err) {
        if ((err as DOMException)?.name !== "AbortError") {
          setPickError(`选择文件夹失败：${String(err)}`);
        }
      }
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
    input.onchange = () => {
      const files = input.files;
      if (!files || files.length === 0) return;
      const relPath: string = (files[0] as File & { webkitRelativePath?: string })
        .webkitRelativePath ?? "";
      const folder = relPath.split("/")[0] ?? "";
      if (!folder) {
        setPickError("无法识别所选文件夹名称");
        return;
      }
      void pickAndSwitchWs(folder);
    };
    input.click();
  }, [pickAndSwitchWs]);

  // ---------- 点点点菜单 ----------

  const openMenu = useCallback(
    (
      state: Omit<MenuState, "anchor">,
      anchor: HTMLElement,
    ) => {
      // 再次点击点点点 icon：切换关闭
      if (menu && menu.anchor === anchor) {
        setMenu(null);
        return;
      }
      setMenu({ ...state, anchor });
    },
    [menu],
  );

  // 菜单关闭：点击菜单外区域、按 Esc
  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !menu.anchor.contains(e.target as Node)
      ) {
        setMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menu]);

  const closeMenu = useCallback(() => setMenu(null), []);

  /** 菜单动作 → 打开对应弹窗（或直接执行） */
  const runMenuAction = useCallback(
    (action: MenuAction) => {
      if (!menu) return;
      const { dirPath, filePath, name, isRoot } = menu;
      closeMenu();
      if (action === "createFile" || action === "createDir") {
        setDialog({
          mode: action,
          target: dirPath,
          isDir: false,
          initial: "",
        });
        setDialogValue("");
        setDialogError("");
        return;
      }
      if (action === "rename") {
        setDialog({
          mode: "rename",
          target: filePath ?? dirPath,
          isDir: filePath === null,
          initial: name,
        });
        setDialogValue(name);
        setDialogError("");
        return;
      }
      // delete：二次确认
      setDialog({
        mode: "delete",
        target: filePath ?? dirPath,
        isDir: filePath === null,
        initial: name,
      });
      setDialogValue("");
      setDialogError("");
    },
    [closeMenu, menu],
  );

  // ---------- 弹窗（新建 / 重命名 / 删除确认） ----------

  // 打开弹窗后聚焦输入框（重命名时全选）
  useEffect(() => {
    if (dialog && dialog.mode !== "delete" && dialogInputRef.current) {
      dialogInputRef.current.focus();
      if (dialog.mode === "rename") dialogInputRef.current.select();
    }
  }, [dialog]);

  const closeDialog = useCallback(() => {
    setDialog(null);
    setDialogValue("");
    setDialogError("");
    setDialogBusy(false);
  }, []);

  // 弹窗内按 Esc 关闭
  useEffect(() => {
    if (!dialog) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDialog();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeDialog, dialog]);

  /** 更新 url 中的选中文件（重命名 → 新路径；删除 → 清除选中） */
  const updateSelectedInUrl = useCallback(
    (newPath: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newPath) {
        params.set(FILE_PARAM, newPath);
      } else {
        params.delete(FILE_PARAM);
      }
      startTransition(() => {
        router.push(`/?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams],
  );

  /** 重命名后若影响当前选中文件，更新 url */
  const syncSelectionAfter = useCallback(
    (oldPath: string, newPath: string | null) => {
      if (selected === oldPath || selected.startsWith(`${oldPath}/`)) {
        updateSelectedInUrl(newPath);
        return true;
      }
      return false;
    },
    [selected, updateSelectedInUrl],
  );

  /** 调用文件管理接口；成功后刷新文件树（router.refresh 触发服务端重渲染） */
  const callFsApi = useCallback(
    async (
      url: string,
      body: Record<string, unknown>,
    ): Promise<{ ok: boolean; path?: string; message?: string }> => {
      const ws = searchParams.get(WS_PARAM) ?? "";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, ...(ws ? { ws } : {}) }),
      });
      let data: { ok?: boolean; path?: string; message?: string } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        // 非 JSON 响应按失败处理
      }
      if (!res.ok || !data.ok) {
        return {
          ok: false,
          message: data.message ?? `请求失败（${res.status}）`,
        };
      }
      return { ok: true, path: data.path };
    },
    [searchParams],
  );

  /** 展开目标所在的各级文件夹（新建 / 重命名后自动展开所属文件夹） */
  const expandDir = useCallback((dirPath: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      let cur = dirPath;
      while (cur) {
        next.add(cur);
        const idx = cur.lastIndexOf("/");
        cur = idx === -1 ? "" : cur.slice(0, idx);
      }
      return next;
    });
  }, []);

  const submitDialog = useCallback(async () => {
    if (!dialog || dialogBusy) return;
    const { mode, target, isDir } = dialog;

    if (mode === "delete") {
      setDialogBusy(true);
      const r = await callFsApi("/api/file/delete", { path: target });
      setDialogBusy(false);
      if (!r.ok) {
        setNotice({ ok: false, text: r.message ?? "删除失败" });
        closeDialog();
        return;
      }
      // 操作对象为当前选中文件时：删除 → 清除选中
      syncSelectionAfter(target, null);
      setNotice({ ok: true, text: `已删除「${dialog.initial}」` });
      closeDialog();
      router.refresh();
      return;
    }

    const name = dialogValue.trim();
    const validationError = validateName(name, mode);
    if (validationError) {
      setDialogError(validationError);
      return;
    }

    setDialogBusy(true);
    if (mode === "createFile") {
      const r = await callFsApi("/api/file/create", {
        dir: target,
        name,
      });
      setDialogBusy(false);
      if (!r.ok) {
        setDialogError(r.message ?? "新建文件失败");
        return;
      }
      // 成功后刷新文件树，并自动选中新文件
      expandDir(target);
      setNotice({ ok: true, text: `已新建文件「${name}」` });
      closeDialog();
      updateSelectedInUrl(r.path ?? null);
      router.refresh();
      return;
    }
    if (mode === "createDir") {
      const r = await callFsApi("/api/file/mkdir", { dir: target, name });
      setDialogBusy(false);
      if (!r.ok) {
        setDialogError(r.message ?? "新建文件夹失败");
        return;
      }
      // 展开新建文件夹的完整路径（含多级目录），父级与自身都展开
      expandDir(r.path ?? target);
      setNotice({ ok: true, text: `已新建文件夹「${name}」` });
      closeDialog();
      router.refresh();
      return;
    }
    // rename
    const r = await callFsApi("/api/file/rename", { path: target, name });
    setDialogBusy(false);
    if (!r.ok) {
      setDialogError(r.message ?? "重命名失败");
      return;
    }
    expandDir(r.path ? r.path.split("/").slice(0, -1).join("/") : "");
    // 操作对象为当前选中文件时：重命名 → 更新为新路径
    syncSelectionAfter(target, r.path ?? null);
    setNotice({ ok: true, text: `已重命名为「${name}」` });
    closeDialog();
    router.refresh();
  }, [
    callFsApi,
    closeDialog,
    dialog,
    dialogBusy,
    dialogValue,
    expandDir,
    router,
    syncSelectionAfter,
    updateSelectedInUrl,
  ]);

  // ---------- 渲染 ----------

  const empty = useMemo(
    () => !tree || (tree.files.length === 0 && tree.dirs.length === 0),
    [tree],
  );

  // 菜单定位：基于锚点元素
  const menuStyle = useMemo(() => {
    if (!menu) return {};
    const rect = menu.anchor.getBoundingClientRect();
    return {
      top: `${Math.round(rect.bottom + 4)}px`,
      left: `${Math.round(rect.right - 140)}px`,
    };
  }, [menu]);

  const dialogTitles: Record<DialogState["mode"], string> = {
    createFile: "新建文件",
    createDir: "新建文件夹",
    rename: "重命名",
    delete: "删除确认",
  };

  return (
    <aside
      className={`flex w-72 shrink-0 flex-col border-r border-zinc-200 bg-white ${
        pending ? "opacity-60" : ""
      }`}
    >
      {/* 顶部：workspace 选择器（系统文件夹选择式交互） */}
      <div className="shrink-0 border-b border-zinc-100 px-3 py-2">
        <button
          type="button"
          onClick={pickFolder}
          aria-label="选择 workspace 文件夹"
          title="点击选择 workspace 文件夹"
          className="flex w-full items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-left text-sm text-zinc-700 transition-colors hover:border-blue-300 hover:bg-blue-50"
        >
          <FolderIcon className="h-4 w-4 shrink-0 text-zinc-400" />
          <span className="min-w-0 flex-1 truncate">{activeWs}</span>
          <span className="shrink-0 text-xs text-zinc-400">
            {registering ? "识别中…" : "选择…"}
          </span>
        </button>
        {pickError ? (
          <p className="mt-1 rounded-md bg-red-50 px-2 py-1 text-xs text-red-600">
            {pickError}
          </p>
        ) : null}
      </div>

      {/* 根目录标题栏：requirements/ + 新建入口 */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-100 px-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          requirements/
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="在根目录新建文件"
            title="在根目录新建文件"
            onClick={() => {
              setDialog({ mode: "createFile", target: "", isDir: false, initial: "" });
              setDialogValue("");
              setDialogError("");
            }}
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M14 3v4a1 1 0 0 0 1 1h4" />
              <path d="M5 8V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-1" />
              <path d="M3 12h8M7 10v4" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="在根目录新建文件夹"
            title="在根目录新建文件夹"
            onClick={() => {
              setDialog({ mode: "createDir", target: "", isDir: false, initial: "" });
              setDialogValue("");
              setDialogError("");
            }}
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
              <path d="M12 11v5M9.5 13.5h5" />
            </svg>
          </button>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-2">
        {missingRequirements ? (
          <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
            缺少 requirements 文件夹
          </p>
        ) : empty ? (
          <p className="px-2 py-4 text-sm text-zinc-400">暂无文件</p>
        ) : (
          tree && (
            <ul>
              {/* 根目录下的文件（树形渲染，含展开/收起与菜单） */}
              {tree.files.map((f) => (
                <li key={f.path}>
                  <div
                    className={`group flex items-center gap-1 rounded-md pr-1 text-sm transition-colors ${
                      selected === f.path ? "bg-blue-50" : "hover:bg-zinc-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onPick(f.path)}
                      aria-current={selected === f.path ? "true" : undefined}
                      className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1.5 pl-1 pr-1 text-left ${
                        selected === f.path
                          ? "font-medium text-blue-700"
                          : "text-zinc-700"
                      }`}
                      data-tree-file={f.path}
                    >
                      <FileIcon
                        className={`h-3.5 w-3.5 shrink-0 ${
                          selected === f.path ? "text-blue-500" : "text-zinc-400"
                        }`}
                      />
                      <span className="truncate">{f.name}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`${f.name} 的操作菜单`}
                      title="更多操作"
                      onClick={(e) => {
                        e.stopPropagation();
                        openMenu(
                          {
                            dirPath: "",
                            filePath: f.path,
                            name: f.name,
                            isRoot: false,
                          },
                          e.currentTarget,
                        );
                      }}
                      className="invisible rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 group-hover:visible"
                    >
                      <MoreIcon />
                    </button>
                  </div>
                </li>
              ))}
              {tree.dirs.map((d) => (
                <TreeRow
                  key={d.dirPath}
                  node={d}
                  depth={1}
                  expanded={expanded}
                  selected={selected}
                  onToggle={(dirPath) =>
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(dirPath)) next.delete(dirPath);
                      else next.add(dirPath);
                      return next;
                    })
                  }
                  onPick={onPick}
                  onMenu={openMenu}
                />
              ))}
            </ul>
          )
        )}
        {fallbackHint ? (
          <p className="mt-3 truncate rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
            未找到：{fallbackHint}
          </p>
        ) : null}
      </nav>

      {/* 操作提示条 */}
      {notice ? (
        <div className="shrink-0 border-t border-zinc-100 p-2">
          <div
            role="status"
            className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-xs ${
              notice.ok
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-600"
            }`}
          >
            <span className="min-w-0 flex-1 break-words">{notice.text}</span>
            <button
              type="button"
              aria-label="关闭提示"
              onClick={() => setNotice(null)}
              className="shrink-0 rounded p-0.5 hover:opacity-70"
            >
              <svg
                className="h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {/* 点点点菜单（fixed 定位，挂在 body 层级） */}
      {menu ? (
        <div
          ref={menuRef}
          className="fixed z-50 w-36 rounded-md border border-zinc-200 bg-white py-1 shadow-lg"
          style={menuStyle}
          role="menu"
        >
          {menu.filePath === null ? (
            // 文件夹菜单（根目录标题栏入口不走到这里）
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => runMenuAction("createFile")}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100"
              >
                新建文件
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runMenuAction("createDir")}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100"
              >
                新建文件夹
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runMenuAction("rename")}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100"
              >
                重命名
              </button>
              <div className="my-1 border-t border-zinc-100" />
              <button
                type="button"
                role="menuitem"
                onClick={() => runMenuAction("delete")}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
              >
                删除
              </button>
            </>
          ) : (
            // 文件菜单
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => runMenuAction("rename")}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100"
              >
                重命名
              </button>
              <div className="my-1 border-t border-zinc-100" />
              <button
                type="button"
                role="menuitem"
                onClick={() => runMenuAction("delete")}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
              >
                删除
              </button>
            </>
          )}
        </div>
      ) : null}

      {/* 新建 / 重命名 / 删除确认 弹窗 */}
      {dialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={dialogTitles[dialog.mode]}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <div className="w-80 rounded-lg border border-zinc-200 bg-white p-4 shadow-xl">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900">
              {dialogTitles[dialog.mode]}
            </h3>

            {dialog.mode === "delete" ? (
              <p className="mb-4 text-sm text-zinc-600">
                {dialog.isDir
                  ? `删除文件夹「${dialog.initial}」？文件夹内的文件将一并删除。`
                  : `删除文件「${dialog.initial}」？`}
              </p>
            ) : (
              <div className="mb-4">
                <p className="mb-1.5 text-xs text-zinc-500">
                  {dialog.mode === "createFile" && "文件名"}
                  {dialog.mode === "createDir" &&
                    "文件夹名（可用 / 一次创建多级）"}
                  {dialog.mode === "rename" && "新名称"}
                </p>
                <input
                  ref={dialogInputRef}
                  value={dialogValue}
                  onChange={(e) => {
                    setDialogValue(e.target.value);
                    setDialogError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submitDialog();
                    if (e.key === "Escape") closeDialog();
                  }}
                  aria-label={
                    dialog.mode === "createFile"
                      ? "文件名"
                      : dialog.mode === "createDir"
                        ? "文件夹名"
                        : "新名称"
                  }
                  placeholder={
                    dialog.mode === "createFile"
                      ? "如 pages.md"
                      : dialog.mode === "createDir"
                        ? "如 components 或 a/b"
                        : "输入新名称"
                  }
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-blue-400"
                />
                {dialogError ? (
                  <p className="mt-1.5 text-xs text-red-600">{dialogError}</p>
                ) : null}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void submitDialog()}
                disabled={dialogBusy}
                className={`rounded-md px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  dialog.mode === "delete"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {dialogBusy
                  ? "处理中…"
                  : dialog.mode === "delete"
                    ? "删除"
                    : dialog.mode === "rename"
                      ? "重命名"
                      : "创建"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
