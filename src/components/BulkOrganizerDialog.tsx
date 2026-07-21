"use client";

import { useId, useState } from "react";
import { t } from "../lib/i18n";
import { useOrganizationSuggestions } from "../lib/useOrganizationSuggestions";

export interface BulkOrganizationValues {
  project: string;
  folder: string;
}

export function BulkOrganizerDialog({
  count,
  onClose,
  onSave,
}: {
  count: number;
  onClose: () => void;
  onSave: (values: BulkOrganizationValues) => Promise<boolean>;
}) {
  const [project, setProject] = useState("");
  const [folder, setFolder] = useState("");
  const [saving, setSaving] = useState(false);
  const suggestions = useOrganizationSuggestions();
  const suggestionId = useId().replaceAll(":", "");

  async function save() {
    setSaving(true);
    const saved = await onSave({ project, folder });
    setSaving(false);
    if (saved) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-[rgb(12_16_22_/_0.42)] backdrop-blur-[2px] sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-organize-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section className="w-full max-w-lg rounded-t-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-md)] sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.12em] text-[var(--accent)] uppercase">
              {t.selected(count)}
            </p>
            <h2
              id="bulk-organize-title"
              className="mt-1 text-xl font-bold tracking-[-0.025em]"
            >
              {t.bulkOrganize}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              {t.bulkOrganizeHint}
            </p>
          </div>
          <button
            type="button"
            aria-label={t.cancel}
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-[var(--muted)] hover:bg-[var(--surface-2)]"
          >
            ×
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-[var(--muted)]">
            {t.project}
            <input
              value={project}
              maxLength={100}
              list={`${suggestionId}-projects`}
              placeholder={t.projectPlaceholder}
              onChange={(event) => setProject(event.target.value)}
              className="organizer-input mt-1.5"
            />
            <datalist id={`${suggestionId}-projects`}>
              {suggestions.projects.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
          <label className="text-xs font-semibold text-[var(--muted)]">
            {t.folder}
            <input
              value={folder}
              maxLength={240}
              list={`${suggestionId}-folders`}
              placeholder={t.folderPlaceholder}
              onChange={(event) => setFolder(event.target.value)}
              className="organizer-input mt-1.5"
            />
            <datalist id={`${suggestionId}-folders`}>
              {suggestions.folders.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--muted)]">
          {t.bulkEmptyHint}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl px-4 py-2.5 text-sm text-[var(--muted)] hover:bg-[var(--surface-hover)] disabled:opacity-40"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] shadow-sm active:scale-95 disabled:opacity-50"
          >
            {saving ? t.saving : t.moveSelected}
          </button>
        </div>
      </section>
    </div>
  );
}
