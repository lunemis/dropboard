"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultCategorySettings,
  type CategoryPreference,
  type CategorySettings,
} from "../lib/categories";
import { relTime, remainTime, t } from "../lib/i18n";
import {
  buildLibraryIndex,
  matchesLibrarySelection,
} from "../lib/library";
import type { ItemMeta, ItemStatus, ItemType } from "../lib/types";
import { useStoredChoice } from "../lib/useStoredChoice";
import { Brand } from "./Brand";
import { LibraryNavigator } from "./LibraryNavigator";
import { TypeSeal } from "./TypeSeal";

const TABS: { href: string; label: string; status: ItemStatus }[] = [
  { href: "/", label: t.inbox, status: "inbox" },
  { href: "/archive", label: t.archive, status: "archived" },
  { href: "/trash", label: t.trash, status: "trash" },
];

type BoardWidth = "narrow" | "wide" | "full";
const WIDTH_STORAGE_KEY = "dropboard:board-width";
const WIDTH_PX: Record<BoardWidth, string> = {
  narrow: "42rem",
  wide: "72rem",
  full: "100%",
};
const WIDTH_OPTIONS: BoardWidth[] = ["narrow", "wide", "full"];

interface Toast {
  msg: string;
  undo?: () => void;
}

function matchesQuery(item: ItemMeta, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return (
    item.title.toLowerCase().includes(s) ||
    item.summary.toLowerCase().includes(s) ||
    (item.project ?? "").toLowerCase().includes(s) ||
    (item.folder ?? "").toLowerCase().includes(s) ||
    item.tags.some((tag) => tag.toLowerCase().includes(s))
  );
}

