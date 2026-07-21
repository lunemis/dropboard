export const ITEM_TYPES = ["review", "decision", "report", "info", "fun"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_STATUSES = ["inbox", "archived", "trash"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export type ContentType = "html" | "markdown";

export interface ItemMeta {
  id: string;
  title: string;
  type: ItemType;
  project: string | null;
  folder: string | null;
  tags: string[];
  summary: string;
  content_file: string;
  content_type: ContentType;
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
  summary?: string;
  content: string;
  content_type?: ContentType;
  source?: string;
  /** set → temp item expiring after this many minutes */
  ttl_minutes?: number;
}
