import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { NextRequest } from "next/server";

let dataDir: string;
let itemId: string;
let PATCH: typeof import("../src/app/api/items/[id]/route").PATCH;

before(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "dropboard-item-route-"));
  process.env.DROPBOARD_DATA_DIR = dataDir;
  const store = await import("../src/lib/store");
  const item = await store.createItem({
    title: "Patch me",
    type: "info",
    content: "item",
  });
  itemId = item.id;
  ({ PATCH } = await import("../src/app/api/items/[id]/route"));
});

after(async () => {
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

function patchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost/api/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("rejects invalid and conflicting patch fields", async () => {
  const ctx = { params: Promise.resolve({ id: itemId }) };
  assert.equal((await PATCH(patchRequest({ pinned: "yes" }), ctx)).status, 400);
  assert.equal(
    (await PATCH(patchRequest({ keep: true, ttl_minutes: 10 }), ctx)).status,
    400,
  );
  assert.equal((await PATCH(patchRequest({ surprise: true }), ctx)).status, 400);
});

test("applies a valid patch", async () => {
  const response = await PATCH(
    patchRequest({
      pinned: true,
      read: true,
      project: "Dropboard",
      folder: "Research / Agents",
      tags: ["open-source", " agents ", "agents"],
    }),
    { params: Promise.resolve({ id: itemId }) },
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.item.pinned, true);
  assert.ok(body.item.read_at);
  assert.equal(body.item.project, "Dropboard");
  assert.equal(body.item.folder, "Research/Agents");
  assert.deepEqual(body.item.tags, ["open-source", "agents"]);
});

test("rejects invalid organization metadata", async () => {
  const ctx = { params: Promise.resolve({ id: itemId }) };
  assert.equal(
    (await PATCH(patchRequest({ folder: "Research/../Secret" }), ctx)).status,
    400,
  );
  assert.equal(
    (await PATCH(patchRequest({ tags: Array(21).fill("tag") }), ctx)).status,
    400,
  );
  assert.equal(
    (await PATCH(patchRequest({ project: "p".repeat(101) }), ctx)).status,
    400,
  );
});
