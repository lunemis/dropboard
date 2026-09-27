"use client";

import { useId, useState } from "react";
import { t } from "../lib/i18n";
import { useOrganizationSuggestions } from "../lib/useOrganizationSuggestions";
import { DialogSurface } from "./ui/DialogSurface";

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
    <DialogSurface
      description={t.bulkOrganizeHint}
      disabled={saving}
      eyebrow={t.selected(count)}
      onClose={onClose}
      title={t.bulkOrganize}
    >
      <div className="ui-dialog-body">
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-[var(--muted)]">
            {t.project}
            <input
              data-dialog-autofocus
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
            data-slot="button"
          >
            {saving ? t.saving : t.moveSelected}
          </button>
        </div>
      </div>
    </DialogSurface>
  );
}
