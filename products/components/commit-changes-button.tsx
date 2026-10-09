"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GitChange, GitChangeStatus } from "@/lib/shared";
import { GIT_CHANGE_STATUS_LABELS } from "@/lib/shared";
import { buildChangeTree, type ChangeTreeNode } from "@/lib/shared";

interface Props {
  /** active workspace name (passed to the changes / agents task APIs) */
  ws: string;
  /** 服务端预取的初始变更（首次渲染即有正确的 enable 态与数字） */
  initialChanges: GitChange[];
  /** workspace 是否为 git 仓库（false 时按钮置灰、提示不可提交） */
  isGit: boolean;
}

/** 变更状态的徽标配色 */
const STATUS_STYLES: Record<GitChangeStatus, string> = {
  added: "bg-emerald-50 text-emerald-700",
  modified: "bg-amber-50 text-amber-700",
  deleted: "bg-red-50 text-red-700",
};

/** 变更文件树节点行（递归渲染：目录 → 变更文件） */
function ChangeRow({
  node,
  depth,
}: {
  node: ChangeTreeNode;
  depth: number;
}) {
  return (
    <>
      {node.dirs.map((dir) => (
        <div key={dir.name}>
          <div
            className="flex items-center gap-1 py-0.5 font-medium text-zinc-600"
            style={{ paddingLeft: `${depth * 12}px` }}
            data-change-dir={dir.name}
          >
            <svg
              className="h-3 w-3 shrink-0 text-zinc-400"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />
            </svg>
            <span className="truncate text-xs">{dir.name}</span>
          </div>
          <ChangeRow node={dir} depth={depth + 1} />
        </div>
      ))}
      {node.files.map((file) => (
        <div
          key={file.name}
          className="flex items-center gap-1.5 py-0.5"
          style={{ paddingLeft: `${depth * 12 + 16}px` }}
          data-change-file={file.name}
        >
          <svg
            className="h-3 w-3 shrink-0 text-zinc-400"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5L13 3.5Z" />
          </svg>
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-700">
            {file.name}
          </span>
          <span
            className={`shrink-0 rounded px-1 py-px text-[10px] ${STATUS_STYLES[file.status]}`}
          >
            {GIT_CHANGE_STATUS_LABELS[file.status]}
          </span>
        </div>
      ))}
    </>
  );
}

/**
 * Top-bar「提交变更 + 文件改动数字」按钮（requirements/pages/home/top.md）
 *
 * - 有变更时才 enable（无变更 / 非 git 仓库时置灰）
 * - hover 数字（或按钮）时 popover 展示被改动的文件树
 * - 点击提交时调用 <agents> 工具创建提交任务，让 agents 自己总结改动并 commit
 */
