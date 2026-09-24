"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { InjectDep } from "@/lib/shared";
import { FILE_PARAM, WS_PARAM } from "@/lib/shared";

interface Props {
  deps: InjectDep[];
  hasDoc: boolean;
  /** Path of the currently selected file, used by the view-diff fetch */
  docPath: string;
}

export default function DepsPanel({ deps, hasDoc, docPath }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ws = searchParams.get(WS_PARAM) ?? "";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [content, setContent] = useState("");

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

      {/* View-and-diff dialog */}
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
          role="dialog"
          aria-modal="true"
          aria-label="内容与差异"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-3">
              <span className="text-sm font-semibold text-zinc-900">
                内容与差异（{docPath}）
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
              >
                关闭
              </button>
            </div>
            <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-xs leading-relaxed text-zinc-700">
              {content}
            </pre>
          </div>
        </div>
      ) : null}
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
    </aside>
  );
}
