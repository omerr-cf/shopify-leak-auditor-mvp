"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";

// Loaded client-side only — lottie-react touches `document` on import,
// which breaks server rendering if imported statically.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

/**
 * A "ready slot" for a real Lottie animation. Point `src` at a JSON file
 * under public/lottie/ and it's fetched client-side on mount and rendered
 * full-motion — the JSON never gets bundled into the page's JS, keeping
 * the initial load light (this site's whole pitch is "zero bloat"). Until
 * the fetch resolves (or if `src` is omitted), it renders `fallback`
 * (RadarScan, a static icon, whatever reads fine on its own).
 *
 * Usage once you have a JSON file in public/lottie/:
 *   <LottieSlot src="/lottie/radar-scan.json" fallback={<RadarScan />} />
 *
 * `animationData` still works too, for a JSON you'd rather inline directly.
 */
export default function LottieSlot({
  src,
  animationData,
  fallback,
  className,
  loop = true,
}: {
  src?: string;
  animationData?: object;
  fallback: ReactNode;
  className?: string;
  loop?: boolean;
}) {
  const [fetchedData, setFetchedData] = useState<object | undefined>(
    undefined
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src || animationData) return;
    let cancelled = false;

    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${src}: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setFetchedData(data);
      })
      .catch((err) => {
        console.warn("[LottieSlot] falling back — could not load", src, err);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [src, animationData]);

  const data = animationData ?? fetchedData;

  if (!data || failed) {
    return <div className={className}>{fallback}</div>;
  }

  return <Lottie animationData={data} loop={loop} className={className} />;
}
