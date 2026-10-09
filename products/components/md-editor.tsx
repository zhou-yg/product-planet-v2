"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  frontmatterPlugin,
  jsxPlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  UndoRedo,
  ListsToggle,
  CreateLink,
  InsertThematicBreak,
  GenericJsxEditor,
} from "@mdxeditor/editor";
import type { MDXEditorMethods } from "@mdxeditor/editor";
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
 * Any JSX-looking tag is accepted and round-trips byte-preserved.
 * kind:"flow" + hasChildren covers both flow and inline tags
 * (kind mismatches are resolved by the "source" policy, i.e. kept as-is).
 */
const jsxComponentDescriptors = [
  { name: "*" as const, kind: "flow" as const, props: [], hasChildren: true, Editor: GenericJsxEditor },
];

/** Escape "<" before tag-like constructs so they parse as plain text (fallback only). */
function escapeRawLt(md: string): string {
  return md.replace(/(?<!\\)<(?=[A-Za-z!/])/g, "\\<");
}

/**
 * Markdown editor based on mdxeditor with a save button.
 * Saving posts the latest content to /api/file/write.
 */
export default function MdEditor({ title, markdown, fileKey }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ws = searchParams.get("ws") ?? "";
  const editorRef = useRef<MDXEditorMethods>(null);
  const contentRef = useRef(markdown);
  const [titleValue, setTitleValue] = useState(title);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [parseError, setParseError] = useState<string | null>(null);
  // True when the fallback (escaped "<") reload succeeded: content is editable
  // and savable, but the editor gives back escaped "\<" that must be restored.
  const [fallbackReady, setFallbackReady] = useState(false);

  // When the document cannot be parsed (e.g. an unclosed tag), the editor
  // drops the content and mutes onChange. Retry once with escaped "<" so the
  // document stays visible and editable as plain text.
  const handleError = useCallback(
    (payload: { error: string; source: string }) => {
      // The initial import trims the source; the escaped retry does not, so
      // compare trimmed on both sides (escapeRawLt preserves whitespace).
      const expectedFallbackSource = escapeRawLt(markdown.trim());
      if (payload.source.trim() === expectedFallbackSource) {
        // The escaped retry failed too: genuinely unparseable, keep save blocked.
        setFallbackReady(false);
        return;
      }
      setParseError(payload.error);
      setFallbackReady(true);
      editorRef.current?.setMarkdown(escapeRawLt(markdown));
    },
    [markdown],
  );

  const save = useCallback(async () => {
    if (saving || (parseError !== null && !fallbackReady)) return;
    setSaving(true);
    setMessage(null);
    try {
      // Merge title (first H1) and body back into a single markdown document.
      // Restore "<" escaped by the parse-failure fallback before saving.
      let body = contentRef.current.replace(/^\s+/, "");
      if (fallbackReady) body = body.replace(/\\</g, "<");
      const merged = `# ${titleValue.trim() || "未命名"}\n\n${body}`;
      const res = await fetch("/api/file/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: fileKey, content: merged, ws }),
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
  }, [fileKey, fallbackReady, parseError, router, saving, titleValue, ws]);

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
          {parseError && !fallbackReady ? (
            <span
              className="max-w-xs truncate text-xs text-red-600"
              title={parseError}
            >
              文档解析失败，无法编辑
            </span>
          ) : parseError ? (
            <span
              className="max-w-xs truncate text-xs text-amber-600"
              title={parseError}
            >
              原文含未闭合标签，已转义显示
            </span>
          ) : message ? (
            <span
              className={`text-xs ${message.ok ? "text-emerald-600" : "text-red-600"}`}
            >
              {message.text}
            </span>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={saving || (parseError !== null && !fallbackReady)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
      <MDXEditor
        key={fileKey}
        ref={editorRef}
        markdown={markdown}
        onError={handleError}
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
          jsxPlugin({ jsxComponentDescriptors }),
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