async function fetchItems(status: ItemStatus): Promise<ItemMeta[]> {
  const items: ItemMeta[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const params = new URLSearchParams({
      status,
      limit: "500",
      offset: String(offset),
    });
    const res = await fetch(`/api/items?${params}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`failed to load items (${res.status})`);
    const data = (await res.json()) as {
      items?: ItemMeta[];
      has_more?: boolean;
    };
    const page = data.items ?? [];
    items.push(...page);
    offset += page.length;
    hasMore = Boolean(data.has_more) && page.length > 0;
  }
  return items;
}

async function fetchCategories(): Promise<CategoryPreference[]> {
  const response = await fetch("/api/settings/categories", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`failed to load categories (${response.status})`);
  }
  return ((await response.json()) as CategorySettings).categories;
}

export default function Board({ status }: { status: ItemStatus }) {
  const [items, setItems] = useState<ItemMeta[] | null>(null);
  const [categories, setCategories] = useState<CategoryPreference[]>(
    defaultCategorySettings().categories,
  );
  const [loadFailed, setLoadFailed] = useState(false);
  const [typeFilter, setTypeFilter] = useState<ItemType | "all">("all");
  const [query, setQuery] = useState("");
  const [librarySelection, setLibrarySelection] = useState("all");
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [now, setNow] = useState(0);
  const [boardWidth, setBoardWidth] = useStoredChoice(
    WIDTH_STORAGE_KEY,
    WIDTH_OPTIONS,
    "wide",
  );

  const load = useCallback(async () => {
    try {
      setItems(await fetchItems(status));
      setLoadFailed(false);
    } catch {
      setItems([]);
      setLoadFailed(true);
    }
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchItems(status),
      fetchCategories().catch(() => defaultCategorySettings().categories),
    ])
      .then(([nextItems, nextCategories]) => {
        if (!cancelled) {
          setItems(nextItems);
          setCategories(nextCategories);
          setLoadFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setLoadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const showToast = useCallback((toastValue: Toast) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(toastValue);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const move = useCallback(
    async (item: ItemMeta, to: ItemStatus, msg: string) => {
      setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? null);
      try {
        const res = await fetch(`/api/items/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: to }),
        });
        if (!res.ok) throw new Error(`move failed (${res.status})`);
      } catch {
        showToast({ msg: t.toastFailed });
        await load();
        return;
      }
      showToast({
        msg,
        undo: async () => {
          setToast(null);
          try {
            const res = await fetch(`/api/items/${item.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: item.status }),
            });
            if (!res.ok) throw new Error(`undo failed (${res.status})`);
            await load();
          } catch {
            showToast({ msg: t.toastFailed });
          }
        },
      });
    },
    [load, showToast],
  );

  const keep = useCallback(
    async (item: ItemMeta) => {
      try {
        const res = await fetch(`/api/items/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keep: true }),
        });
        if (!res.ok) throw new Error(`keep failed (${res.status})`);
      } catch {
        showToast({ msg: t.toastFailed });
        return;
      }
      showToast({ msg: t.toastKept });
      await load();
    },
    [load, showToast],
  );

  const destroy = useCallback(
    async (item: ItemMeta) => {
      if (confirmingId !== item.id) {
        setConfirmingId(item.id);
        if (confirmTimer.current) clearTimeout(confirmTimer.current);
        confirmTimer.current = setTimeout(() => setConfirmingId(null), 3000);
        return;
      }
      setConfirmingId(null);
      setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? null);
      try {
        const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`delete failed (${res.status})`);
      } catch {
        showToast({ msg: t.toastFailed });
        await load();
        return;
      }
      showToast({ msg: t.toastDeleted });
    },
    [confirmingId, load, showToast],
  );

  const visible =
    items?.filter(
      (i) =>
        (typeFilter === "all" || i.type === typeFilter) &&
        (status !== "archived" ||
          matchesLibrarySelection(i, librarySelection)) &&
        matchesQuery(i, query) &&
        (!i.expires_at || new Date(i.expires_at).getTime() > now),
    ) ?? null;
  const temps = visible?.filter((i) => i.expires_at) ?? [];
  const regular = visible?.filter((i) => !i.expires_at) ?? [];
  const unreadCount =
    status === "inbox" ? (items?.filter((i) => !i.read_at).length ?? 0) : 0;
  const categoryById = Object.fromEntries(
    categories.map((category) => [category.id, category]),
  ) as Record<ItemType, CategoryPreference>;
  const visibleCategories = categories.filter((category) => !category.hidden);
  const libraryIndex = buildLibraryIndex(items ?? []);

  const card = (item: ItemMeta) => (
    <li key={item.id} className="group">
      <div
        className={`artifact-card flex items-stretch gap-1 rounded-2xl border p-3.5 sm:p-4 ${
          !item.read_at && status === "inbox"
            ? "artifact-card--unread"
            : "border-[var(--line)]"
        }`}
      >
        <Link
          href={`/i/${item.id}`}
          className="flex min-w-0 flex-1 items-start gap-3.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          <TypeSeal
            type={item.type}
            temp={Boolean(item.expires_at)}
            category={categoryById[item.type]}
          />
          <div className="min-w-0 flex-1">
            <h2
              className={`line-clamp-2 text-[15px] leading-snug tracking-[-0.01em] sm:text-base ${
                !item.read_at && status === "inbox"
                  ? "font-semibold"
                  : "font-medium"
              }`}
            >
              {!item.read_at && status === "inbox" && (
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
          {item.expires_at ? (
            <>
              <IconBtn label={t.actionKeep} onClick={() => keep(item)}>
                <KeepIcon />
              </IconBtn>
              {confirmingId === item.id ? (
                <ConfirmBtn onClick={() => destroy(item)} />
              ) : (
                <IconBtn label={t.actionDelete} onClick={() => destroy(item)}>
                  <TrashIcon />
                </IconBtn>
              )}
            </>
          ) : status === "inbox" ? (
            <>
              <IconBtn
                label={t.actionArchive}
                onClick={() => move(item, "archived", t.toastArchived)}
              >
                <ArchiveIcon />
              </IconBtn>
              <IconBtn
                label={t.actionToTrash}
                onClick={() => move(item, "trash", t.toastTrashed)}
              >
                <TrashIcon />
              </IconBtn>
            </>
          ) : status === "archived" ? (
            <>
              <IconBtn
                label={t.actionToInbox}
                onClick={() => move(item, "inbox", t.toastToInbox)}
              >
                <RestoreIcon />
              </IconBtn>
              <IconBtn
                label={t.actionToTrash}
                onClick={() => move(item, "trash", t.toastTrashed)}
              >
                <TrashIcon />
              </IconBtn>
            </>
          ) : (
            <>
              <IconBtn
                label={t.actionRestore}
                onClick={() => move(item, "inbox", t.toastRestored)}
              >
                <RestoreIcon />
              </IconBtn>
              {confirmingId === item.id ? (
                <ConfirmBtn onClick={() => destroy(item)} />
              ) : (
                <IconBtn label={t.actionDelete} onClick={() => destroy(item)}>
                  <TrashIcon />
                </IconBtn>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );

  return (
    <div
      className="board-layout mx-auto flex w-full flex-1 flex-col"
      style={{ maxWidth: WIDTH_PX[boardWidth] }}
    >
      <header className="sticky top-0 z-10 px-3 pt-3 sm:px-5 sm:pt-5">
        <div className="board-chrome overflow-hidden rounded-2xl border border-[var(--line)]">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <h1>
                <Brand compact />
              </h1>
              <p className="mt-0.5 hidden text-xs text-[var(--muted)] sm:block">
                {t.brandTagline}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              {unreadCount > 0 && (
                <span className="unread-badge font-mono text-[11px] font-semibold">
                  {t.unread(unreadCount)}
                </span>
              )}
              <Link
                href="/settings/categories"
                aria-label={t.categorySettings}
                title={t.categorySettings}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
              >
                <SettingsIcon />
              </Link>
              <div
                className="width-control hidden items-center gap-0.5 rounded-full border border-[var(--line)] p-0.5 sm:flex"
                role="group"
                aria-label={t.widthLabel}
              >
                {WIDTH_OPTIONS.map((w) => (
                  <button
                    key={w}
                    onClick={() => setBoardWidth(w)}
                    title={t.widthLabel}
                    className={`rounded-full px-2.5 py-1 font-mono text-[10px] transition-colors ${
                      boardWidth === w
                        ? "bg-[var(--ink)] font-semibold text-[var(--bg)] shadow-sm"
                        : "text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {w === "narrow"
                      ? t.widthNarrow
                      : w === "wide"
                        ? t.widthWide
                        : t.widthFull}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <nav className="flex gap-1 border-t border-[var(--line)] px-2 py-1.5 text-sm sm:px-3">
            {TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  tab.status === status
                    ? "bg-[var(--surface-2)] font-semibold text-[var(--ink)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {status === "archived" && items !== null && items.length > 0 && (
        <LibraryNavigator
          index={libraryIndex}
          total={items.length}
          selection={librarySelection}
          onSelect={setLibrarySelection}
        />
      )}

      {items !== null && items.length > 0 && (
        <div className="mx-3 mt-3 flex flex-col gap-2.5 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-3 sm:mx-5 sm:mt-4 sm:p-4">
          <div className="relative">
            <svg
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[var(--muted)]"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.search}
              aria-label={t.search}
              className="search-field h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] pr-4 pl-10 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-ring)]"
            />
          </div>
          <div className="scrollbar-none flex gap-2 overflow-x-auto">
            <FilterChip
              active={typeFilter === "all"}
              onClick={() => setTypeFilter("all")}
            >
              {t.all}
            </FilterChip>
            {visibleCategories.map((category) => (
              <FilterChip
                key={category.id}
                active={typeFilter === category.id}
                color={category.color}
                onClick={() =>
                  setTypeFilter(
                    typeFilter === category.id ? "all" : category.id,
                  )
                }
              >
                {category.label}
              </FilterChip>
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 px-3 pb-24 sm:px-5">
        {loadFailed ? (
          <p className="py-16 text-center text-sm text-[var(--muted)]">
            {t.loadFailed}
          </p>
        ) : visible === null ? (
          <p className="py-16 text-center text-sm text-[var(--muted)]">
            {t.loading}
          </p>
        ) : visible.length === 0 ? (
          <EmptyState status={status} filtered={Boolean(items?.length)} />
        ) : (
          <div className="flex flex-col gap-2.5 pt-3 sm:pt-4">
            {temps.length > 0 && (
              <>
                <p className="mt-1 px-1 font-mono text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  {t.tempGroup}
                </p>
                <ul className="flex flex-col gap-2.5">{temps.map(card)}</ul>
                {regular.length > 0 && (
                  <div className="mt-2 border-t border-[var(--line)]" />
                )}
              </>
            )}
            <ul className="flex flex-col gap-2.5">{regular.map(card)}</ul>
          </div>
        )}
      </main>

      {toast && (
        <div className="toast-in fixed inset-x-0 bottom-6 z-20 flex justify-center px-4">
          <div className="flex items-center gap-4 rounded-full bg-[var(--ink)] px-5 py-3 text-sm text-[var(--bg)] shadow-lg">
            <span>{toast.msg}</span>
            {toast.undo && (
              <button
                onClick={toast.undo}
                className="text-[13px] font-semibold underline underline-offset-2"
              >
                {t.undo}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
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

function FilterChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-lg border px-3 py-1.5 text-[12px] transition-colors ${
        active
          ? "border-[var(--ink)] bg-[var(--ink)] font-semibold text-[var(--bg)]"
          : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]"
      }`}
    >
      {color && (
        <span
          aria-hidden="true"
          className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
          style={{ background: color }}
        />
      )}
      {children}
    </button>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

function EmptyState({
  status,
  filtered,
}: {
  status: ItemStatus;
  filtered: boolean;
}) {
  if (filtered) {
    return (
      <p className="empty-panel my-4 rounded-2xl border border-dashed border-[var(--line-strong)] py-16 text-center text-sm text-[var(--muted)]">
        {t.noMatches}
      </p>
    );
  }
  if (status === "inbox") {
    return (
      <div className="empty-panel my-4 flex flex-col items-center rounded-2xl border border-dashed border-[var(--line-strong)] py-20">
        <div className="-rotate-4 rounded-lg border-2 border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-1.5 font-mono text-xl font-bold text-[var(--accent)]">
          {t.stamp}
        </div>
        <p className="mt-6 text-sm font-medium">{t.emptyInboxTitle}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{t.emptyInboxHint}</p>
      </div>
    );
  }
  return (
    <div className="empty-panel my-4 rounded-2xl border border-dashed border-[var(--line-strong)] py-20 text-center">
      <p className="text-sm text-[var(--muted)]">
        {status === "archived" ? t.emptyArchive : t.emptyTrash}
      </p>
      {status === "trash" && (
        <p className="mt-1 text-xs text-[var(--muted)]">{t.trashNote(30)}</p>
      )}
    </div>
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

export function ArchiveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14" />
    </svg>
  );
}

export function RestoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M12 17v-5" />
      <path d="m9.5 14 2.5-2.5L14.5 14" />
    </svg>
  );
}

export function KeepIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-6-3.5L6 21Z" />
    </svg>
  );
}
