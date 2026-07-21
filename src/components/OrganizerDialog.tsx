"use client";

import { useState } from "react";
import { t } from "../lib/i18n";
import type { ItemMeta } from "../lib/types";

export interface OrganizationValues {
  project: string;
  folder: string;
  tags: string[];
}

export function OrganizerDialog({
  item,
  onClose,
  onSave,
}: {
  item: ItemMeta;
  onClose: () => void;
  onSave: (values: OrganizationValues) => Promise<boolean>;
}) {
  const [project, setProject] = useState(item.project ?? "");
  const [folder, setFolder] = useState(item.folder ?? "");
  const [tags, setTags] = useState(item.tags);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  const addPendingTag = () => {
    const next = tagInput.trim().replace(/^#/, "");
    if (next && !tags.includes(next) && tags.length < 20) {
      setTags((current) => [...current, next]);
    }
    setTagInput("");
  };

  const save = async () => {
    const pendingTag = tagInput.trim().replace(/^#/, "");
    const nextTags =
      pendingTag && !tags.includes(pendingTag) && tags.length < 20
        ? [...tags, pendingTag]
        : tags;
    setSaving(true);
    const saved = await onSave({ project, folder, tags: nextTags });
    setSaving(false);
    if (saved) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-[rgb(12_16_22_/_0.42)] p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="organize-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section className="w-full max-w-lg rounded-t-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-md)] sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.12em] text-[var(--accent)] uppercase">
              {t.organize}
            </p>
            <h2
              id="organize-title"
              className="mt-1 text-xl font-bold tracking-[-0.025em]"
            >
              {t.organizeItem}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              {t.organizeHint}
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
          <OrganizerField label={t.project}>
            <input
              value={project}
              maxLength={100}
              placeholder={t.projectPlaceholder}
              onChange={(event) => setProject(event.target.value)}
              className="organizer-input"
            />
          </OrganizerField>
          <OrganizerField label={t.folder}>
            <input
              value={folder}
              maxLength={240}
              placeholder={t.folderPlaceholder}
              onChange={(event) => setFolder(event.target.value)}
              className="organizer-input"
            />
          </OrganizerField>
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold text-[var(--muted)]">
            {t.tags}
          </label>
          <div className="mt-1.5 flex min-h-12 flex-wrap items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-2 focus-within:border-[var(--accent)] focus-within:ring-3 focus-within:ring-[var(--accent-ring)]">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--surface-2)] px-2 py-1 font-mono text-[11px]"
              >
                #{tag}
                <button
                  type="button"
                  aria-label={t.removeTag(tag)}
                  onClick={() =>
                    setTags((current) =>
                      current.filter((entry) => entry !== tag),
                    )
                  }
                  className="text-[var(--muted)] hover:text-[var(--accent)]"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              maxLength={50}
              placeholder={tags.length === 0 ? t.tagPlaceholder : ""}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addPendingTag();
                }
                if (event.key === "Backspace" && !tagInput && tags.length > 0) {
                  setTags((current) => current.slice(0, -1));
                }
              }}
              className="min-w-36 flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-[var(--muted-soft)]"
            />
          </div>
        </div>

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
            {saving ? t.saving : t.saveChanges}
          </button>
        </div>
      </section>
    </div>
  );
}

function OrganizerField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-xs font-semibold text-[var(--muted)]">
      {label}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

export function FolderIcon() {
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
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5Z" />
      <path d="M8 13h8M12 9v8" />
    </svg>
  );
}
