"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  frontmatterPlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  UndoRedo,
  ListsToggle,
  CreateLink,
  InsertThematicBreak,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";

interface Props {
  /** initial title extracted from the first H1 of the document */
  title: string;
  /** initial markdown body (title line stripped) */
  markdown: string;
  /** file path, used as save target and change key */
  fileKey: string;
}

/**
 * Markdown editor based on mdxeditor with a save button.
 * Saving posts the latest content to /api/file/write.
 */
export default function MdEditor({ title, markdown, fileKey }: Props) {
  const router = useRouter();
  const contentRef = useRef(markdown);
  const [titleValue, setTitleValue] = useState(title);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    try {
      // Merge title (first H1) and body back into a single markdown document
      const merged = `# ${titleValue.trim() || "未命名"}\n\n${contentRef.current.replace(/^\s+/, "")}`;
      const res = await fetch("/api/file/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: fileKey, content: merged }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setMessage({ ok: false, text: data.message ?? "保存失败" });
      } else {
        setMessage({ ok: true, text: "保存成功" });
        router.refresh();
      }
    } catch (err) {
      setMessage({ ok: false, text: `保存失败：${String(err)}` });
    } finally {
      setSaving(false);
    }
  }, [fileKey, router, saving, titleValue]);

  // Cmd/Ctrl + S triggers save
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  return (
    <div className="md-editor-wrap">
      {/* Title input and save button on the same row */}
      <div className="mb-2 flex items-center gap-3">
        <input
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          placeholder="文档标题"
          aria-label="文档标题"
          className="min-w-0 flex-1 rounded-md border border-zinc-200 px-3 py-2 text-lg font-semibold text-zinc-900 outline-none transition-colors focus:border-blue-400"
        />
        <div className="flex shrink-0 items-center gap-3">
          {message ? (
            <span
              className={`text-xs ${message.ok ? "text-emerald-600" : "text-red-600"}`}
            >
              {message.text}
            </span>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
      <MDXEditor
        key={fileKey}
        markdown={markdown}
        onChange={(value) => {
          contentRef.current = value;
        }}
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          markdownShortcutPlugin(),
          frontmatterPlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <BoldItalicUnderlineToggles />
                <ListsToggle />
                <CreateLink />
                <InsertThematicBreak />
              </>
            ),
          }),
        ]}
      />
    </div>
  );
}
