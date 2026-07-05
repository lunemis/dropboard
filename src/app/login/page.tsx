"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "../../lib/i18n";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submittingRef = useRef(false);

  useEffect(() => {
    if (pin.length !== 6 || submittingRef.current) return;
    submittingRef.current = true;
    (async () => {
      setBusy(true);
      setError(null);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      }).catch(() => null);
      if (res?.ok) {
        const next =
          new URLSearchParams(window.location.search).get("next") ?? "/";
        router.replace(next.startsWith("/") ? next : "/");
        return; // keep busy=true while navigating away
      }
      const data = res ? await res.json().catch(() => ({})) : {};
      if (res?.status === 429) {
        const min = Math.ceil((data?.retry_after_s ?? 900) / 60);
        setError(t.pinLocked(min));
      } else if (res) {
        setError(
          data?.remaining !== undefined
            ? t.pinWrongRemaining(data.remaining)
            : t.pinWrong,
        );
      } else {
        setError(t.pinOffline);
      }
      setPin("");
      setBusy(false);
      submittingRef.current = false;
      inputRef.current?.focus();
    })();
  }, [pin, router]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
      <h1 className="font-mono text-2xl font-bold tracking-tight">
        dropboard<span className="text-[var(--accent)]">_</span>
      </h1>

      <label className="flex flex-col items-center gap-4">
        <span className="text-sm text-[var(--muted)]">{t.pinPrompt}</span>
        <div className="relative">
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            disabled={busy}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="absolute inset-0 opacity-0"
            aria-label={t.pinLabel}
          />
          <div className="pointer-events-none flex gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className={`flex h-13 w-10 items-center justify-center rounded-lg border-2 text-xl font-bold ${
                  i < pin.length
                    ? "border-[var(--ink)] bg-[var(--surface)]"
                    : "border-[var(--line)] bg-[var(--surface)]"
                }`}
              >
                {i < pin.length ? "●" : ""}
              </span>
            ))}
          </div>
        </div>
      </label>

      <p
        className="h-5 text-sm text-[var(--accent)]"
        role="status"
        aria-live="polite"
      >
        {error ?? (busy ? t.pinChecking : "")}
      </p>
    </div>
  );
}
