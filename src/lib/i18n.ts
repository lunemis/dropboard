export type Locale = "en" | "ko";

export const LOCALE: Locale =
  process.env.NEXT_PUBLIC_DOCKET_LOCALE === "ko" ? "ko" : "en";

const STRINGS = {
  en: {
    inbox: "Inbox",
    archive: "Archive",
    trash: "Trash",
    all: "All",
    unread: (n: number) => `${n} unread`,
    loading: "Loading…",
    search: "Search",
    noMatches: "No matching items",
    emptyInboxTitle: "All caught up",
    emptyInboxHint: "New deliverables will pile up here",
    emptyArchive: "Nothing archived",
    emptyTrash: "Trash is empty",
    trashNote: (d: number) => `Items are deleted permanently after ${d} days`,
    stamp: "DONE",
    tempGroup: "Temporary",
    actionKeep: "Keep",
    toastKept: "Kept — moved to inbox",
    actionArchive: "Archive",
    actionToTrash: "Move to trash",
    actionToInbox: "Move to inbox",
    actionRestore: "Restore",
    actionDelete: "Delete forever",
    actionConfirm: "Sure?",
    toastArchived: "Archived",
    toastTrashed: "Moved to trash",
    toastToInbox: "Moved to inbox",
    toastRestored: "Restored",
    toastDeleted: "Deleted forever",
    toastFailed: "Something went wrong",
    undo: "Undo",
    back: "Back",
    pin: "Pin",
    unpin: "Unpin",
    notFound: "Item not found",
    toInbox: "Go to inbox",
    unreadDot: "Unread",
    pinLabel: "PIN",
    pinPrompt: "Enter your 6-digit PIN",
    pinChecking: "Checking…",
    pinWrong: "Wrong PIN",
    pinWrongRemaining: (n: number) => `Wrong PIN (${n} tries left)`,
    pinLocked: (min: number) => `Too many attempts. Try again in ${min} min`,
    pinOffline: "Can't reach the server",
  },
  ko: {
    inbox: "받은함",
    archive: "보관함",
    trash: "휴지통",
    all: "전체",
    unread: (n: number) => `${n} 미읽음`,
    loading: "불러오는 중…",
    search: "검색",
    noMatches: "조건에 맞는 항목이 없습니다",
    emptyInboxTitle: "모두 확인했습니다",
    emptyInboxHint: "새 산출물이 게시되면 여기에 쌓입니다",
    emptyArchive: "보관된 항목이 없습니다",
    emptyTrash: "휴지통이 비어 있습니다",
    trashNote: (d: number) => `휴지통의 항목은 ${d}일 후 자동으로 삭제됩니다`,
    stamp: "완",
    tempGroup: "임시",
    actionKeep: "남기기",
    toastKept: "남겼습니다 — 받은함으로 이동",
    actionArchive: "보관",
    actionToTrash: "휴지통으로",
    actionToInbox: "받은함으로",
    actionRestore: "복원",
    actionDelete: "영구 삭제",
    actionConfirm: "확인",
    toastArchived: "보관했습니다",
    toastTrashed: "휴지통으로 옮겼습니다",
    toastToInbox: "받은함으로 옮겼습니다",
    toastRestored: "복원했습니다",
    toastDeleted: "영구 삭제했습니다",
    toastFailed: "처리하지 못했습니다",
    undo: "실행취소",
    back: "뒤로",
    pin: "핀 고정",
    unpin: "핀 해제",
    notFound: "항목을 찾을 수 없습니다",
    toInbox: "받은함으로",
    unreadDot: "미읽음",
    pinLabel: "PIN",
    pinPrompt: "PIN 6자리를 입력하세요",
    pinChecking: "확인 중…",
    pinWrong: "PIN이 올바르지 않습니다",
    pinWrongRemaining: (n: number) =>
      `PIN이 올바르지 않습니다 (남은 시도 ${n}회)`,
    pinLocked: (min: number) => `시도가 너무 많습니다. ${min}분 후 다시 시도하세요`,
    pinOffline: "서버에 연결할 수 없습니다",
  },
} as const;

export const t = STRINGS[LOCALE];

export const TYPE_LABELS: Record<
  string,
  { label: string; seal: string }
> = {
  review:
    LOCALE === "ko"
      ? { label: "검토", seal: "검" }
      : { label: "Review", seal: "REV" },
  decision:
    LOCALE === "ko"
      ? { label: "결정", seal: "결" }
      : { label: "Decision", seal: "DEC" },
  report:
    LOCALE === "ko"
      ? { label: "리포트", seal: "보" }
      : { label: "Report", seal: "RPT" },
  info:
    LOCALE === "ko"
      ? { label: "정보", seal: "정" }
      : { label: "Info", seal: "INF" },
  fun:
    LOCALE === "ko"
      ? { label: "재미", seal: "재" }
      : { label: "Fun", seal: "FUN" },
};

/** Time remaining until an expiry timestamp, compact (e.g. "1h 50m"). */
export function remainTime(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return LOCALE === "ko" ? "곧 삭제" : "expiring";
  const min = Math.ceil(ms / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/** Relative time, localized. */
export function relTime(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  const ko = LOCALE === "ko";
  if (diffMin < 1) return ko ? "방금" : "just now";
  if (diffMin < 60) return ko ? `${diffMin}분 전` : `${diffMin}m ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return ko ? `${h}시간 전` : `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return ko ? `${days}일 전` : `${days}d ago`;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}
