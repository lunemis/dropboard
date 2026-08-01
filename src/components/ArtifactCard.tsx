"use client";

import Link from "next/link";
import type { CategoryPreference } from "../lib/categories";
import { artifactCardState } from "../lib/artifactCard";
import { relTime, remainTime, t } from "../lib/i18n";
import type { ItemMeta, ItemStatus } from "../lib/types";
import { FolderIcon } from "./OrganizerDialog";
import {
  ArchiveIcon,
  KeepIcon,
  RestoreIcon,
  TrashIcon,
} from "./ItemActionIcons";
import { TypeSeal } from "./TypeSeal";

export function ArtifactCard({
  item,
  status,
  category,
  confirming,
  selecting,
  selected,
  onToggleSelected,
  onKeep,
  onDestroy,
  onMove,
  onOrganize,
}: {
  item: ItemMeta;
  status: ItemStatus;
  category: CategoryPreference;
  confirming: boolean;
  selecting: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  onKeep: () => void;
  onDestroy: () => void;
  onMove: (to: ItemStatus, message: string) => void;
  onOrganize: () => void;
}) {
  const state = artifactCardState(item, status);

  return (
    <li className="group">
      <div
        className={`artifact-card flex items-stretch gap-1 rounded-2xl border p-3.5 sm:p-4 ${
          selected
            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
            : state.unread
              ? "artifact-card--unread"
              : "border-[var(--line)]"
        }`}
      >
        {status === "library" && selecting && (
          <label className="flex shrink-0 items-center px-1">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelected}
              aria-label={t.selectItem(item.title)}
              className="h-5 w-5 rounded border-[var(--line)] accent-[var(--accent)]"
            />
          </label>
        )}
        <Link
          href={`/i/${item.id}`}
          className="flex min-w-0 flex-1 items-start gap-3.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          <TypeSeal
            type={item.type}
            temp={Boolean(item.expires_at)}
            category={category}
          />
          <div className="min-w-0 flex-1">
            <h2
              className={`line-clamp-2 text-[15px] leading-snug tracking-[-0.01em] sm:text-base ${state.unread ? "font-semibold" : "font-medium"}`}
            >
              {state.unread && (
                <span
                  aria-label={t.unreadDot}
                  className="unread-status mr-1.5 inline-flex align-middle font-mono text-[9px] font-bold uppercase"
                >
                  {t.unreadDot}
                </span>
              )}
              {item.pinned && (
                <span
                  aria-label={t.pin}
                  className="mr-1 inline-flex text-[var(--accent)]"
                >
                  <PinIcon />
                </span>
              )}
              {item.title}
            </h2>
            {item.summary && (
              <p className="mt-1 line-clamp-2 max-w-3xl text-[13px] leading-relaxed text-[var(--muted)] sm:text-sm">
                {item.summary}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] text-[var(--muted)] sm:text-[11px]">
              {item.expires_at && (
                <span className="metadata-chip metadata-chip--accent">
                  {remainTime(item.expires_at)}
                </span>
              )}
              {item.project && (
                <span className="metadata-chip">{item.project}</span>
              )}
              {item.folder && (
                <span className="metadata-chip">
                  {item.folder.replaceAll("/", " › ")}
                </span>
              )}
              {item.revision > 1 && (
                <span className="metadata-chip border-[color-mix(in_srgb,var(--violet)_24%,transparent)] bg-[var(--violet-soft)] font-semibold text-[var(--violet)]">
                  v{item.revision}
                </span>
              )}
              {item.view_mode === "presentation" && (
                <span className="metadata-chip border-[color-mix(in_srgb,var(--violet)_24%,transparent)] bg-[var(--violet-soft)] font-semibold text-[var(--violet)]">
                  {t.presentation}
                </span>
              )}
              {item.view_mode === "reader" && (
                <span className="metadata-chip border-[color-mix(in_srgb,var(--accent)_24%,transparent)] bg-[var(--accent-soft)] font-semibold text-[var(--accent)]">
                  {t.reader}
                </span>
              )}
              {item.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[var(--muted-soft)]">
                  #{tag}
                </span>
              ))}
              <time dateTime={item.created_at}>{relTime(item.created_at)}</time>
            </div>
          </div>
        </Link>
        <div className="card-actions flex flex-col justify-center">
          {state.actionMode === "temporary" ? (
            <>
              <IconBtn label={t.actionKeep} onClick={onKeep}>
                <KeepIcon />
              </IconBtn>
              {confirming ? (
                <ConfirmBtn onClick={onDestroy} />
              ) : (
                <IconBtn label={t.actionDelete} onClick={onDestroy}>
                  <TrashIcon />
                </IconBtn>
              )}
            </>
          ) : state.actionMode === "inbox" ? (
            <>
              <IconBtn
                label={t.actionArchive}
                onClick={() => onMove("archived", t.toastArchived)}
              >
                <ArchiveIcon />
              </IconBtn>
              <IconBtn
                label={t.actionToLibrary}
                onClick={() => onMove("library", t.toastToLibrary)}
              >
                <KeepIcon />
              </IconBtn>
              <IconBtn
                label={t.actionToTrash}
                onClick={() => onMove("trash", t.toastTrashed)}
              >
                <TrashIcon />
              </IconBtn>
            </>
          ) : state.actionMode === "archived" ? (
            <>
              <IconBtn
                label={t.actionToLibrary}
                onClick={() => onMove("library", t.toastToLibrary)}
              >
                <KeepIcon />
              </IconBtn>
              <IconBtn
                label={t.actionToInbox}
                onClick={() => onMove("inbox", t.toastToInbox)}
              >
                <RestoreIcon />
              </IconBtn>
              <IconBtn
                label={t.actionToTrash}
                onClick={() => onMove("trash", t.toastTrashed)}
              >
                <TrashIcon />
              </IconBtn>
            </>
          ) : state.actionMode === "library" ? (
            <>
              <IconBtn label={t.organize} onClick={onOrganize}>
                <FolderIcon />
              </IconBtn>
              <IconBtn
                label={t.actionArchive}
                onClick={() => onMove("archived", t.toastArchived)}
              >
                <ArchiveIcon />
              </IconBtn>
              <IconBtn
                label={t.actionToTrash}
                onClick={() => onMove("trash", t.toastTrashed)}
              >
                <TrashIcon />
              </IconBtn>
            </>
          ) : (
            <>
              <IconBtn
                label={t.actionRestore}
                onClick={() => onMove("inbox", t.toastRestored)}
              >
                <RestoreIcon />
              </IconBtn>
              {confirming ? (
                <ConfirmBtn onClick={onDestroy} />
              ) : (
                <IconBtn label={t.actionDelete} onClick={onDestroy}>
                  <TrashIcon />
                </IconBtn>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] active:scale-95"
    >
      {children}
    </button>
  );
}

function ConfirmBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-11 items-center justify-center rounded-full bg-[var(--accent)] px-2 text-xs font-semibold text-white"
    >
      {t.actionConfirm}
    </button>
  );
}

function PinIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9 3h6l-.6 5.2 3 3V14H13v7l-1 1-1-1v-7H6.6v-2.8l3-3L9 3Z" />
    </svg>
  );
}
