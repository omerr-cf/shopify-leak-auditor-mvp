import type { ReactElement } from "react";
import { cloneElement } from "react";

type Tone = "emerald" | "amber" | "red" | "cyan" | "neutral";
type Size = "sm" | "md" | "lg";

const TONE_CLASSES: Record<Tone, string> = {
  emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-400",
  red: "border-red-500/25 bg-red-500/10 text-red-400",
  cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-400",
  neutral: "border-white/[0.08] bg-white/[0.04] text-gray-400",
};

const SIZE_CLASSES: Record<Size, { tile: string; icon: string }> = {
  sm: { tile: "h-7 w-7 rounded-md", icon: "h-3.5 w-3.5" },
  md: { tile: "h-9 w-9 rounded-lg", icon: "h-4 w-4" },
  lg: { tile: "h-12 w-12 rounded-xl", icon: "h-5 w-5" },
};

/**
 * Consistent icon-in-a-tile treatment used everywhere on the site instead
 * of ad hoc per-component icon wrappers (or emoji, which read as a strong
 * "AI-generated" tell). Pass any Lucide icon element as `icon` — its size
 * and stroke width are standardized here so icons never look mismatched
 * across sections.
 */
export default function IconTile({
  icon,
  tone = "emerald",
  size = "md",
  className = "",
}: {
  icon: ReactElement<{ className?: string; strokeWidth?: number }>;
  tone?: Tone;
  size?: Size;
  className?: string;
}) {
  const sized = SIZE_CLASSES[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center border ${sized.tile} ${TONE_CLASSES[tone]} ${className}`}
    >
      {cloneElement(icon, {
        className: sized.icon,
        strokeWidth: 1.75,
      })}
    </span>
  );
}
