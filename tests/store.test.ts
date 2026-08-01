import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

let dataDir: string;
let store: typeof import("../src/lib/store");

before(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "dropboard-store-"));
  process.env.DROPBOARD_DATA_DIR = dataDir;
  store = await import("../src/lib/store");
});

after(async () => {
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

test("creates, reads, lists, and updates an item", async () => {
  const item = await store.createItem({
    title: "Test item",
    type: "review",
    content: "# Hello",
    content_type: "markdown",
  });
  assert.equal(store.isValidId(item.id), true);
  assert.equal(item.view_mode, "document");
  assert.equal((await store.getItem(item.id))?.title, "Test item");
  assert.equal((await store.readContent(item.id))?.content, "# Hello");
  assert.deepEqual((await store.listItems({ status: "inbox" })).map((i) => i.id), [item.id]);

  const updated = await store.updateItem(item.id, {
    pinned: true,
    read: true,
    status: "archived",
    project: "Dropboard",
    folder: "Research/Agents",
    tags: ["reference", "ai"],
  });
  assert.equal(updated?.pinned, true);
  assert.equal(updated?.status, "archived");
  assert.ok(updated?.read_at);
  assert.equal(updated?.project, "Dropboard");
  assert.equal(updated?.folder, "Research/Agents");
  assert.deepEqual(updated?.tags, ["reference", "ai"]);

  const revoked = await store.revokeShares(item.id);
  assert.equal(revoked?.share_epoch, 1);
});

test("normalizes legacy items without a view mode", async () => {
  const item = await store.createItem({
    title: "Legacy document",
    type: "info",
    content: "legacy",
  });
  const metaPath = path.join(dataDir, item.id, "meta.json");
  const legacyMeta = JSON.parse(await readFile(metaPath, "utf8"));
  delete legacyMeta.view_mode;
  await writeFile(metaPath, JSON.stringify(legacyMeta));

  assert.equal((await store.getItem(item.id))?.view_mode, "document");
});

test("creates durable items directly in the library", async () => {
  const item = await store.createItem({
    title: "Reference book",
    type: "info",
    content: "chapters",
    destination: "library",
  });
  assert.equal(item.status, "library");
  assert.ok(item.read_at);
  assert.deepEqual(
    (await store.listItems({ status: "library" })).map((entry) => entry.id),
    [item.id],
  );
  await assert.rejects(
    store.createItem({
      title: "Temporary book",
      type: "info",
      content: "temporary",
      destination: "library",
      ttl_minutes: 30,
    }),
    /cannot be temporary/,
  );
});

test("moving a temporary item to the library makes it durable", async () => {
  const item = await store.createItem({
    title: "Temporary reference",
    type: "info",
    content: "reference",
    ttl_minutes: 30,
  });
  assert.ok(item.expires_at);
  const moved = await store.updateItem(item.id, { status: "library" });
  assert.equal(moved?.status, "library");
  assert.equal(moved?.expires_at, null);

  const temporaryAgain = await store.updateItem(item.id, { ttl_minutes: 15 });
  assert.equal(temporaryAgain?.status, "inbox");
  assert.equal(temporaryAgain?.read_at, null);
  assert.ok(temporaryAgain?.expires_at);
});

test("zero trash TTL preserves trash while expired temp items are swept", async () => {
  const trash = await store.createItem({
    title: "Old trash",
    type: "info",
    content: "trash",
  });
  await store.updateItem(trash.id, { status: "trash" });
  const trashMetaPath = path.join(dataDir, trash.id, "meta.json");
  const trashMeta = JSON.parse(await readFile(trashMetaPath, "utf8"));
  trashMeta.trashed_at = "2020-01-01T00:00:00.000Z";
  await writeFile(trashMetaPath, JSON.stringify(trashMeta));

  const temp = await store.createItem({
    title: "Expired temp",
    type: "info",
    content: "temp",
  });
  const tempMetaPath = path.join(dataDir, temp.id, "meta.json");
  const tempMeta = JSON.parse(await readFile(tempMetaPath, "utf8"));
  tempMeta.expires_at = "2020-01-01T00:00:00.000Z";
  await writeFile(tempMetaPath, JSON.stringify(tempMeta));

  assert.deepEqual(await store.sweepStorage(0), { removed: 1 });
  assert.ok(await store.getItem(trash.id));
  assert.equal(await store.getItem(temp.id), null);
});

test("serializes concurrent metadata updates without losing fields", async () => {
  const item = await store.createItem({
    title: "Concurrent",
    type: "decision",
    content: "concurrent",
  });
  await Promise.all([
    store.updateItem(item.id, { pinned: true }),
    store.updateItem(item.id, { read: true }),
    store.updateItem(item.id, { status: "archived" }),
  ]);
  const updated = await store.getItem(item.id);
  assert.equal(updated?.pinned, true);
  assert.ok(updated?.read_at);
  assert.equal(updated?.status, "archived");
});

test("ignores malformed metadata and unsafe content paths", async () => {
  const id = "20260101-000000-bad1";
  const dir = path.join(dataDir, id);
  await mkdir(dir);
  await writeFile(
    path.join(dir, "meta.json"),
    JSON.stringify({ id, content_type: "html", content_file: "../secret" }),
  );
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await store.getItem(id), null);
  } finally {
    console.warn = originalWarn;
  }
});
