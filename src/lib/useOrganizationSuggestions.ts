"use client";

import { useEffect, useState } from "react";
import type { ItemMeta } from "./types";

export interface OrganizationSuggestions {
  projects: string[];
  folders: string[];
  tags: string[];
}

const EMPTY_SUGGESTIONS: OrganizationSuggestions = {
  projects: [],
  folders: [],
  tags: [],
};

export function useOrganizationSuggestions(): OrganizationSuggestions {
  const [suggestions, setSuggestions] = useState(EMPTY_SUGGESTIONS);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/items?limit=500", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`load failed (${response.status})`);
        return (await response.json()) as { items?: ItemMeta[] };
      })
      .then(({ items = [] }) => {
        if (cancelled) return;
        const unique = (values: Array<string | null | undefined>) =>
          [
            ...new Set(
              values.filter((value): value is string => Boolean(value)),
            ),
          ].sort((a, b) => a.localeCompare(b));
        setSuggestions({
          projects: unique(items.map((entry) => entry.project)),
          folders: unique(items.map((entry) => entry.folder)),
          tags: unique(items.flatMap((entry) => entry.tags)),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return suggestions;
}
