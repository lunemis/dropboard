export type Locale = "en" | "ko";

export const LOCALE: Locale =
  process.env.NEXT_PUBLIC_DROPBOARD_LOCALE === "ko" ? "ko" : "en";

const STRINGS = {
  en: {
    brandTagline: "A calm review space for AI deliverables",
    inbox: "Inbox",
    archive: "Archive",
    trash: "Trash",
    all: "All",
    unread: (n: number) => `${n} unread`,
    loading: "Loading…",
    loadFailed: "Couldn't load items. Please try again.",
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
    pinPrivacy: "Private by default · your PIN stays on this server",
    pinChecking: "Checking…",
    pinWrong: "Wrong PIN",
    pinWrongRemaining: (n: number) => `Wrong PIN (${n} tries left)`,
    pinLocked: (min: number) => `Too many attempts. Try again in ${min} min`,
    pinOffline: "Can't reach the server",
    widthLabel: "Width",
    widthNarrow: "Narrow",
    widthWide: "Wide",
    widthFull: "Full",
    actionShare: "Share",
    toastShareCopied: "Share link copied — valid for 24h",
    toastShareRevoked: "Share link deactivated",
    toastShareFailed: "Couldn't create share link",
    shareRevoke: "Deactivate link",
    shareExpired: "This share link has expired or was deactivated",
    shareInvalid: "Invalid share link",
    settings: "Settings",
    categorySettings: "Categories",
    categorySettingsHint:
      "Customize how categories look without changing the stable IDs used by AI and the CLI.",
    categoryStableId: "Stable ID",
    categoryLabel: "Display name",
    categoryColor: "Color",
    categoryVisible: "Show in filters",
    categoryHiddenHint: "Hidden categories remain valid for publishing and existing items.",
    moveUp: "Move up",
    moveDown: "Move down",
    resetDefaults: "Reset defaults",
    saveChanges: "Save changes",
    saving: "Saving…",
    settingsSaved: "Saved",
    settingsSaveFailed: "Couldn't save settings. Please try again.",
    settingsLoadFailed: "Couldn't load settings. Defaults are shown.",
    organize: "Organize",
    organizeItem: "Organize item",
    organizeHint: "Choose where this item belongs. Use / for nested folders.",
    project: "Project",
    projectPlaceholder: "e.g. Dropboard",
    folder: "Folder",
    folderPlaceholder: "e.g. Research/Competitors",
    tags: "Tags",
    tagPlaceholder: "Type a tag and press Enter",
    removeTag: (tag: string) => `Remove ${tag}`,
    cancel: "Cancel",
    organizationSaved: "Organization updated",
    library: "Library",
    libraryHint: "Filed by project and folder",
    allItems: "All items",
    unfiled: "Unfiled",
    rootFolders: "Folders",
    versions: "Versions",
    versionHistory: "Version history",
    versionHistoryHint: "Every update is kept as an immutable revision.",
    currentVersion: "Current",
    viewingVersion: (shown: number, current: number) =>
      `Viewing v${shown} of v${current}`,
    backToLatest: "Back to latest",
    revisionNoteFallback: "No change note",
    restoreVersion: "Restore this version",
    confirmRestore: "Restore?",
    versionRestored: (version: number) =>
      `Restored v${version} as a new revision`,
    versionLoadFailed: "Couldn't load version history",
  },
  ko: {
    brandTagline: "AI 산출물을 차분하게 검토하는 공간",
    inbox: "받은함",
    archive: "보관함",
    trash: "휴지통",
    all: "전체",
    unread: (n: number) => `${n} 미읽음`,
    loading: "불러오는 중…",
    loadFailed: "항목을 불러오지 못했습니다. 다시 시도해 주세요.",
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
    pinPrivacy: "기본 비공개 · PIN은 이 서버 안에서만 확인합니다",
    pinChecking: "확인 중…",
    pinWrong: "PIN이 올바르지 않습니다",
    pinWrongRemaining: (n: number) =>
      `PIN이 올바르지 않습니다 (남은 시도 ${n}회)`,
    pinLocked: (min: number) => `시도가 너무 많습니다. ${min}분 후 다시 시도하세요`,
    pinOffline: "서버에 연결할 수 없습니다",
    widthLabel: "너비",
    widthNarrow: "좁게",
    widthWide: "넓게",
    widthFull: "전체",
    actionShare: "공유",
    toastShareCopied: "공유 링크를 복사했습니다 — 24시간 동안 유효",
    toastShareRevoked: "공유 링크를 비활성화했습니다",
    toastShareFailed: "공유 링크를 만들지 못했습니다",
    shareRevoke: "링크 비활성화",
    shareExpired: "공유 링크가 만료되었거나 비활성화되었습니다",
    shareInvalid: "유효하지 않은 공유 링크입니다",
    settings: "설정",
    categorySettings: "카테고리",
    categorySettingsHint:
      "AI와 CLI가 쓰는 고정 ID는 유지하면서 화면의 이름, 색상, 순서를 바꿀 수 있습니다.",
    categoryStableId: "고정 ID",
    categoryLabel: "표시 이름",
    categoryColor: "색상",
    categoryVisible: "필터에 표시",
    categoryHiddenHint:
      "숨긴 카테고리도 게시할 수 있으며 기존 문서에는 계속 표시됩니다.",
    moveUp: "위로 이동",
    moveDown: "아래로 이동",
    resetDefaults: "기본값 복원",
    saveChanges: "변경사항 저장",
    saving: "저장 중…",
    settingsSaved: "저장했습니다",
    settingsSaveFailed: "설정을 저장하지 못했습니다. 다시 시도해 주세요.",
    settingsLoadFailed: "설정을 불러오지 못해 기본값을 표시합니다.",
    organize: "정리",
    organizeItem: "문서 정리",
    organizeHint: "문서를 보관할 위치를 정하세요. /를 사용하면 폴더를 중첩할 수 있습니다.",
    project: "프로젝트",
    projectPlaceholder: "예: Dropboard",
    folder: "폴더",
    folderPlaceholder: "예: 리서치/경쟁제품",
    tags: "태그",
    tagPlaceholder: "태그 입력 후 Enter",
    removeTag: (tag: string) => `${tag} 태그 삭제`,
    cancel: "취소",
    organizationSaved: "정리 정보를 저장했습니다",
    library: "라이브러리",
    libraryHint: "프로젝트와 폴더별로 정리",
    allItems: "전체 문서",
    unfiled: "미분류",
    rootFolders: "폴더",
    versions: "버전",
    versionHistory: "버전 기록",
    versionHistoryHint: "업데이트할 때마다 변경 불가능한 리비전으로 보존됩니다.",
    currentVersion: "현재 버전",
    viewingVersion: (shown: number, current: number) =>
      `v${current} 중 v${shown}을 보는 중`,
    backToLatest: "최신 버전으로",
    revisionNoteFallback: "변경 설명 없음",
    restoreVersion: "이 버전 복원",
    confirmRestore: "복원할까요?",
    versionRestored: (version: number) =>
      `v${version}을 새 버전으로 복원했습니다`,
    versionLoadFailed: "버전 기록을 불러오지 못했습니다",
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
