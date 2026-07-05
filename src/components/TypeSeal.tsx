import { LOCALE, TYPE_LABELS } from "../lib/i18n";
import type { ItemType } from "../lib/types";

export const TYPE_COLORS: Record<ItemType, { fg: string; bg: string }> = {
  review: { fg: "var(--c-review)", bg: "var(--c-review-bg)" },
  decision: { fg: "var(--c-decision)", bg: "var(--c-decision-bg)" },
  report: { fg: "var(--c-report)", bg: "var(--c-report-bg)" },
  info: { fg: "var(--c-info)", bg: "var(--c-info-bg)" },
  fun: { fg: "var(--c-fun)", bg: "var(--c-fun-bg)" },
};

export function typeLabel(type: ItemType): string {
  return TYPE_LABELS[type].label;
}

/** Stamp-seal type badge — the one loud element on each card.
 * Temp items get a dashed border: the stamp isn't "pressed" yet. */
export function TypeSeal({ type, temp }: { type: ItemType; temp?: boolean }) {
  const { label, seal } = TYPE_LABELS[type];
  const color = TYPE_COLORS[type];
  return (
    <span
      aria-label={label}
      title={label}
      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 font-bold ${
        LOCALE === "ko" ? "text-[15px]" : "font-mono text-[9px] tracking-wide"
      }`}
      style={{
        color: color.fg,
        borderColor: color.fg,
        background: temp ? "transparent" : color.bg,
        borderStyle: temp ? "dashed" : "solid",
        opacity: temp ? 0.75 : 1,
      }}
    >
      {seal}
    </span>
  );
}
