// The Closet Fitters wordmark + mark. A clean typographic logo in brand colors
// (swap in the official logo artwork here later if desired).
export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <rect width="28" height="28" rx="7" fill="#1f333a" />
        {/* wardrobe doors */}
        <rect x="6.5" y="5.5" width="6.6" height="17" rx="1" fill="#eae0d5" />
        <rect x="14.9" y="5.5" width="6.6" height="17" rx="1" fill="#eae0d5" />
        {/* handles */}
        <rect x="12" y="12" width="1.1" height="4" rx="0.55" fill="#1f333a" />
        <rect x="14.9" y="12" width="1.1" height="4" rx="0.55" fill="#1f333a" />
      </svg>
      {!compact && (
        <span className="text-[15px] font-bold tracking-tight text-ink">
          The Closet Fitters
        </span>
      )}
    </span>
  );
}
