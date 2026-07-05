"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { relTime, remainTime, t, TYPE_LABELS } from "../lib/i18n";
import type { ItemMeta, ItemStatus, ItemType } from "../lib/types";
import { TypeSeal } from "./TypeSeal";

const TABS: { href: string; label: string; status: ItemStatus }[] = [
  { href: "/", label: t.inbox, status: "inbox" },
  { href: "/archive", label: t.archive, status: "archived" },
  { href: "/trash", label: t.trash, status: "trash" },
];

const TYPE_KEYS = Object.keys(TYPE_LABELS) as ItemType[];

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
    item.tags.some((tag) => tag.toLowerCase().includes(s))
  );
}

export default function Board({ status }: { status: ItemStatus }) {
  const [items, setItems] = useState<ItemMeta[] | null>(null);
  const [typeFilter, setTypeFilter] = useState<ItemType | "all">("all");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/items?status=${status}`, {
        cache: "no-store",
      });
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = useCallback((toastValue: Toast) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(toastValue);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const move = useCallback(
    async (item: ItemMeta, to: ItemStatus, msg: string) => {
      setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? null);
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      });
      if (!res.ok) {
        showToast({ msg: t.toastFailed });
        load();
        return;
      }
      showToast({
        msg,
        undo: async () => {
          setToast(null);
          await fetch(`/api/items/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: item.status }),
          });
          load();
        },
      });
    },
    [load, showToast],
  );

  const keep = useCallback(
    async (item: ItemMeta) => {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keep: true }),
      });
      if (!res.ok) {
        showToast({ msg: t.toastFailed });
        return;
      }
      showToast({ msg: t.toastKept });
      load();
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
      const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        showToast({ msg: t.toastFailed });
        load();
        return;
      }
      showToast({ msg: t.toastDeleted });
    },
    [confirmingId, load, showToast],
  );

  const now = Date.now();
  const visible =
    items?.filter(
      (i) =>
        (typeFilter === "all" || i.type === typeFilter) &&
        matchesQuery(i, query) &&
        (!i.expires_at || new Date(i.expires_at).getTime() > now),
    ) ?? null;
  const temps = visible?.filter((i) => i.expires_at) ?? [];
  const regular = visible?.filter((i) => !i.expires_at) ?? [];
  const unreadCount =
    status === "inbox" ? (items?.filter((i) => !i.read_at).length ?? 0) : 0;

  const card = (item: ItemMeta) => (
    <li key={item.id}>
      <div className="flex items-stretch gap-1 rounded-xl bg-[var(--surface)] p-3">
        <Link
          href={`/i/${item.id}`}
          className="flex min-w-0 flex-1 items-start gap-3"
        >
          <TypeSeal type={item.type} temp={Boolean(item.expires_at)} />
          <div className="min-w-0 flex-1">
            <h2
              className={`line-clamp-2 text-[15px] leading-snug ${
                !item.read_at && status === "inbox"
                  ? "font-semibold"
                  : "font-medium"
              }`}
            >
              {!item.read_at && status === "inbox" && (
                <span
                  aria-label={t.unreadDot}
                  className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--accent)] align-middle"
                />
              )}
              {item.pinned && (
                <span className="mr-1 text-[var(--accent)]">📌</span>
              )}
              {item.title}
            </h2>
            {item.summary && (
              <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-[var(--muted)]">
                {item.summary}
              </p>
            )}
            <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">
              {item.expires_at && (
                <span className="text-[var(--accent)]">
                  ⏳ {remainTime(item.expires_at)}
                  {" · "}
                </span>
              )}
              {item.project ? `${item.project} · ` : ""}
              {relTime(item.created_at)}
            </p>
          </div>
        </Link>
        <div className="flex flex-col justify-center">
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
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--bg)]/90 px-4 pt-4 backdrop-blur">
        <div className="flex items-baseline justify-between">
          <h1 className="font-mono text-lg font-bold tracking-tight">
            docket<span className="text-[var(--accent)]">_</span>
          </h1>
          {unreadCount > 0 && (
            <span className="font-mono text-xs text-[var(--accent)]">
              {t.unread(unreadCount)}
            </span>
          )}
        </div>
        <nav className="mt-2 flex gap-5 text-[15px]">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                tab.status === status
                  ? "border-b-2 border-[var(--ink)] pb-2 font-semibold"
                  : "pb-2 text-[var(--muted)]"
              }
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>

      {items !== null && items.length > 0 && (
        <div className="flex flex-col gap-2 px-4 py-3">
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
              className="h-10 w-full rounded-full bg-[var(--surface)] pr-4 pl-10 text-sm outline-none placeholder:text-[var(--muted)]"
            />
          </div>
          <div className="scrollbar-none flex gap-2 overflow-x-auto">
            <FilterChip
              active={typeFilter === "all"}
              onClick={() => setTypeFilter("all")}
            >
              {t.all}
            </FilterChip>
            {TYPE_KEYS.map((k) => (
              <FilterChip
                key={k}
                active={typeFilter === k}
                onClick={() => setTypeFilter(typeFilter === k ? "all" : k)}
              >
                {TYPE_LABELS[k].label}
              </FilterChip>
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 px-4 pb-24">
        {visible === null ? (
          <p className="py-16 text-center text-sm text-[var(--muted)]">
            {t.loading}
          </p>
        ) : visible.length === 0 ? (
          <EmptyState status={status} filtered={Boolean(items?.length)} />
        ) : (
          <div className="flex flex-col gap-2 pt-1">
            {temps.length > 0 && (
              <>
                <p className="mt-1 px-1 font-mono text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  {t.tempGroup}
                </p>
                <ul className="flex flex-col gap-2">{temps.map(card)}</ul>
                {regular.length > 0 && (
                  <div className="mt-2 border-t border-[var(--line)]" />
                )}
              </>
            )}
            <ul className="flex flex-col gap-2">{regular.map(card)}</ul>
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
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] ${
        active
          ? "bg-[var(--ink)] font-semibold text-[var(--bg)]"
          : "bg-[var(--surface)] text-[var(--muted)]"
      }`}
    >
      {children}
    </button>
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
      <p className="py-16 text-center text-sm text-[var(--muted)]">
        {t.noMatches}
      </p>
    );
  }
  if (status === "inbox") {
    return (
      <div className="flex flex-col items-center py-24">
        <div className="-rotate-6 rounded-lg border-[3px] border-[var(--accent)] px-4 py-1.5 font-mono text-2xl font-bold text-[var(--accent)] opacity-80">
          {t.stamp}
        </div>
        <p className="mt-6 text-sm font-medium">{t.emptyInboxTitle}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{t.emptyInboxHint}</p>
      </div>
    );
  }
  return (
    <div className="py-24 text-center">
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
      className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--muted)] active:bg-[var(--surface-2)]"
    >
      {children}
    </button>
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
