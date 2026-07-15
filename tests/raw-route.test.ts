import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { NextRequest } from "next/server";

let dataDir: string;
let store: typeof import("../src/lib/store");
let session: typeof import("../src/lib/session");
let GET: typeof import("../src/app/api/items/[id]/raw/route").GET;

before(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "dropboard-raw-"));
  process.env.DROPBOARD_DATA_DIR = dataDir;
  process.env.DROPBOARD_SESSION_SECRET = "raw-route-secret-that-is-long-enough";
  store = await import("../src/lib/store");
  session = await import("../src/lib/session");
  ({ GET } = await import("../src/app/api/items/[id]/raw/route"));
});

after(async () => {
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

test("raw artifacts require authorization and receive a restrictive CSP", async () => {
  const item = await store.createItem({
    title: "Interactive",
    type: "report",
    content: "<!doctype html><script>document.body.textContent='ok'</script>",
  });
  const ctx = { params: Promise.resolve({ id: item.id }) };

  const denied = await GET(
    new NextRequest(`http://localhost/api/items/${item.id}/raw`),
    ctx,
  );
  assert.equal(denied.status, 401);

  const exp = Date.now() + 60_000;
  const sig = await session.signRawUrl(
    process.env.DROPBOARD_SESSION_SECRET!,
    item.id,
    exp,
  );
  const allowed = await GET(
    new NextRequest(
      `http://localhost/api/items/${item.id}/raw?e=${exp}&st=${sig}`,
    ),
    ctx,
  );
  assert.equal(allowed.status, 200);
  assert.match(allowed.headers.get("content-security-policy") ?? "", /connect-src 'none'/);
  assert.match(allowed.headers.get("content-security-policy") ?? "", /sandbox allow-scripts/);
  assert.equal(allowed.headers.get("referrer-policy"), "no-referrer");
});
