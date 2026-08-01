import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

let dataDir: string;
let itemId: string;
let GET: typeof import("../src/app/api/items/[id]/revisions/route").GET;
let POST: typeof import("../src/app/api/items/[id]/revisions/route").POST;
let RESTORE: typeof import("../src/app/api/items/[id]/revisions/[revision]/restore/route").POST;
let store: typeof import("../src/lib/store");

before(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "dropboard-revision-route-"));
  process.env.DROPBOARD_DATA_DIR = dataDir;
  process.env.DROPBOARD_SESSION_SECRET = "revision-route-secret-long-enough";
  store = await import("../src/lib/store");
  itemId = (
    await store.createItem({
      title: "Versioned API item",
      type: "review",
      content: "v1",
    })
  ).id;
  ({ GET, POST } = await import("../src/app/api/items/[id]/revisions/route"));
  ({ POST: RESTORE } = await import(
    "../src/app/api/items/[id]/revisions/[revision]/restore/route"
  ));
});

after(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

test("revision API appends and lists signed immutable versions", async () => {
  const ctx = { params: Promise.resolve({ id: itemId }) };
  const response = await POST(
    new Request(`http://localhost/api/items/${itemId}/revisions`, {
      method: "POST",
      body: JSON.stringify({
        content: "v2",
        content_type: "html",
        view_mode: "presentation",
        revision_note: "Updated copy",
        expected_revision: 1,
      }),
    }),
    ctx,
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).item.revision, 2);

  const listed = await GET(new Request("http://localhost"), ctx);
  const body = await listed.json();
  assert.deepEqual(
    body.revisions.map((revision: { revision: number }) => revision.revision),
    [2, 1],
  );
  assert.match(body.revisions[0].raw_url, /v=2.*st=/);
  assert.equal(body.revisions[0].view_mode, "presentation");
});

test("revision API rejects an invalid view mode", async () => {
  const response = await POST(
    new Request(`http://localhost/api/items/${itemId}/revisions`, {
      method: "POST",
      body: JSON.stringify({
        content: "invalid view",
        content_type: "html",
        view_mode: "canvas",
      }),
    }),
    { params: Promise.resolve({ id: itemId }) },
  );
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /view_mode/);
});

test("revision API can send an update directly to the library", async () => {
  const item = await store.createItem({
    title: "Reference update",
    type: "info",
    content: "v1",
  });
  const response = await POST(
    new Request(`http://localhost/api/items/${item.id}/revisions`, {
      method: "POST",
      body: JSON.stringify({
        content: "v2",
        content_type: "html",
        destination: "library",
      }),
    }),
    { params: Promise.resolve({ id: item.id }) },
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).item.status, "library");
});

test("revision API rejects an invalid destination", async () => {
  const response = await POST(
    new Request(`http://localhost/api/items/${itemId}/revisions`, {
      method: "POST",
      body: JSON.stringify({
        content: "invalid destination",
        content_type: "html",
        destination: "archive",
      }),
    }),
    { params: Promise.resolve({ id: itemId }) },
  );
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /destination/);
});

test("revision API returns a conflict for a stale expected version", async () => {
  const response = await POST(
    new Request(`http://localhost/api/items/${itemId}/revisions`, {
      method: "POST",
      body: JSON.stringify({
        content: "stale",
        content_type: "html",
        expected_revision: 1,
      }),
    }),
    { params: Promise.resolve({ id: itemId }) },
  );
  assert.equal(response.status, 409);
  assert.equal((await response.json()).current_revision, 2);
});

test("restore API creates another revision", async () => {
  const response = await RESTORE(new Request("http://localhost", { method: "POST" }), {
    params: Promise.resolve({ id: itemId, revision: "1" }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.item.revision, 3);
  assert.equal(body.restored_from, 1);
});

test("revision API blocks trash updates while the restore endpoint is explicit", async () => {
  const trashed = await store.createItem({
    title: "Trashed API item",
    type: "info",
    content: "original",
  });
  await store.updateItem(trashed.id, { status: "trash" });
  const blocked = await POST(
    new Request(`http://localhost/api/items/${trashed.id}/revisions`, {
      method: "POST",
      body: JSON.stringify({ content: "update", content_type: "html" }),
    }),
    { params: Promise.resolve({ id: trashed.id }) },
  );
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).item_id, trashed.id);

  const restored = await RESTORE(
    new Request("http://localhost", { method: "POST" }),
    { params: Promise.resolve({ id: trashed.id, revision: "1" }) },
  );
  assert.equal(restored.status, 200);
  assert.equal((await restored.json()).item.status, "inbox");
});
