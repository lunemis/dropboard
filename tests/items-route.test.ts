import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { NextRequest } from "next/server";

let dataDir: string;
let POST: typeof import("../src/app/api/items/route").POST;

before(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "dropboard-items-route-"));
  process.env.DROPBOARD_DATA_DIR = dataDir;
  process.env.DROPBOARD_TOKEN = "items-route-token-that-is-long-enough";
  ({ POST } = await import("../src/app/api/items/route"));
});

after(async () => {
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

function publishRequest(authorized: boolean): NextRequest {
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
    }),
  });
}

test("publish API requires the bearer token", async () => {
  assert.equal((await POST(publishRequest(false))).status, 401);
});

test("publish API creates a validated item", async () => {
  const response = await POST(publishRequest(true));
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.item.title, "API item");
  assert.match(body.url, /^\/i\//);
});

