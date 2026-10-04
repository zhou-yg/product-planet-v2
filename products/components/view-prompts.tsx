"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WS_PARAM } from "@/lib/shared";

interface Props {
  /** 抽屉是否可见 */
  open: boolean;
  /** 关闭抽屉（关闭按钮 / 遮罩点击） */
  onClose: () => void;
  /** 当前文件路径（相对于 requirements/，抽屉标题用） */
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
 * view-prompts 抽屉组件（requirements/components/view-prompts.md）
 *
 * 抽屉里展示 <view-and-diff> 接口返回的内容。
 * - 顶部操作栏：复制（内容支持复制）
 * - 底部输入框：补充内容 + 发送任务（唤起 <agents /> 工具，创建任务）
 */
export default function ViewPrompts({
  open,
  onClose,
  docPath,
  content,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ws = searchParams.get(WS_PARAM) ?? "";

  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");
  const resetTimer = useRef<number | null>(null);

  // 底部输入框：补充内容 + 发送任务
  // （默认填上常用任务描述，用户可自由修改）
  const [supplement, setSupplement] = useState(
    "需求描述文件已更新，更新相关代码",
  );
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<
    { ok: boolean; text: string } | null
  >(null);
  const sendResultTimer = useRef<number | null>(null);

  // 抽屉重新打开或内容变化时，重置复制反馈
  useEffect(() => {
    setCopyState("idle");
  }, [open, content]);

  // 抽屉重新打开时，重置发送状态（保留草稿补充内容）
  useEffect(() => {
    if (open) {
      setSending(false);
      setSendResult(null);
    }
  }, [open]);

  // 抽屉打开时锁定页面滚动，Esc 关闭
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  // 卸载时清理反馈复位定时器
  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
      if (sendResultTimer.current !== null)
        window.clearTimeout(sendResultTimer.current);
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

  // 发送任务：唤起 <agents /> 工具，创建任务
  // （提示词内容 + 用户补充的内容，工作区为当前项目所在目录）
  const sendTask = useCallback(async () => {
    if (sending || !content) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/agents/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ws,
          prompt: supplement.trim()
            ? `${content.trimEnd()}\n\n${supplement.trim()}`
            : content,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message?: string;
        sessionId?: string;
      };
      if (!res.ok || !data.ok) {
        setSendResult({ ok: false, text: data.message ?? "发送任务失败" });
      } else {
        setSendResult({
          ok: true,
          text: data.sessionId
            ? `任务已创建（${data.sessionId}）`
            : "任务已创建",
        });
        setSupplement("");
      }
    } catch (err) {
      setSendResult({ ok: false, text: `发送任务失败：${String(err)}` });
    } finally {
      setSending(false);
      if (sendResultTimer.current !== null)
        window.clearTimeout(sendResultTimer.current);
      sendResultTimer.current = window.setTimeout(
        () => setSendResult(null),
        3000,
      );
    }
  }, [content, sending, supplement, ws]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="内容与差异"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部操作栏 */}
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

        {/* 内容区：<view-and-diff> 接口返回的内容 */}
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-xs leading-relaxed text-zinc-700">
          {content}
        </pre>

        {/* 底部输入框：补充内容 + 发送任务（唤起 agents 工具创建任务） */}
        <div className="shrink-0 border-t border-zinc-100 px-4 py-3">
          <textarea
            value={supplement}
            onChange={(e) => setSupplement(e.target.value)}
            placeholder="补充内容（可选，将随提示词一起发送）"
            aria-label="补充内容"
            rows={3}
            className="w-full resize-none rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-700 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-400"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span
              className={`truncate text-xs ${
                sendResult
                  ? sendResult.ok
                    ? "text-emerald-600"
                    : "text-red-600"
                  : "text-transparent"
              }`}
            >
              {sendResult ? sendResult.text : "-"}
            </span>
            <button
              type="button"
              onClick={sendTask}
              disabled={sending || !content}
              className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? "发送中…" : "发送任务"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
