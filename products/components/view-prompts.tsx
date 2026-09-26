"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  /** 弹框是否可见 */
  open: boolean;
  /** 关闭弹框（关闭按钮 / 遮罩点击） */
  onClose: () => void;
  /** 当前文件路径（相对于 requirements/，弹框标题用） */
  docPath: string;
  /** <view-and-diff> 接口返回的内容 */
  content: string;
}

/** 复制文本到剪贴板；非安全上下文等场景回退到 execCommand */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * view-prompts 弹框组件（requirements/components/view-prompts.md）
 *
 * 弹框里展示 <view-and-diff> 接口返回的内容，内容支持复制。
 */
export default function ViewPrompts({
  open,
  onClose,
  docPath,
  content,
}: Props) {
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");
  const resetTimer = useRef<number | null>(null);

  // 弹框重新打开或内容变化时，重置复制反馈
  useEffect(() => {
    setCopyState("idle");
  }, [open, content]);

  // 卸载时清理反馈复位定时器
  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    };
  }, []);

  const copy = useCallback(async () => {
    if (!content) return;
    const ok = await copyToClipboard(content);
    setCopyState(ok ? "ok" : "fail");
    if (ok) {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopyState("idle"), 1500);
    }
  }, [content]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="内容与差异"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
          <span className="truncate text-sm font-semibold text-zinc-900">
            内容与差异（{docPath}）
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={copy}
              disabled={!content}
              className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copyState === "ok"
                ? "已复制"
                : copyState === "fail"
                  ? "复制失败"
                  : "复制"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100"
            >
              关闭
            </button>
          </div>
        </div>
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-xs leading-relaxed text-zinc-700">
          {content}
        </pre>
      </div>
    </div>
  );
}
