"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  /** Active workspace name (passed to the sync API) */
  ws: string;
}

/**
 * "同步至AGENTS.md" button: calls POST /api/sync-agents,
 * which concatenates all requirements md files into the workspace AGENTS.md.
 */
export default function SyncAgentsButton({ ws }: Props) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sync = async () => {
    if (syncing) return;
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sync-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ws }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message?: string;
        count?: number;
      };
      if (!res.ok || !data.ok) {
        setMessage(data.message ?? "同步失败");
      } else {
        setMessage(`同步成功（${data.count ?? 0} 个文件）`);
        router.refresh();
      }
    } catch (err) {
      setMessage(`同步失败：${String(err)}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {message ? (
        <span className="text-xs text-zinc-500">{message}</span>
      ) : null}
      <button
        type="button"
        onClick={sync}
        disabled={syncing}
        className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {syncing ? "同步中…" : "同步至AGENTS.md"}
      </button>
    </div>
  );
}
