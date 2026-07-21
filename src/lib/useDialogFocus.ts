"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableElements(container: HTMLElement): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ].filter((element) => element.getAttribute("aria-hidden") !== "true");
}

export function useDialogFocus({
  containerRef,
  onClose,
  disabled = false,
}: {
  containerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  disabled?: boolean;
}) {
  const onCloseRef = useRef(onClose);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    onCloseRef.current = onClose;
    disabledRef.current = disabled;
  }, [disabled, onClose]);

  useEffect(() => {
    const container = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (!container) return;

    const initialFocus =
      container.querySelector<HTMLElement>("[data-dialog-autofocus]") ??
      focusableElements(container)[0] ??
      container;
    initialFocus.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !disabledRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = focusableElements(container!);
      if (focusable.length === 0) {
        event.preventDefault();
        container!.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [containerRef]);
}
