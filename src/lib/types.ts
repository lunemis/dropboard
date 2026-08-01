export const ITEM_TYPES = ["review", "decision", "report", "info", "fun"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_STATUSES = ["inbox", "archived", "library", "trash"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ITEM_DESTINATIONS = ["inbox", "library"] as const;
export type ItemDestination = (typeof ITEM_DESTINATIONS)[number];

export type ContentType = "html" | "markdown";

export const ITEM_VIEW_MODES = ["document", "presentation", "reader"] as const;
export type ItemViewMode = (typeof ITEM_VIEW_MODES)[number];

export interface ItemMeta {
  id: string;
  title: string;
  type: ItemType;
  project: string | null;
  folder: string | null;
  tags: string[];
  /** Stable user/agent key for repeat publications. Null means create-only. */
  document_key: string | null;
  /** Latest immutable content revision. Legacy items are normalized to v1. */
  revision: number;
  summary: string;
  content_file: string;
  content_type: ContentType;
  /** Rendering expectations for the viewer. Legacy items default to document. */
  view_mode: ItemViewMode;
  status: ItemStatus;
  pinned: boolean;
  read_at: string | null;
  trashed_at: string | null;
  /** temp items only — item vanishes past this time; null/absent = keep */
  expires_at?: string | null;
  /** bumped to invalidate all previously issued public share links */
  share_epoch?: number;
  created_at: string;
  updated_at: string;
  source: string;
}

export interface CreateItemInput {
  title: string;
  type: ItemType;
  project?: string;
  folder?: string;
  tags?: string[];
  document_key?: string;
  revision_note?: string;
  expected_revision?: number;
  summary?: string;
  content: string;
  content_type?: ContentType;
  view_mode?: ItemViewMode;
  /** Initial location or post-update destination. Defaults to inbox. */
  destination?: ItemDestination;
  source?: string;
  /** set → temp item expiring after this many minutes */
  ttl_minutes?: number;
}

export interface RevisionMeta {
  revision: number;
  title: string;
  type: ItemType;
  summary: string;
  content_file: string;
  content_type: ContentType;
  view_mode: ItemViewMode;
  created_at: string;
  source: string;
  note: string | null;
}

export interface CreateRevisionInput {
  content: string;
  content_type: ContentType;
  view_mode?: ItemViewMode;
  /** Where the updated item should appear. Defaults to inbox. */
  destination?: ItemDestination;
  title?: string;
  type?: ItemType;
  summary?: string;
  source?: string;
  note?: string;
  expected_revision?: number;
  project?: string | null;
  folder?: string | null;
  tags?: string[];
  /** Internal escape hatch for the explicit restore workflow only. */
  allow_trashed?: boolean;
}
