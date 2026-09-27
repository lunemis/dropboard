"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "../lib/i18n";
import { artifactViewUrl, selectedArtifactLink, type ArtifactLink, type ArtifactLinkCatalog } from "../lib/artifact-links";
import { DialogSurface } from "./ui/DialogSurface";
import type { ItemViewMode } from "../lib/types";

export function ArtifactFrame(props: { src: string; title: string; viewMode: ItemViewMode }) {
  return <ArtifactFrameContent key={props.src} {...props} />;
}

function ArtifactFrameContent({
  src,
  title,
  viewMode,
}: {
  src: string;
  title: string;
  viewMode: ItemViewMode;
}) {
  const [openAnyway, setOpenAnyway] = useState(false);
  const [selected, setSelected] = useState<ArtifactLink | null>(null);
  const [linkError, setLinkError] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const presentation = viewMode === "presentation";

  useEffect(() => {
    const controller = new AbortController();
    const catalog = fetch(artifactViewUrl(src, "links"), { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("link catalog unavailable");
        return await response.json() as ArtifactLinkCatalog;
      });
    // The document itself still renders if a catalog request fails.
    void catalog.catch(() => {});
    const receive = async (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== "null") return;
      try {
        const link = selectedArtifactLink(await catalog, event.data);
        if (!controller.signal.aborted && link) setSelected(link);
      } catch {
        if (!controller.signal.aborted) setLinkError(true);
      }
    };
    window.addEventListener("message", receive);
    return () => { controller.abort(); window.removeEventListener("message", receive); };
  }, [src]);

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col">
      {linkError && <p role="status" className="p-3 text-sm">{t.documentLinkFailed}</p>}
      {selected && (
        <DialogSurface title={t.documentLink} eyebrow={new URL(selected.href).hostname} description={selected.label} onClose={() => setSelected(null)}>
          <div className="ui-dialog-body">
            <p className="mb-3 break-all text-sm text-[var(--muted)]">{selected.href}</p>
            <a data-dialog-autofocus href={selected.href} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-xl bg-[var(--ink)] px-4 py-3 text-sm font-semibold text-[var(--bg)]">{t.openNewTab}</a>
          </div>
        </DialogSurface>
      )}
      {presentation && !openAnyway && (
        <section className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-12 text-center lg:hidden">
          <div
            aria-hidden="true"
            className="flex h-16 w-24 items-center justify-center rounded-xl border-2 border-[var(--violet)] bg-[var(--violet-soft)] font-mono text-2xl text-[var(--violet)] shadow-[var(--shadow-sm)]"
          >
            ▶
          </div>
          <div className="max-w-sm">
            <h2 className="text-lg font-bold tracking-[-0.02em]">
              {t.presentationNoticeTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              {t.presentationNoticeHint}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <a
              href={src}
              target="_blank"
              rel="noopener"
              className="rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)]"
            >
              {t.openNewTab}
            </a>
            <button
              type="button"
              onClick={() => setOpenAnyway(true)}
              className="rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold"
            >
              {t.openAnyway}
            </button>
          </div>
        </section>
      )}
      <iframe
        ref={frame}
        sandbox="allow-scripts"
        allow="fullscreen"
        src={artifactViewUrl(src, "frame")}
        title={title}
        className={`min-h-0 w-full flex-1 border-0 bg-white ${
          presentation && !openAnyway ? "hidden lg:block" : "block"
        }`}
      />
    </div>
  );
}
