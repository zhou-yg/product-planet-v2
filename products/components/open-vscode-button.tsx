"use client";

import { useState } from "react";

interface Props {
  /** active workspace name passed to the open-vscode API */
  ws: string;
}

/**
 * Button in the top header bar that opens the current workspace in VSCode
 * by calling POST /api/workspace/open-vscode.
 */
export default function OpenVscodeButton({ ws }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/workspace/open-vscode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ws }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "VSCode 打开失败");
      }
    } catch {
      setError("VSCode 打开失败：网络错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error ? <span className="text-xs text-red-500">{error}</span> : null}
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "打开中..." : "VSCode打开"}
      </button>
    </div>
  );
}
