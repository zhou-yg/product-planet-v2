import MdEditor from "@/components/md-editor";
import type { MarkdownDoc } from "@/lib/fs";

interface Props {
  doc: MarkdownDoc | null;
  missing?: boolean;
}

/**
 * Split content into (first H1 title, remaining body).
 * JSX-style tags (e.g. <md-editor>) break mdxeditor's markdown parser,
 * so they are escaped into HTML entities for rendering. The editor's
 * onChange gives back the markdown source where entities stay escaped,
 * which is acceptable: saving converts them back via the write API input.
 */
function splitTitle(content: string): { title: string; body: string } {
  // Trim leading whitespace (frontmatter stripping often leaves a leading newline)
  const trimmed = content.replace(/^[^\S\r\n]*\r?\n+/, "");
  const m = trimmed.match(/^#\s+(.+)\r?\n?/);
  const rawTitle = m ? m[1].trim() : "";
  const rest = m ? trimmed.slice(m[0].length) : trimmed;
  // Escape < and > so JSX-ish tags render as plain text (built via char codes
  // to avoid tooling unescaping HTML entities back into raw angle brackets)
  const LT = "&" + "lt;";
  const GT = "&" + "gt;";
  const body = rest.replace(/</g, LT).replace(/>/g, GT);
  return { title: rawTitle, body };
}

export default function ContentPanel({ doc, missing }: Props) {
  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-zinc-50">
      {doc ? (
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-2 shadow-sm">
            <MdEditor
              key={doc.path}
              markdown={splitTitle(doc.content).body}
              title={splitTitle(doc.content).title}
              fileKey={doc.path}
            />
          </div>
        </div>
      ) : missing ? (
        <div className="mx-auto max-w-3xl px-8 py-8">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            未找到选中的文件，请从左侧文件树选择。
          </p>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-zinc-400">从左侧选择一个文件查看内容</p>
        </div>
      )}
    </main>
  );
}
