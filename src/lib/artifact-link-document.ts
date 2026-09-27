import { createHash } from "node:crypto";
import { parse, serialize, defaultTreeAdapter, type DefaultTreeAdapterMap } from "parse5";
import { httpLink, type ArtifactLinkCatalog } from "./artifact-links";

type Node = DefaultTreeAdapterMap["node"];

export function artifactLinkDocument(html: string) {
  const tree = parse(html);
  const catalog: ArtifactLinkCatalog = {
    document: createHash("sha256").update(html).digest("hex"), links: [],
  };
  const seen = new Set<string>();
  function text(node: Node): string {
    if (node.nodeName === "#text") return (node as DefaultTreeAdapterMap["textNode"]).value;
    return "childNodes" in node ? node.childNodes.map(text).join("") : "";
  }
  function visit(node: Node) {
    if ("tagName" in node && node.tagName === "a") {
      const href = httpLink(node.attrs.find(a => a.name === "href")?.value ?? "");
      if (href && !seen.has(href)) {
        seen.add(href);
        catalog.links.push({ href, label: text(node).replace(/\s+/g, " ").trim().slice(0, 200) || new URL(href).hostname });
      }
    }
    if ("childNodes" in node) node.childNodes.forEach(visit);
  }
  visit(tree);
  // Insert before authored scripts. No permissions or automatic navigation are added.
  const root = tree.childNodes.find(n => "tagName" in n && n.tagName === "html") as DefaultTreeAdapterMap["element"];
  const head = root.childNodes.find(n => "tagName" in n && n.tagName === "head") as DefaultTreeAdapterMap["element"];
  const script = defaultTreeAdapter.createElement("script", head.namespaceURI, []);
  const payload = JSON.stringify(catalog).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  defaultTreeAdapter.insertText(script, `(() => {
    const catalog = ${payload};
    document.addEventListener('click', (event) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor) return;
      const raw = anchor.getAttribute('href').trim();
      if (raw.startsWith('#')) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.isTrusted) return;
      let href; try { href = new URL(raw).href; } catch { return; }
      const index = catalog.links.findIndex(link => link.href === href);
      if (index >= 0) parent.postMessage({ type:'dropboard:link', document:catalog.document, index }, '*');
    }, true);
  })();`);
  script.parentNode = head;
  head.childNodes.unshift(script);
  return { catalog, frameHtml: serialize(tree) };
}
