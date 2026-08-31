import { useId } from "react";

/**
 * Custom brand mark — a self-contained rounded-square badge (works standalone
 * as a favicon, not just inside a header pill) with a gradient fill, a subtle
 * top highlight for the same "lit from above" glass treatment used across the
 * site, and a crisp checkmark. Deliberately not a generic Lucide "Zap" bolt
 * in a circle, the single most overused icon in AI-generated SaaS landing
 * pages, and deliberately not a currentColor line-icon either — a fixed
 * brand mark reads more premium and stays legible at favicon sizes.
 *
 * `muted` swaps the emerald gradient for a neutral gray one, for contexts
 * like the footer where a full-color mark would compete with the copy.
 */
export default function Logomark({
  className = "h-8 w-8",
  muted = false,
}: {
  className?: string;
  muted?: boolean;
}) {
  const uid = useId();
  const gradId = `logomark-grad-${uid}`;
  const clipId = `logomark-clip-${uid}`;

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="4"
          y1="2"
          x2="29"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          {muted ? (
            <>
              <stop offset="0" stopColor="#4B5563" />
              <stop offset="1" stopColor="#1F2937" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#6EE7B7" />
              <stop offset="0.55" stopColor="#10B981" />
              <stop offset="1" stopColor="#047857" />
            </>
          )}
        </linearGradient>
        <clipPath id={clipId}>
          <rect x="1" y="1" width="30" height="30" rx="9" />
        </clipPath>
      </defs>

      <rect x="1" y="1" width="30" height="30" rx="9" fill={`url(#${gradId})`} />

      {/* Glossy top highlight — same "lit from above" cue as .glass-panel */}
      <g clipPath={`url(#${clipId})`}>
        <rect x="1" y="1" width="30" height="13" fill="white" fillOpacity="0.16" />
        <rect x="1" y="1" width="30" height="30" fill="black" fillOpacity="0.06" />
      </g>

      <path
        d="M9.5 16.6 13.7 20.8 23 11.3"
        stroke="white"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
