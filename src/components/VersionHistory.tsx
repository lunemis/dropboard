"use client";

import { useEffect, useRef, useState } from "react";
import { relTime, t } from "../lib/i18n";
import type { ItemMeta, RevisionMeta } from "../lib/types";
import { useDialogFocus } from "../lib/useDialogFocus";

export interface RevisionWithUrl extends RevisionMeta {
  raw_url: string;
}

export function VersionHistory({
  item,
  selectedRevision,
  onSelect,
  onRestored,
  onClose,
}: {
  item: ItemMeta;
  selectedRevision: number | null;
  onSelect: (revision: RevisionWithUrl | null) => void;
  onRestored: (item: ItemMeta, restoredFrom: number) => void;
  onClose: () => void;
}) {
  const [revisions, setRevisions] = useState<RevisionWithUrl[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocus({
    containerRef: dialogRef,
    onClose,
    disabled: restoring !== null,
  });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/items/${item.id}/revisions`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`load failed (${response.status})`);
        return (await response.json()) as { revisions: RevisionWithUrl[] };
      })
      .then((body) => {
        if (!cancelled) setRevisions(body.revisions);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id, item.revision]);

  async function restore(revision: number) {
    if (confirming !== revision) {
      setConfirming(revision);
      return;
    }
    setRestoring(revision);
    try {
      const response = await fetch(
        `/api/items/${item.id}/revisions/${revision}/restore`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error(`restore failed (${response.status})`);
      const body = (await response.json()) as { item: ItemMeta };
      onRestored(body.item, revision);
    } finally {
      setRestoring(null);
      setConfirming(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex justify-end bg-[rgb(12_16_22_/_0.38)] backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="version-history-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && restoring === null)
          onClose();
      }}
    >
      <aside
        ref={dialogRef}
        tabIndex={-1}
        className="flex h-full w-full max-w-md flex-col border-l border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-md)] outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] p-5 sm:p-6">
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.12em] text-[var(--violet)] uppercase">
              v{item.revision}
            </p>
            <h2
              id="version-history-title"
              className="mt-1 text-xl font-bold tracking-[-0.025em]"
            >
              {t.versionHistory}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              {t.versionHistoryHint}
            </p>
          </div>
          <button
            data-dialog-autofocus
            type="button"
            aria-label={t.cancel}
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-[var(--muted)] hover:bg-[var(--surface-2)]"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {loadFailed ? (
            <p className="py-12 text-center text-sm text-[var(--accent)]">
              {t.versionLoadFailed}
            </p>
          ) : revisions === null ? (
            <p className="py-12 text-center text-sm text-[var(--muted)]">
              {t.loading}
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {revisions.map((revision) => {
                const current = revision.revision === item.revision;
                const selected = current
                  ? selectedRevision === null
                  : selectedRevision === revision.revision;
                return (
                  <li
                    key={revision.revision}
                    className={`rounded-2xl border p-3.5 transition-colors ${
                      selected
                        ? "border-[var(--violet)] bg-[var(--violet-soft)]"
                        : "border-[var(--line)] bg-[var(--surface-muted)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(current ? null : revision)}
                      className="w-full text-left"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <strong className="font-mono text-sm">
                          v{revision.revision}
                        </strong>
                        <span className="text-[10px] text-[var(--muted)]">
                          {current
                            ? t.currentVersion
                            : relTime(revision.created_at)}
                        </span>
                      </span>
                      <span className="mt-1.5 block text-sm font-medium">
                        {revision.title}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">
                        {revision.note || t.revisionNoteFallback}
                      </span>
                      <span className="mt-2 block font-mono text-[9px] text-[var(--muted-soft)]">
                        {revision.source} · {revision.content_type}
                      </span>
                    </button>
                    {!current && selected && (
                      <button
                        type="button"
                        disabled={restoring !== null}
                        onClick={() => restore(revision.revision)}
                        className="mt-3 w-full rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--ink)] disabled:opacity-50"
                      >
                        {restoring === revision.revision
                          ? t.saving
                          : confirming === revision.revision
                            ? t.confirmRestore
                            : t.restoreVersion}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}

export function HistoryIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </svg>
  );
}
