import MdEditor from "@/components/md-editor";
import type { MarkdownDoc } from "@/lib/fs";

interface Props {
  doc: MarkdownDoc | null;
  missing?: boolean;
}

/** Split content into (first H1 title, remaining body) */
function splitTitle(content: string): { title: string; body: string } {
  const m = content.match(/^#\s+(.+)\r?\n?/);
  if (!m) return { title: "", body: content };
  return { title: m[1].trim(), body: content.slice(m[0].length) };
}

export default function ContentPanel({ doc, missing }: Props) {
  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-zinc-50">
      {doc ? (
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="mb-6">
            <p className="mb-2 font-mono text-xs text-zinc-400">
              requirements/{doc.path}
            </p>
            <h2 className="text-2xl font-bold text-zinc-900">{doc.name}</h2>
            {Object.keys(doc.meta).length > 0 ? (
              <p className="mt-2 text-xs text-zinc-400">
                meta:{" "}
                {Object.entries(doc.meta)
                  .map(([k, v]) => {
                    if (Array.isArray(v)) return `${k}: [${v.length} 项]`;
                    return `${k}: ${JSON.stringify(v)}`;
                  })
                  .join(" · ")}
              </p>
            ) : null}
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-2 shadow-sm">
            <MdEditor
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
