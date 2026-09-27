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

test("viewer links and frame keep authorization, version binding, CSP and original bytes", async () => {
  const original = '<!doctype html><a href="https://example.com/?work=one&amp;view=review">Assets</a>';
  const item = await store.createItem({ title: "Links", type: "report", content: original, content_type: "html" });
  const ctx = { params: Promise.resolve({ id: item.id }) };
  const exp = Date.now() + 60_000;
  const sig = await session.signRawUrl(process.env.DROPBOARD_SESSION_SECRET!, item.id, exp, 1);
  const base = `http://localhost/api/items/${item.id}/raw?v=1&e=${exp}&st=${sig}`;
  assert.equal((await GET(new NextRequest(base), ctx)).status, 200);
  assert.equal(await (await GET(new NextRequest(base), ctx)).text(), original);
  const links = await GET(new NextRequest(base + "&view=links"), ctx);
  const catalog = await links.json();
  assert.deepEqual(catalog.links, [{ href: "https://example.com/?work=one&view=review", label: "Assets" }]);
  const frame = await GET(new NextRequest(base + "&view=frame"), ctx);
  assert.match(await frame.text(), new RegExp(catalog.document));
  assert.match(frame.headers.get("content-security-policy")!, /sandbox allow-scripts(?:;|$)/);
  assert.doesNotMatch(frame.headers.get("content-security-policy")!, /allow-popups|allow-same-origin|allow-top-navigation/);
  for (const view of ["links", "frame"]) {
    assert.equal((await GET(new NextRequest(`http://localhost/api/items/${item.id}/raw?view=${view}`), ctx)).status, 401);
    assert.equal((await GET(new NextRequest(base.replace("v=1", "v=2") + `&view=${view}`), ctx)).status, 401);
  }
  await store.addRevision(item.id, { content: "# Next\n\n[Other](https://other.example)", content_type: "markdown" });
  assert.deepEqual((await (await GET(new NextRequest(base + "&view=links"), ctx)).json()).links, catalog.links);
  const latestSig = await session.signRawUrl(process.env.DROPBOARD_SESSION_SECRET!, item.id, exp);
  const latest = await GET(new NextRequest(`http://localhost/api/items/${item.id}/raw?e=${exp}&st=${latestSig}&view=links`), ctx);
  assert.deepEqual((await latest.json()).links, [{ href: "https://other.example/", label: "Other" }]);
  const epoch = (await store.getItem(item.id))!.share_epoch ?? 0;
  const share = await session.signShareUrl(process.env.DROPBOARD_SESSION_SECRET!, item.id, epoch, exp);
  const shared = await GET(new NextRequest(`http://localhost/api/items/${item.id}/raw?e=${exp}&ep=${epoch}&st=${share}&view=links`), ctx);
  assert.equal(shared.status, 200);
  assert.deepEqual((await shared.json()).links, [{ href: "https://other.example/", label: "Other" }]);
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

  await store.addRevision(item.id, {
    content: "<!doctype html><p>version two</p>",
    content_type: "html",
  });
  const revisionSig = await session.signRawUrl(
    process.env.DROPBOARD_SESSION_SECRET!,
    item.id,
    exp,
    1,
  );
  const oldVersion = await GET(
    new NextRequest(
      `http://localhost/api/items/${item.id}/raw?v=1&e=${exp}&st=${revisionSig}`,
    ),
    ctx,
  );
  assert.match(await oldVersion.text(), /document.body.textContent='ok'/);
  const tampered = await GET(
    new NextRequest(
      `http://localhost/api/items/${item.id}/raw?v=2&e=${exp}&st=${revisionSig}`,
    ),
    ctx,
  );
  assert.equal(tampered.status, 401);
});
