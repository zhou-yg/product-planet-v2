"use client";

import { useRouter } from "next/navigation";
import type { InjectDep } from "@/lib/shared";
import { FILE_PARAM } from "@/lib/shared";

interface Props {
  deps: InjectDep[];
  hasDoc: boolean;
}

export default function DepsPanel({ deps, hasDoc }: Props) {
  const router = useRouter();

  const jump = (depPath: string) => {
    router.push(`/?${FILE_PARAM}=${encodeURIComponent(depPath)}`, {
      scroll: false,
    });
  };

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-zinc-200 bg-white">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-100 px-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          依赖
        </span>
        {hasDoc ? (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
            {deps.length}
          </span>
        ) : null}
      </div>
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
