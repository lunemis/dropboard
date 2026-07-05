"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArchiveIcon,
  KeepIcon,
  RestoreIcon,
  TrashIcon,
} from "../../../components/Board";
import { remainTime, t } from "../../../lib/i18n";
import type { ItemMeta, ItemStatus } from "../../../lib/types";

const LIST_PATH: Record<ItemStatus, string> = {
  inbox: "/",
  archived: "/archive",
  trash: "/trash",
};

export default function ViewerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [meta, setMeta] = useState<ItemMeta | null>(null);
  const [rawUrl, setRawUrl] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/items/${id}`, { cache: "no-store" });
      if (!res.ok) {
        if (!cancelled) setNotFound(true);
        return;
      }
      const { item, raw_url } = (await res.json()) as {
        item: ItemMeta;
        raw_url?: string;
      };
      if (cancelled) return;
      setMeta(item);
      setRawUrl(raw_url ?? `/api/items/${id}/raw`);
      if (!item.read_at) {
        fetch(`/api/items/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ read: true }),
        }).catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const { item } = (await res.json()) as { item: ItemMeta };
    return item;
  };

  const togglePin = async () => {
    if (!meta) return;
    setMeta({ ...meta, pinned: !meta.pinned });
    const item = await patch({ pinned: !meta.pinned });
    if (item) setMeta(item);
  };

  const moveTo = async (status: ItemStatus) => {
    if (!meta) return;
    await patch({ status });
    router.push(LIST_PATH[meta.status]);
  };

  const keepItem = async () => {
    const item = await patch({ keep: true });
    if (item) setMeta(item);
  };

  const destroyTemp = async () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    router.push("/");
  };

  if (notFound) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-sm text-[var(--muted)]">{t.notFound}</p>
        <Link href="/" className="text-sm font-semibold underline">
          {t.toInbox}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-[var(--line)] bg-[var(--bg)] px-2">
        <button
          aria-label={t.back}
          onClick={() =>
            meta ? router.push(LIST_PATH[meta.status]) : router.push("/")
          }
          className="flex h-11 w-11 items-center justify-center rounded-full active:bg-[var(--surface-2)]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {meta?.title ?? ""}
        </h1>
        {meta && meta.expires_at && (
          <div className="flex shrink-0 items-center gap-1">
            <span className="font-mono text-[11px] text-[var(--accent)]">
              ⏳ {remainTime(meta.expires_at)}
            </span>
            <button
              aria-label={t.actionKeep}
              title={t.actionKeep}
              onClick={keepItem}
              className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--muted)] active:bg-[var(--surface-2)]"
            >
              <KeepIcon />
            </button>
            {confirming ? (
              <button
                onClick={destroyTemp}
                className="flex h-11 items-center justify-center rounded-full bg-[var(--accent)] px-3 text-xs font-semibold text-white"
              >
                {t.actionConfirm}
              </button>
            ) : (
              <button
                aria-label={t.actionDelete}
                title={t.actionDelete}
                onClick={destroyTemp}
                className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--muted)] active:bg-[var(--surface-2)]"
              >
                <TrashIcon />
              </button>
            )}
          </div>
        )}
        {meta && !meta.expires_at && (
          <div className="flex shrink-0 items-center">
            <button
              aria-label={meta.pinned ? t.unpin : t.pin}
              onClick={togglePin}
              className={`flex h-11 w-11 items-center justify-center rounded-full active:bg-[var(--surface-2)] ${
                meta.pinned ? "text-[var(--accent)]" : "text-[var(--muted)]"
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={meta.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 17v5" />
                <path d="M9 10.8V6a3 3 0 1 1 6 0v4.8l2 2.2v2H7v-2l2-2.2Z" />
              </svg>
            </button>
            {meta.status !== "archived" && meta.status !== "trash" && (
              <button
                aria-label={t.actionArchive}
                onClick={() => moveTo("archived")}
                className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--muted)] active:bg-[var(--surface-2)]"
              >
                <ArchiveIcon />
              </button>
            )}
            {meta.status !== "inbox" && (
              <button
                aria-label={t.actionToInbox}
                onClick={() => moveTo("inbox")}
                className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--muted)] active:bg-[var(--surface-2)]"
              >
                <RestoreIcon />
              </button>
            )}
            {meta.status !== "trash" && (
              <button
                aria-label={t.actionToTrash}
                onClick={() => moveTo("trash")}
                className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--muted)] active:bg-[var(--surface-2)]"
              >
                <TrashIcon />
              </button>
            )}
          </div>
        )}
      </header>
      {meta && rawUrl ? (
        <iframe
          sandbox="allow-scripts"
          src={rawUrl}
          title={meta.title}
          className="w-full flex-1 border-0 bg-white"
        />
      ) : (
        <p className="py-16 text-center text-sm text-[var(--muted)]">
          {t.loading}
        </p>
      )}
    </div>
  );
}
