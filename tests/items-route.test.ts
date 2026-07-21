import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { NextRequest } from "next/server";

let dataDir: string;
let POST: typeof import("../src/app/api/items/route").POST;
let GET: typeof import("../src/app/api/items/route").GET;

before(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "dropboard-items-route-"));
  process.env.DROPBOARD_DATA_DIR = dataDir;
  process.env.DROPBOARD_TOKEN = "items-route-token-that-is-long-enough";
  ({ GET, POST } = await import("../src/app/api/items/route"));
});

after(async () => {
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

function publishRequest(
  authorized: boolean,
  overrides: Record<string, unknown> = {},
): NextRequest {
  return new NextRequest("http://localhost/api/items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorized
        ? { Authorization: `Bearer ${process.env.DROPBOARD_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({
      title: "API item",
      type: "report",
      content: "# Report",
      content_type: "markdown",
      ...overrides,
    }),
  });
}

test("publish API requires the bearer token", async () => {
  assert.equal((await POST(publishRequest(false))).status, 401);
});

test("publish API creates a validated item", async () => {
  const response = await POST(
    publishRequest(true, { folder: "Research / Agents" }),
  );
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.item.title, "API item");
  assert.match(body.url, /^\/i\//);
  assert.equal(body.item.folder, "Research/Agents");
});

test("publish API rejects oversized metadata", async () => {
  const response = await POST(
    publishRequest(true, { project: "p".repeat(101) }),
  );
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /project/);
});

test("list API returns bounded pagination metadata", async () => {
  await POST(publishRequest(true, { title: "Second" }));
  await POST(publishRequest(true, { title: "Third" }));
  const response = await GET(
    new NextRequest("http://localhost/api/items?limit=2&offset=0"),
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.items.length, 2);
  assert.ok(body.total >= 3);
  assert.equal(body.has_more, true);
});
