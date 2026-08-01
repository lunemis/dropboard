import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

let dataDir: string;
let store: typeof import("../src/lib/store");

before(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "dropboard-revisions-"));
  process.env.DROPBOARD_DATA_DIR = dataDir;
  store = await import("../src/lib/store");
});

after(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

test("adds immutable revisions and brings an archived document back unread", async () => {
  const created = await store.createItem({
    title: "Roadmap",
    type: "report",
    content: "# Version one",
    content_type: "markdown",
    project: "Dropboard",
    folder: "Product/Roadmap",
    tags: ["roadmap"],
  });
  assert.equal(created.revision, 1);
  await store.updateItem(created.id, { status: "archived", read: true });

  const updated = await store.addRevision(created.id, {
    content: "# Version two",
    content_type: "markdown",
    summary: "Second pass",
    source: "test-agent",
    note: "Added launch plan",
    expected_revision: 1,
  });
  assert.equal(updated?.revision, 2);
  assert.equal(updated?.status, "inbox");
  assert.equal(updated?.read_at, null);
  assert.equal(updated?.share_epoch, 1);
  assert.equal(updated?.project, "Dropboard");
  assert.deepEqual(updated?.tags, ["roadmap"]);
  assert.equal((await store.readContent(created.id))?.content, "# Version two");
  assert.equal(
    (await store.readRevisionContent(created.id, 1))?.content,
    "# Version one",
  );
  assert.equal((await store.listRevisions(created.id))?.length, 2);
});

test("can update a stable item directly in the library", async () => {
  const created = await store.createItem({
    title: "Handbook",
    type: "info",
    content: "v1",
  });
  const updated = await store.addRevision(created.id, {
    content: "v2",
    content_type: "html",
    destination: "library",
  });
  assert.equal(updated?.status, "library");
  assert.ok(updated?.read_at);
});

test("restoring an old version creates a new revision without deleting history", async () => {
  const created = await store.createItem({
    title: "Spec",
    type: "review",
    content: "original",
    view_mode: "presentation",
  });
  await store.addRevision(created.id, {
    content: "changed",
    content_type: "html",
    view_mode: "document",
  });
  const restored = await store.restoreRevision(created.id, 1, "test");
  assert.equal(restored?.revision, 3);
  assert.equal(restored?.view_mode, "presentation");
  assert.equal((await store.readContent(created.id))?.content, "original");
  const history = await store.listRevisions(created.id);
  assert.equal(history?.[0].note, "Restored from v1");
  assert.deepEqual(
    history?.map((revision) => revision.view_mode),
    ["presentation", "document", "presentation"],
  );
});

test("a document key updates one stable item and preserves organization", async () => {
  const first = await store.createOrUpdateItem({
    title: "Recurring report",
    type: "report",
    content: "one",
    project: "Dropboard",
    folder: "Reports",
    tags: ["weekly"],
    document_key: "dropboard/weekly-report",
    view_mode: "presentation",
  });
  const second = await store.createOrUpdateItem({
    title: "Recurring report",
    type: "info",
    content: "two",
    document_key: "dropboard/weekly-report",
  });
  assert.equal(first.updated, false);
  assert.equal(second.updated, true);
  assert.equal(second.item.id, first.item.id);
  assert.equal(second.item.revision, 2);
  assert.equal(second.item.type, "report");
  assert.equal(second.item.view_mode, "presentation");
  assert.equal(second.item.project, "Dropboard");
  assert.equal(second.item.folder, "Reports");
  assert.deepEqual(second.item.tags, ["weekly"]);
});

test("expected revision prevents stale writers from silently overwriting", async () => {
  const created = await store.createItem({
    title: "Concurrent spec",
    type: "decision",
    content: "v1",
  });
  await store.addRevision(created.id, {
    content: "v2",
    content_type: "html",
    expected_revision: 1,
  });
  await assert.rejects(
    store.addRevision(created.id, {
      content: "stale",
      content_type: "html",
      expected_revision: 1,
    }),
    (error: unknown) =>
      error instanceof store.RevisionConflictError && error.currentRevision === 2,
  );
});

test("trash blocks implicit updates but explicit restore still works", async () => {
  const created = await store.createItem({
    title: "Deleted spec",
    type: "review",
    content: "original",
    document_key: "test/deleted-spec",
  });
  await store.updateItem(created.id, { status: "trash" });
  await assert.rejects(
    store.addRevision(created.id, {
      content: "agent update",
      content_type: "html",
    }),
    (error: unknown) => error instanceof store.TrashedDocumentError,
  );
  await assert.rejects(
    store.createOrUpdateItem({
      title: "Deleted spec",
      type: "review",
      content: "keyed update",
      document_key: "test/deleted-spec",
    }),
    (error: unknown) => error instanceof store.TrashedDocumentError,
  );
  const restored = await store.restoreRevision(created.id, 1, "test");
  assert.equal(restored?.status, "inbox");
  assert.equal(restored?.revision, 2);
});
