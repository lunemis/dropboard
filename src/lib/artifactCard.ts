import type { ItemMeta, ItemStatus } from "./types";

export type ArtifactCardActionMode =
  "temporary" | "inbox" | "archived" | "library" | "trash";

export function artifactCardState(item: ItemMeta, status: ItemStatus) {
  return {
    actionMode: item.expires_at ? "temporary" : status,
    unread: status === "inbox" && !item.read_at,
  } satisfies {
    actionMode: ArtifactCardActionMode;
    unread: boolean;
  };
}
