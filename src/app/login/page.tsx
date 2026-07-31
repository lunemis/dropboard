"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "../../components/Brand";
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

  const submitPin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pin.length !== 6 || submittingRef.current) return;
    submittingRef.current = true;
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
  };

  return (
    <main className="login-shell relative flex flex-1 items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <section className="login-card relative z-1 w-full max-w-md rounded-3xl border border-[var(--line)] p-6 text-center sm:p-9">
        <h1 className="flex justify-center">
          <Brand />
        </h1>
        <p className="mt-3 text-sm text-[var(--muted)]">{t.brandTagline}</p>

        <form className="mt-9" onSubmit={submitPin}>
          <label
            htmlFor="dropboard-pin"
            className="text-sm font-medium"
          >
            {t.pinPrompt}
          </label>
          <div className="mx-auto mt-4 max-w-xs">
            <input
              id="dropboard-pin"
              ref={inputRef}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              value={pin}
              disabled={busy}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="h-14 w-full rounded-xl border border-[var(--line-strong)] bg-[var(--surface-muted)] px-4 text-center font-mono text-xl font-bold tracking-[0.55em] text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-ring)] disabled:cursor-wait disabled:opacity-60"
              aria-label={t.pinLabel}
              aria-describedby="pin-status"
            />
            <button
              type="submit"
              disabled={busy || pin.length !== 6}
              className="mt-3 h-11 w-full rounded-xl bg-[var(--ink)] px-4 text-sm font-semibold text-[var(--bg)] transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {busy ? t.pinChecking : t.pinSubmit}
            </button>
          </div>
        </form>

        <p
          id="pin-status"
          className="mt-5 h-5 text-sm font-medium text-[var(--accent)]"
          role="status"
          aria-live="polite"
        >
          {error ?? (busy ? t.pinChecking : "")}
        </p>
        <p className="mt-5 text-[11px] text-[var(--muted-soft)]">
          {t.pinPrivacy}
        </p>
      </section>
    </main>
  );
}
