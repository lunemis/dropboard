import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildLibraryIndex,
  folderSelection,
  matchesLibrarySelection,
  projectSelection,
} from "../src/lib/library";
import type { ItemMeta } from "../src/lib/types";

function item(
  id: string,
  project: string | null,
  folder: string | null,
): ItemMeta {
  return {
    id,
    title: id,
    type: "info",
    project,
    folder,
    tags: [],
    summary: "",
    content_file: "index.html",
    content_type: "html",
    status: "archived",
    pinned: false,
    read_at: null,
    trashed_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    source: "test",
  };
}

const items = [
  item("unfiled", null, null),
  item("project-root", "Dropboard", null),
  item("research", "Dropboard", "Research"),
  item("agents", "Dropboard", "Research/Agents"),
  item("root-folder", null, "Personal/Ideas"),
];

test("builds project and nested folder counts", () => {
  const index = buildLibraryIndex(items);
  assert.equal(index.unfiledCount, 1);
  assert.deepEqual(index.projects[0], {
    project: "Dropboard",
    count: 3,
    folders: [
      { path: "Research", depth: 0, count: 2 },
      { path: "Research/Agents", depth: 1, count: 1 },
    ],
  });
  assert.deepEqual(index.rootFolders, [
    { path: "Personal", depth: 0, count: 1 },
    { path: "Personal/Ideas", depth: 1, count: 1 },
  ]);
});

test("matches unfiled, project, and recursive folder selections", () => {
  assert.equal(matchesLibrarySelection(items[0], "unfiled"), true);
  assert.equal(
    matchesLibrarySelection(items[3], projectSelection("Dropboard")),
    true,
  );
  assert.equal(
    matchesLibrarySelection(
      items[3],
      folderSelection("Dropboard", "Research"),
    ),
    true,
  );
  assert.equal(
    matchesLibrarySelection(items[4], folderSelection(null, "Personal")),
    true,
  );
});
