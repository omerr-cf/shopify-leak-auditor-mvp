/**
 * Custom brand mark — a droplet (leak) with a checkmark (found & fixed)
 * inside it. Deliberately not a generic Lucide "Zap" bolt in a circle,
 * which is the single most overused icon in AI-generated SaaS landing
 * pages. Pure inline SVG, no icon library, so it always renders exactly
 * the same regardless of what icon set the rest of the site uses.
 */
export default function Logomark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2.5C12 2.5 5.25 11 5.25 15.25a6.75 6.75 0 0 0 13.5 0C18.75 11 12 2.5 12 2.5Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M8.75 14.25 11 16.5l4.25-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
