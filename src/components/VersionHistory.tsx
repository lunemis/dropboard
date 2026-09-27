"use client";

import { History } from "lucide-react";
import { useEffect, useState } from "react";
import { relTime, t } from "../lib/i18n";
import type { ItemMeta, RevisionMeta } from "../lib/types";
import { DialogSurface } from "./ui/DialogSurface";

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
    <DialogSurface
      description={t.versionHistoryHint}
      disabled={restoring !== null}
      eyebrow={`v${item.revision}`}
      onClose={onClose}
      title={t.versionHistory}
      tone="violet"
      variant="sheet"
    >
      <div className="ui-dialog-scroll-body">
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
                        {revision.source} · {revision.content_type} ·{" "}
                        {revision.view_mode}
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
    </DialogSurface>
  );
}

export function HistoryIcon() {
  return <History aria-hidden="true" size={18} strokeWidth={1.8} />;
}
