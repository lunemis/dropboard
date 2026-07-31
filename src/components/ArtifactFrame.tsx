"use client";

import { useState } from "react";
import { t } from "../lib/i18n";
import type { ItemViewMode } from "../lib/types";

export function ArtifactFrame({
  src,
  title,
  viewMode,
}: {
  src: string;
  title: string;
  viewMode: ItemViewMode;
}) {
  const [openAnyway, setOpenAnyway] = useState(false);
  const presentation = viewMode === "presentation";

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col">
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
        sandbox="allow-scripts"
        allow="fullscreen"
        src={src}
        title={title}
        className={`min-h-0 w-full flex-1 border-0 bg-white ${
          presentation && !openAnyway ? "hidden lg:block" : "block"
        }`}
      />
    </div>
  );
}
