export interface ArtifactLink { href: string; label: string }
export interface ArtifactLinkCatalog { document: string; links: ArtifactLink[] }

export function httpLink(value: string): string | null {
  if (!/^https?:\/\//i.test(value.trim())) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      ? url.href : null;
  } catch { return null; }
}

// Messages select a stored link; they never supply a navigation URL.
export function selectedArtifactLink(catalog: ArtifactLinkCatalog, message: unknown): ArtifactLink | null {
  if (!message || typeof message !== "object") return null;
  const m = message as Record<string, unknown>;
  if (m.type !== "dropboard:link" || m.document !== catalog.document ||
      typeof m.index !== "number" || !Number.isSafeInteger(m.index) || m.index < 0 ||
      Object.keys(m).some(key => !["type", "document", "index"].includes(key))) return null;
  return catalog.links[m.index] ?? null;
}

export function artifactViewUrl(src: string, view: "links" | "frame"): string {
  const url = new URL(src, "http://dropboard.invalid");
  url.searchParams.set("view", view);
  return src.startsWith("/") ? url.pathname + url.search + url.hash : url.href;
}
