"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { InjectDep, TreeNode } from "@/lib/shared";
import { FILE_PARAM, WS_PARAM } from "@/lib/shared";
import ViewPrompts from "@/components/view-prompts";
import InjectPicker from "@/components/inject-picker";

interface Props {
  deps: InjectDep[];
  hasDoc: boolean;
  /** Path of the currently selected file, used by the view-diff fetch */
  docPath: string;
  /** requirements 文件树（新增依赖选择器的数据源） */
  tree: TreeNode | null;
  /** 当前文件是否为 markdown（「新增」按钮仅对 md 文件展示） */
  isMd: boolean;
}

export default function DepsPanel({ deps, hasDoc, docPath, tree, isMd }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ws = searchParams.get(WS_PARAM) ?? "";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [content, setContent] = useState("");
  // 新增依赖选择器
  const [pickerOpen, setPickerOpen] = useState(false);

  const jump = (depPath: string) => {
    const params = new URLSearchParams();
    if (ws) params.set(WS_PARAM, ws);
    params.set(FILE_PARAM, depPath);
    router.push(`/?${params.toString()}`, {
      scroll: false,
    });
  };

  // Fetch view-and-diff content for the selected file, then open the dialog
  const fetchViewDiff = useCallback(async () => {
    setLoading(true);
    setError("");
    setContent("");
    try {
      const res = await fetch(
        `/api/view-diff?path=${encodeURIComponent(docPath)}${
          ws ? `&${WS_PARAM}=${encodeURIComponent(ws)}` : ""
        }`,
      );
      const data = (await res.json()) as {
        ok: boolean;
        content?: string;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "获取失败");
      } else {
        setContent(data.content ?? "");
        setOpen(true);
      }
    } catch (err) {
      setError(`获取失败：${String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [docPath, ws]);

  // 新增 inject 依赖：提交所选路径，成功后刷新页面让服务端重算依赖
  const addInjects = useCallback(
    async (
      paths: string[],
    ): Promise<{ ok: boolean; message?: string }> => {
      try {
        const res = await fetch("/api/file/inject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: docPath, deps: paths, ws }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          message?: string;
        };
        if (!res.ok || !data.ok) {
          return { ok: false, message: data.message ?? "新增依赖失败" };
        }
        router.refresh();
        return { ok: true };
      } catch (err) {
        return { ok: false, message: `新增依赖失败：${String(err)}` };
      }
    },
    [docPath, router, ws],
  );

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-zinc-200 bg-white">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-100 px-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          依赖
        </span>
        <div className="flex items-center gap-2">
          {hasDoc ? (
            <button
              type="button"
              onClick={fetchViewDiff}
              disabled={loading}
              className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "获取中…" : "获取"}
            </button>
          ) : null}
          {hasDoc ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
              {deps.length}
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mx-2 mt-2 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-600">
          {error}
        </p>
      ) : null}

      {/* View-prompts dialog: 展示 view-and-diff 接口返回的内容，支持复制 */}
      <ViewPrompts
        open={open}
        onClose={() => setOpen(false)}
        docPath={docPath}
        content={content}
      />

      {/* 文件树选择器：搜索 + 多选，确定后写入 meta inject */}
      <InjectPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        tree={tree}
        docPath={docPath}
        existing={deps.map((d) => d.path)}
        onConfirm={addInjects}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!hasDoc ? (
          <p className="px-2 py-4 text-sm text-zinc-400">未选择文件</p>
        ) : deps.length === 0 ? (
          <p className="px-2 py-4 text-sm text-zinc-400">
            当前文件未声明 inject 依赖
          </p>
        ) : (
          <ul className="space-y-1">
            {deps.map((dep, i) => (
              <li key={`${dep.path}-${i}`}>
                {dep.exists ? (
                  <button
                    type="button"
                    onClick={() => jump(dep.path)}
                    className="w-full rounded-md border border-zinc-200 px-3 py-2 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                  >
                    <p className="truncate text-sm font-medium text-blue-700">
                      {dep.name}
                    </p>
                    <p className="truncate font-mono text-xs text-zinc-400">
                      {dep.path}
                    </p>
                  </button>
                ) : (
                  <div
                    className="rounded-md border border-dashed border-zinc-300 px-3 py-2"
                    title="文件不存在"
                  >
                    <p className="truncate text-sm font-medium text-zinc-500">
                      {dep.name}
                    </p>
                    <p className="truncate font-mono text-xs text-zinc-400">
                      {dep.path}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 底部：新增 inject 依赖（仅 markdown 文件展示） */}
      {hasDoc && isMd ? (
        <div className="shrink-0 border-t border-zinc-100 p-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            新增
          </button>
        </div>
      ) : null}
    </aside>
  );
}
