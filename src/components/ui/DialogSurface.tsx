"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { t } from "../../lib/i18n";

export function DialogSurface({
  children,
  description,
  disabled = false,
  eyebrow,
  onClose,
  title,
  tone = "accent",
  variant = "dialog",
}: {
  children: ReactNode;
  description: string;
  disabled?: boolean;
  eyebrow: string;
  onClose: () => void;
  title: string;
  tone?: "accent" | "violet";
  variant?: "dialog" | "sheet";
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(
    typeof document === "undefined"
      ? null
      : (document.activeElement as HTMLElement | null),
  );

  useEffect(
    () => () => {
      const returnTarget = returnFocusRef.current;
      window.requestAnimationFrame(() => {
        if (returnTarget?.isConnected) returnTarget.focus();
      });
    },
    [],
  );

  return (
    <DialogPrimitive.Root
      onOpenChange={(open) => {
        if (!open && !disabled) onClose();
      }}
      open
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="ui-dialog-overlay"
          data-slot="dialog-overlay"
        />
        <DialogPrimitive.Content
          aria-modal="true"
          className={`ui-dialog-content ui-dialog-content--${variant}`}
          data-slot={variant}
          onEscapeKeyDown={(event) => {
            if (disabled) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (disabled) event.preventDefault();
          }}
          onOpenAutoFocus={(event) => {
            const preferred = contentRef.current?.querySelector<HTMLElement>(
              "[data-dialog-autofocus]",
            );
            if (!preferred) return;
            event.preventDefault();
            preferred.focus();
          }}
          onPointerDownOutside={(event) => {
            if (disabled) event.preventDefault();
          }}
          ref={contentRef}
        >
          <header className="ui-dialog-header" data-slot="dialog-header">
            <div>
              <p className="ui-dialog-eyebrow" data-tone={tone}>
                {eyebrow}
              </p>
              <DialogPrimitive.Title className="ui-dialog-title">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="ui-dialog-description">
                {description}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <button
                aria-label={t.cancel}
                className="ui-icon-button"
                data-slot="button"
                disabled={disabled}
                type="button"
              >
                <X aria-hidden="true" />
              </button>
            </DialogPrimitive.Close>
          </header>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
