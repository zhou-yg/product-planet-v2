import FileTree from "@/components/file-tree";
import ContentPanel from "@/components/content-panel";
import DepsPanel from "@/components/deps-panel";
import {
  buildTree,
  readDoc,
  defaultFile,
  resolveInject,
} from "@/lib/fs";
import { FILE_PARAM } from "@/lib/shared";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = params[FILE_PARAM];
  const selected = (Array.isArray(raw) ? raw[0] : raw) ?? "";

  const tree = await buildTree();
  const fallback = selected ? null : await defaultFile();
  const target = selected || fallback || "";
  const doc = target ? await readDoc(target) : null;
  const deps = doc ? await resolveInject(doc.meta) : [];

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4">
        <h1 className="text-sm font-semibold text-zinc-900">产品星球 2.0</h1>
        <span className="text-xs text-zinc-500">Markdown 管理平台</span>
      </header>
      <div className="flex min-h-0 flex-1">
        {/* 左：文件树 */}
        <FileTree
          tree={tree}
          selected={doc ? doc.path : ""}
          fallbackHint={!doc && target ? target : ""}
        />
        {/* 中：文件内容 */}
        <ContentPanel doc={doc} missing={!doc && !!target} />
        {/* 右：依赖列表 */}
        <DepsPanel deps={deps} hasDoc={!!doc} />
      </div>
    </div>
  );
}
