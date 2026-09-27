import assert from "node:assert/strict";
import { test } from "node:test";
import { artifactLinkDocument } from "../src/lib/artifact-link-document";
import { artifactViewUrl, httpLink, selectedArtifactLink } from "../src/lib/artifact-links";

test("extracts stored HTML links without executing scripts or trusting dynamic URLs", () => {
  const html = `<!doctype html><a href="#section">Contents</a>
    <a href="https://example.com/?a=1&amp;b=2"><strong>Assets</strong></a>
    <a href='https://example.com/?a=1&amp;b=2'>Duplicate</a>
    <a href='javascript:alert(1)'>Script</a><a href='data:text/html,test'>Data</a>
    <a href='https://user:pass@example.com'>Credentials</a>
    <script>const fake = '<a href="https://fake.example">not a link</a>';</script>
    <template><a href="https://inert.example">Inert</a></template>`;
  const { catalog, frameHtml } = artifactLinkDocument(html);
  assert.deepEqual(catalog.links, [{ href: "https://example.com/?a=1&b=2", label: "Assets" }]);
  assert.equal(catalog.document, artifactLinkDocument(html).catalog.document);
  assert.notEqual(catalog.document, artifactLinkDocument(html + " ").catalog.document);
  assert.ok(frameHtml.indexOf("dropboard:link") < frameHtml.indexOf("const fake"));
  assert.match(frameHtml, /event\.isTrusted/);
  assert.doesNotMatch(frameHtml, /window\.open|location\.assign/);
  assert.equal(httpLink("//example.com"), null);
  assert.equal(httpLink("https://example.com"), "https://example.com/");
});

test("messages only select a current catalog entry, never a supplied URL", () => {
  const { catalog } = artifactLinkDocument('<a href="https://example.com">Read</a>');
  const message = { type: "dropboard:link", document: catalog.document, index: 0 };
  assert.deepEqual(selectedArtifactLink(catalog, message), catalog.links[0]);
  for (const bad of [null, {}, { ...message, href: "https://evil.example" },
    { ...message, document: "old" }, { ...message, index: -1 }, { ...message, index: 1 },
    { ...message, index: "0" }, { ...message, index: 0.5 }]) {
    assert.equal(selectedArtifactLink(catalog, bad), null);
  }
});

test("viewer modes preserve the signed URL and version and script data remains inert", () => {
  assert.equal(artifactViewUrl("/api/items/test/raw?e=123&st=signed&v=2", "frame"),
    "/api/items/test/raw?e=123&st=signed&v=2&view=frame");
  const { frameHtml } = artifactLinkDocument('<a href="https://example.com/?x=&lt;/script&gt;">Link</a>');
  assert.equal((frameHtml.match(/<script>/g) ?? []).length, 1);
});
