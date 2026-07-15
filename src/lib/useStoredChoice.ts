"use client";

import { useCallback, useSyncExternalStore } from "react";

export function useStoredChoice<T extends string>(
  key: string,
  choices: readonly T[],
  fallback: T,
): [T, (value: T) => void] {
  const eventName = `dropboard:storage:${key}`;

  const subscribe = useCallback(
    (notify: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) notify();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener(eventName, notify);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(eventName, notify);
      };
    },
    [eventName, key],
  );

  const getSnapshot = useCallback(() => {
    const stored = window.localStorage.getItem(key);
    return stored && choices.includes(stored as T) ? (stored as T) : fallback;
  }, [choices, fallback, key]);

  const value = useSyncExternalStore(subscribe, getSnapshot, () => fallback);
  const setValue = useCallback(
    (next: T) => {
      window.localStorage.setItem(key, next);
      window.dispatchEvent(new Event(eventName));
    },
    [eventName, key],
  );

  return [value, setValue];
}

