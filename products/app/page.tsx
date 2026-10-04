import FileTree from "@/components/file-tree";
import ContentPanel from "@/components/content-panel";
import DepsPanel from "@/components/deps-panel";
import OpenVscodeButton from "@/components/open-vscode-button";
import {
  buildTree,
  readFileContent,
  defaultFile,
  resolveInject,
  resolveWorkspaceDir,
  workspaceHasRequirements,
  listWorkspaces,
  DEFAULT_WORKSPACE,
} from "@/lib/fs";
import { FILE_PARAM, WS_PARAM } from "@/lib/shared";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const raw = params[key];
  return (Array.isArray(raw) ? raw[0] : raw) ?? "";
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const wsName = firstParam(params, WS_PARAM);
  const selected = firstParam(params, FILE_PARAM);

  // Resolve workspace: fall back to the default when missing/invalid
  const wsDir = resolveWorkspaceDir(wsName) ?? resolveWorkspaceDir(DEFAULT_WORKSPACE);
  const activeWs = wsDir ? wsDir.split("/").pop()! : DEFAULT_WORKSPACE;

  const workspaces = await listWorkspaces();
  const hasRequirements = wsDir ? workspaceHasRequirements(wsDir) : false;

  // Tree / doc / deps are only available when requirements/ exists
  const tree = hasRequirements && wsDir ? await buildTree(wsDir) : null;
  const fallback =
    hasRequirements && wsDir && !selected ? await defaultFile(wsDir) : "";
  const target = selected || fallback || "";
  const doc =
    hasRequirements && wsDir && target
      ? await readFileContent(wsDir, target)
      : null;
  const deps = wsDir && doc ? await resolveInject(wsDir, doc.meta) : [];

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4">
        <h1 className="text-sm font-semibold text-zinc-900">产品星球 2.0</h1>
        <OpenVscodeButton ws={activeWs} />
      </header>
      <div className="flex min-h-0 flex-1 gap-[10px]">
        {/* 左：workspace 选择器 + 文件树管理器 */}
        <FileTree
          tree={tree}
          selected={selected || (doc ? doc.path : "")}
          fallbackHint={!doc && target ? target : ""}
          workspaces={workspaces}
          activeWs={activeWs}
          missingRequirements={!hasRequirements}
        />
        {/* 中：文件内容（按类型分发：md 编辑器 / 图片预览 / glb 预览器） */}
        <ContentPanel doc={doc} missing={!doc && !!target} ws={activeWs} />
        {/* 右：依赖列表 + 获取（view-and-diff） */}
        <DepsPanel deps={deps} hasDoc={!!doc} docPath={doc?.path ?? ""} />
      </div>
    </div>
  );
}
