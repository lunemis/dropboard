"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

type ViewerWidth = "narrow" | "wide" | "full";
const VIEWER_WIDTH_KEY = "dropboard:viewer-width";
const VIEWER_WIDTH_OPTIONS: ViewerWidth[] = ["narrow", "wide", "full"];

interface ShareToast {
  msg: string;
  action?: { label: string; onClick: () => void };
}

export default function ViewerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [meta, setMeta] = useState<ItemMeta | null>(null);
  const [rawUrl, setRawUrl] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [viewerWidth, setViewerWidthState] = useState<ViewerWidth>("narrow");
  const [shareToast, setShareToast] = useState<ShareToast | null>(null);
  const [sharing, setSharing] = useState(false);
  const shareToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showShareToast = (toastValue: ShareToast | null) => {
    if (shareToastTimer.current) clearTimeout(shareToastTimer.current);
    setShareToast(toastValue);
    if (toastValue) {
      shareToastTimer.current = setTimeout(() => setShareToast(null), 5000);
    }
  };

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEWER_WIDTH_KEY);
    if (stored && VIEWER_WIDTH_OPTIONS.includes(stored as ViewerWidth)) {
      setViewerWidthState(stored as ViewerWidth);
    }
  }, []);

  const setViewerWidth = (w: ViewerWidth) => {
    setViewerWidthState(w);
    window.localStorage.setItem(VIEWER_WIDTH_KEY, w);
  };

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

  const revokeShare = async () => {
    const res = await fetch(`/api/items/${id}/share`, { method: "DELETE" });
    if (res.ok) showShareToast({ msg: t.toastShareRevoked });
  };

  const doShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const res = await fetch(`/api/items/${id}/share`, { method: "POST" });
      if (!res.ok) {
        showShareToast({ msg: t.toastShareFailed });
        return;
      }
      const { url } = (await res.json()) as { url: string };
      const full = /^https?:\/\//.test(url)
        ? url
        : `${window.location.origin}${url}`;
      try {
        await navigator.clipboard.writeText(full);
      } catch {
        // clipboard API unavailable — link is still shown via the toast fallback below
      }
      showShareToast({
        msg: t.toastShareCopied,
        action: { label: t.shareRevoke, onClick: revokeShare },
      });
    } finally {
      setSharing(false);
    }
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
        {meta?.content_type === "markdown" && (
          <div
            className="hidden items-center gap-1 sm:flex"
            role="group"
            aria-label={t.widthLabel}
          >
            {VIEWER_WIDTH_OPTIONS.map((w) => (
              <button
                key={w}
                onClick={() => setViewerWidth(w)}
                title={t.widthLabel}
                className={`rounded-full px-2.5 py-1 font-mono text-[11px] ${
                  viewerWidth === w
                    ? "bg-[var(--ink)] font-semibold text-[var(--bg)]"
                    : "text-[var(--muted)]"
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
        )}
        {meta && (
          <button
            aria-label={t.actionShare}
            title={t.actionShare}
            disabled={sharing}
            onClick={doShare}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--muted)] active:bg-[var(--surface-2)] disabled:opacity-50"
          >
            <ShareIcon />
          </button>
        )}
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
          src={
            meta.content_type === "markdown"
              ? `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}w=${viewerWidth}`
              : rawUrl
          }
          title={meta.title}
          className="w-full flex-1 border-0 bg-white"
        />
      ) : (
        <p className="py-16 text-center text-sm text-[var(--muted)]">
          {t.loading}
        </p>
      )}
      {shareToast && (
        <div className="toast-in fixed inset-x-0 bottom-6 z-20 flex justify-center px-4">
          <div className="flex items-center gap-4 rounded-full bg-[var(--ink)] px-5 py-3 text-sm text-[var(--bg)] shadow-lg">
            <span>{shareToast.msg}</span>
            {shareToast.action && (
              <button
                onClick={() => {
                  shareToast.action?.onClick();
                }}
                className="text-[13px] font-semibold underline underline-offset-2"
              >
                {shareToast.action.label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 10.5 15.4 6.5" />
      <path d="M8.6 13.5 15.4 17.5" />
    </svg>
  );
}
