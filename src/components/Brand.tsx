type BrandMarkProps = {
  className?: string;
};

export function BrandMark({ className = "h-8 w-8" }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 32 32"
      fill="none"
    >
      <rect width="32" height="32" rx="9" fill="var(--brand-ink)" />
      <rect x="11" y="6" width="10" height="11" rx="2" fill="var(--accent)" />
      <path
        d="M16 9.5v4m0 0-2-2m2 2 2-2"
        stroke="white"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 17.5v3.25a3.75 3.75 0 0 0 3.75 3.75h7.5a3.75 3.75 0 0 0 3.75-3.75V17.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark className={compact ? "h-7 w-7" : "h-8 w-8"} />
      <span
        className={`font-mono font-bold tracking-[-0.04em] ${
          compact ? "text-[17px]" : "text-xl"
        }`}
      >
        dropboard<span className="text-[var(--accent)]">.</span>
      </span>
    </span>
  );
}
