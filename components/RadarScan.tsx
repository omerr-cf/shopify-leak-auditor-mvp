/**
 * Lightweight radar-scan indicator, built in pure CSS (Tailwind's built-in
 * `animate-ping`) rather than a Lottie asset — zero extra network weight,
 * runs everywhere. If you later have an actual Lottie JSON export you'd
 * rather use for this exact spot, swap the markup below for
 * <LottieSlot animationData={radarJson} fallback={<RadarScan />} />.
 */
export default function RadarScan({
  label = "Scanning 4 leak vectors in real-time…",
}: {
  label?: string;
}) {
  return (
    <div className="inline-flex items-center gap-3">
      <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/30" />
        <span
          className="absolute inline-flex h-3.5 w-3.5 animate-ping rounded-full bg-emerald-400/40"
          style={{ animationDelay: "300ms" }}
        />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </div>
      <span className="text-xs font-medium tracking-wide text-emerald-300/80">
        {label}
      </span>
    </div>
  );
}
