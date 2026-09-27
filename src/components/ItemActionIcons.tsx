import {
  Archive,
  ArchiveRestore,
  Bookmark,
  Trash2,
} from "lucide-react";

const iconProps = {
  "aria-hidden": true,
  size: 18,
  strokeWidth: 1.8,
} as const;

export function ArchiveIcon() {
  return <Archive {...iconProps} />;
}

export function TrashIcon() {
  return <Trash2 {...iconProps} />;
}

export function RestoreIcon() {
  return <ArchiveRestore {...iconProps} />;
}

export function KeepIcon() {
  return <Bookmark {...iconProps} />;
}
