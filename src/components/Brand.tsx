type BrandMarkProps = {
  className?: string;
};

export function BrandMark({ className = "h-8 w-8" }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
    >
      <rect width="32" height="32" rx="9" fill="#f7f2ea" />
      <circle
        cx="16"
        cy="16"
        r="9"
        stroke="#202833"
        strokeWidth="3"
      />
      <path
        d="M9.6 22.4a9 9 0 0 0 12.8 0"
        stroke="#6558d8"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="22.8" cy="8.2" r="4" fill="#e85d40" />
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
