"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultCategorySettings,
  type CategoryPreference,
  type CategorySettings,
} from "../lib/categories";
import { t } from "../lib/i18n";
import { buildLibraryIndex, matchesLibrarySelection } from "../lib/library";
import type { ItemMeta, ItemStatus, ItemType } from "../lib/types";
import { useStoredChoice } from "../lib/useStoredChoice";
import { ArtifactCard } from "./ArtifactCard";
import { Brand } from "./Brand";
import {
  BulkOrganizerDialog,
  type BulkOrganizationValues,
} from "./BulkOrganizerDialog";
import { LibraryNavigator } from "./LibraryNavigator";
import { OrganizerDialog, type OrganizationValues } from "./OrganizerDialog";

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
  const [organizingItem, setOrganizingItem] = useState<ItemMeta | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOrganizing, setBulkOrganizing] = useState(false);
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

  const saveOrganization = async (values: OrganizationValues) => {
    if (!organizingItem) return false;
    try {
      const response = await fetch(`/api/items/${organizingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error(`save failed (${response.status})`);
      const { item } = (await response.json()) as { item: ItemMeta };
      setItems(
        (current) =>
          current?.map((entry) => (entry.id === item.id ? item : entry)) ??
          null,
      );
      showToast({ msg: t.organizationSaved });
      return true;
    } catch {
      showToast({ msg: t.toastFailed });
      return false;
    }
  };

  const saveBulkOrganization = async (values: BulkOrganizationValues) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return false;
    try {
      const response = await fetch("/api/items/bulk-organize", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_ids: ids, ...values }),
      });
      if (!response.ok) throw new Error(`save failed (${response.status})`);
      const { items: updated } = (await response.json()) as {
        items: ItemMeta[];
      };
      const updatedById = new Map(updated.map((item) => [item.id, item]));
      setItems(
        (current) =>
          current?.map((item) => updatedById.get(item.id) ?? item) ?? null,
      );
      setSelectedIds(new Set());
      setSelecting(false);
      showToast({ msg: t.bulkMoved(ids.length) });
      return true;
    } catch {
      await load();
      showToast({ msg: t.toastFailed });
      return false;
    }
  };

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
  const toggleSelecting = () => {
    setSelecting((current) => {
      if (current) setSelectedIds(new Set());
      return !current;
    });
  };
  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectVisible = () =>
    setSelectedIds(new Set(regular.map((item) => item.id)));

  const card = (item: ItemMeta) => (
    <ArtifactCard
      key={item.id}
      item={item}
      status={status}
      category={categoryById[item.type]}
      confirming={confirmingId === item.id}
      selecting={selecting}
      selected={selectedIds.has(item.id)}
      onToggleSelected={() => toggleSelected(item.id)}
      onKeep={() => keep(item)}
      onDestroy={() => destroy(item)}
      onMove={(to, message) => move(item, to, message)}
      onOrganize={() => setOrganizingItem(item)}
    />
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
          selecting={selecting}
          selectedCount={selectedIds.size}
          onToggleSelecting={toggleSelecting}
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
      {status === "archived" && selecting && (
        <div className="fixed inset-x-0 bottom-5 z-20 flex justify-center px-3">
          <div className="flex w-full max-w-lg items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[var(--shadow-md)]">
            <span className="min-w-0 flex-1 px-2 text-sm font-semibold">
              {t.selected(selectedIds.size)}
            </span>
            <button
              type="button"
              onClick={selectVisible}
              className="rounded-xl px-3 py-2 text-xs text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            >
              {t.selectVisible}
            </button>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="rounded-xl px-3 py-2 text-xs text-[var(--muted)] hover:bg-[var(--surface-hover)]"
              >
                {t.clearSelection}
              </button>
            )}
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => setBulkOrganizing(true)}
              className="rounded-xl bg-[var(--ink)] px-3.5 py-2 text-xs font-semibold text-[var(--bg)] disabled:opacity-35"
            >
              {t.moveSelected}
            </button>
          </div>
        </div>
      )}
      {organizingItem && (
        <OrganizerDialog
          item={organizingItem}
          onClose={() => setOrganizingItem(null)}
          onSave={saveOrganization}
        />
      )}
      {bulkOrganizing && (
        <BulkOrganizerDialog
          count={selectedIds.size}
          onClose={() => setBulkOrganizing(false)}
          onSave={saveBulkOrganization}
        />
      )}
    </div>
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