export default function CommitChangesButton({
  ws,
  initialChanges,
  isGit,
}: Props) {
  const [changes, setChanges] = useState<GitChange[]>(initialChanges);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const noticeTimer = useRef<number | null>(null);
  // 延迟关闭定时器：移出按钮/popover 后的宽限期，期间移入可取消关闭
  const closeTimer = useRef<number | null>(null);

  const hasChanges = isGit && changes.length > 0;

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const openPopover = useCallback(() => {
    clearCloseTimer();
    setPopoverOpen(true);
  }, [clearCloseTimer]);

  // 移出按钮 / popover：延迟关闭，宽限期内移回可取消
  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => {
      setPopoverOpen(false);
      closeTimer.current = null;
    }, 200);
  }, [clearCloseTimer]);

  // 卸载时清理定时器
  useEffect(() => {
    return () => {
      clearCloseTimer();
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    };
  }, [clearCloseTimer]);

  // workspace 切换后重新拉取变更（props 变化仅用于初次/切换）
  useEffect(() => {
    setChanges(initialChanges);
  }, [initialChanges]);

  // 提交成功 / 文件树操作后刷新变更列表（router.refresh 会重渲染整页）
  const refreshChanges = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/workspace/changes?ws=${encodeURIComponent(ws)}`,
      );
      const data = (await res.json()) as {
        ok: boolean;
        isGit?: boolean;
        changes?: GitChange[];
      };
      if (res.ok && data.ok) setChanges(data.changes ?? []);
    } catch {
      // 刷新失败保持现有列表
    }
  }, [ws]);

  // Esc 关闭 popover
  useEffect(() => {
    if (!popoverOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearCloseTimer();
        setPopoverOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [popoverOpen, clearCloseTimer]);

  // 卸载时清理提示定时器
  useEffect(() => {
    return () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    };
  }, []);

  // 点击提交：调用 <agents> 工具创建提交任务（让 agents 自己总结改动并 commit）
  const commit = useCallback(async () => {
    if (committing || !hasChanges) return;
    setCommitting(true);
    setNotice(null);
    try {
      const fileList = changes
        .map((c) => `- ${GIT_CHANGE_STATUS_LABELS[c.status]}：${c.path}`)
        .join("\n");
      const prompt = [
        "请提交当前的文件变更（git commit）。",
        "",
        "要求：",
        "1. 使用 git 命令把当前全部未提交的变更（含未跟踪文件）加入本次 commit",
        "2. 查看变更内容（如 git diff / git status），自己总结出本次改动，写出合适的 commit message",
        "3. 完成 commit 后，简单说明你总结的 commit message",
        "",
        "当前未提交的变更文件（git status）：",
        fileList,
      ].join("\n");
      const res = await fetch("/api/agents/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ws, prompt }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message?: string;
        sessionId?: string;
      };
      if (!res.ok || !data.ok) {
        setNotice({ ok: false, text: data.message ?? "提交任务创建失败" });
      } else {
        setNotice({
          ok: true,
          text: data.sessionId
            ? `已创建提交任务（${data.sessionId.slice(0, 8)}…）`
            : "已创建提交任务",
        });
        // 任务创建成功后收起 popover，稍后刷新变更
        setPopoverOpen(false);
        void refreshChanges();
      }
    } catch (err) {
      setNotice({ ok: false, text: `提交任务创建失败：${String(err)}` });
    } finally {
      setCommitting(false);
      if (noticeTimer.current !== null)
        window.clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(() => setNotice(null), 4000);
    }
  }, [changes, committing, hasChanges, refreshChanges, ws]);

  const changeTree = hasChanges ? buildChangeTree(ws, changes.map((c) => c.path)) : null;

  return (
    <div ref={wrapRef} className="relative flex items-center gap-2">
      {notice ? (
        <span
          className={`max-w-[240px] truncate text-xs ${
            notice.ok ? "text-emerald-600" : "text-red-600"
          }`}
          title={notice.text}
        >
          {notice.text}
        </span>
      ) : null}
      <button
        type="button"
        onClick={commit}
        onMouseEnter={() => hasChanges && openPopover()}
        onMouseLeave={scheduleClose}
        disabled={!hasChanges || committing}
        aria-label={
          hasChanges ? `提交变更（${changes.length} 个文件改动）` : "提交变更"
        }
        data-testid="commit-changes"
        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
          hasChanges
            ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
            : "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400"
        } disabled:cursor-not-allowed`}
      >
        {committing ? "提交中…" : "提交变更"}
        <span
          className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
            hasChanges ? "bg-blue-600 text-white" : "bg-zinc-300 text-zinc-500"
          }`}
          data-testid="changes-count"
        >
          {isGit ? changes.length : 0}
        </span>
      </button>

      {/* popover：被改动的文件树（hover 数字时展示；与按钮间无缝衔接，可移入查看） */}
      {popoverOpen && changeTree ? (
        <div
          ref={popoverRef}
          role="tooltip"
          data-testid="changes-popover"
          className="absolute right-0 top-full z-50 w-80 pt-1.5"
          onMouseEnter={openPopover}
          onMouseLeave={scheduleClose}
        >
          <div className="rounded-md border border-zinc-200 bg-white p-2 shadow-lg">
            <p className="mb-1 px-1 text-xs font-semibold text-zinc-500">
              改动的文件（{changes.length}）
            </p>
            <div className="max-h-64 overflow-y-auto">
              <ChangeRow node={changeTree} depth={0} />
            </div>
            <div className="mt-1.5 flex justify-end border-t border-zinc-100 pt-1.5">
              <button
                type="button"
                onClick={() => {
                  clearCloseTimer();
                  void commit();
                }}
                disabled={committing}
                className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {committing ? "提交中…" : "提交变更"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
