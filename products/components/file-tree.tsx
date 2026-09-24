"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
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

/** 目录分组渲染（保留树形结构，默认展开） */
function DirGroup({
  node,
  selected,
  onPick,
}: {
  node: TreeNode;
  selected: string;
  onPick: (path: string) => void;
}) {
  return (
    <li>
      <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-zinc-500">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />
        </svg>
        <span>{node.name}/</span>
      </div>
      <ul className="ml-3 border-l border-zinc-200 pl-2">
        {node.files.map((f: FileNode) => (
          <li key={f.path}>
            <button
              type="button"
              onClick={() => onPick(f.path)}
              aria-current={selected === f.path ? "true" : undefined}
              className={`group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                selected === f.path
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <svg
                className={`h-3.5 w-3.5 shrink-0 ${
                  selected === f.path ? "text-blue-500" : "text-zinc-400"
                }`}
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5L13 3.5Z" />
              </svg>
              <span className="truncate">{f.name}</span>
            </button>
          </li>
        ))}
        {node.dirs.map((d: TreeNode) => (
          <DirGroup key={d.dirPath} node={d} selected={selected} onPick={onPick} />
        ))}
      </ul>
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
  // The picked folder's name is matched against server-known workspaces.
  const [pickError, setPickError] = useState("");
  const pickFolder = useCallback(async () => {
    setPickError("");
    const w = window as WindowWithDirPicker;
    if (typeof w.showDirectoryPicker === "function") {
      try {
        const handle = await w.showDirectoryPicker({ mode: "read" });
        const matched = workspaces.find((ws) => ws.name === handle.name);
        if (!matched) {
          setPickError(
            `未找到名为「${handle.name}」的 workspace（需位于服务端 workspace 目录下且含 requirements 文件夹）`,
          );
          return;
        }
        onSwitchWs(handle.name);
      } catch (err) {
        if ((err as DOMException)?.name !== "AbortError") {
          setPickError(`选择文件夹失败：${String(err)}`);
        }
      }
      return;
    }
    // Fallback: <input type="file" webkitdirectory> also hides the full path,
    // so use the first entry's relative path prefix as the folder name.
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
      const matched = workspaces.find((ws) => ws.name === folder);
      if (!matched) {
        setPickError(
          `未找到名为「${folder}」的 workspace（需位于服务端 workspace 目录下且含 requirements 文件夹）`,
        );
        return;
      }
      onSwitchWs(folder);
    };
    input.click();
  }, [onSwitchWs, workspaces]);

  const empty = useMemo(
    () => !tree || (tree.files.length === 0 && tree.dirs.length === 0),
    [tree],
  );

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
          <svg
            className="h-4 w-4 shrink-0 text-zinc-400"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />
          </svg>
          <span className="min-w-0 flex-1 truncate">{activeWs}</span>
          <span className="shrink-0 text-xs text-zinc-400">选择…</span>
        </button>
        {pickError ? (
          <p className="mt-1 rounded-md bg-red-50 px-2 py-1 text-xs text-red-600">
            {pickError}
          </p>
        ) : null}
      </div>
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-100 px-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          文件
        </span>
        <span className="text-xs text-zinc-400">requirements/</span>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto p-2">
        {missingRequirements ? (
          <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
            缺少 requirements 文件夹
          </p>
        ) : empty ? (
          <p className="px-2 py-4 text-sm text-zinc-400">暂无 markdown 文件</p>
        ) : (
          tree && (
            <ul>
              {tree.files.map((f) => (
                <li key={f.path}>
                  <button
                    type="button"
                    onClick={() => onPick(f.path)}
                    aria-current={selected === f.path ? "true" : undefined}
                    className={`group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      selected === f.path
                        ? "bg-blue-50 font-medium text-blue-700"
                        : "text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    <svg
                      className={`h-3.5 w-3.5 shrink-0 ${
                        selected === f.path ? "text-blue-500" : "text-zinc-400"
                      }`}
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5L13 3.5Z" />
                    </svg>
                    <span className="truncate">{f.name}</span>
                  </button>
                </li>
              ))}
              {tree.dirs.map((d) => (
                <DirGroup key={d.dirPath} node={d} selected={selected} onPick={onPick} />
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
    </aside>
  );
}
