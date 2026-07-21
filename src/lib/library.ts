import type { ItemMeta } from "./types";

export interface LibraryFolderNode {
  path: string;
  depth: number;
  count: number;
}

export interface LibraryProjectNode {
  project: string | null;
  count: number;
  folders: LibraryFolderNode[];
}

export interface LibraryIndex {
  unfiledCount: number;
  projects: LibraryProjectNode[];
  rootFolders: LibraryFolderNode[];
}

function folderPrefixes(folder: string): string[] {
  const parts = folder.split("/").filter(Boolean);
  return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}

function folderNodes(items: ItemMeta[]): LibraryFolderNode[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.folder) continue;
    for (const prefix of folderPrefixes(item.folder)) {
      counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([path, count]) => ({
      path,
      count,
      depth: path.split("/").length - 1,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function buildLibraryIndex(items: ItemMeta[]): LibraryIndex {
  const projects = new Map<string, ItemMeta[]>();
  const rootItems: ItemMeta[] = [];
  let unfiledCount = 0;

  for (const item of items) {
    if (!item.project && !item.folder) unfiledCount++;
    if (item.project) {
      const group = projects.get(item.project) ?? [];
      group.push(item);
      projects.set(item.project, group);
    } else if (item.folder) {
      rootItems.push(item);
    }
  }

  return {
    unfiledCount,
    projects: [...projects.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([project, projectItems]) => ({
        project,
        count: projectItems.length,
        folders: folderNodes(projectItems),
      })),
    rootFolders: folderNodes(rootItems),
  };
}

export function projectSelection(project: string): string {
  return `project:${encodeURIComponent(project)}`;
}

export function folderSelection(project: string | null, folder: string): string {
  return `folder:${encodeURIComponent(project ?? "")}:${encodeURIComponent(folder)}`;
}

export function matchesLibrarySelection(
  item: ItemMeta,
  selection: string,
): boolean {
  if (selection === "all") return true;
  if (selection === "unfiled") return !item.project && !item.folder;
  if (selection.startsWith("project:")) {
    return item.project === decodeURIComponent(selection.slice(8));
  }
  if (selection.startsWith("folder:")) {
    const separator = selection.indexOf(":", 7);
    if (separator === -1) return false;
    const project = decodeURIComponent(selection.slice(7, separator)) || null;
    const folder = decodeURIComponent(selection.slice(separator + 1));
    return (
      item.project === project &&
      Boolean(
        item.folder &&
          (item.folder === folder || item.folder.startsWith(`${folder}/`)),
      )
    );
  }
  return false;
}
