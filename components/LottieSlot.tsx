"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// Loaded client-side only — lottie-react touches `document` on import,
// which breaks server rendering if imported statically.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

/**
 * A "ready slot" for a real Lottie animation. Drop an exported Lottie JSON
 * (e.g. from LottieFiles.com — search "radar scan" or "success confetti")
 * into `animationData` and it renders full-motion; until then it renders
 * `fallback` (RadarScan, a static icon, whatever reads fine on its own).
 *
 * Usage once you have a JSON file:
 *   import radarAnim from "@/public/lottie/radar-scan.json";
 *   <LottieSlot animationData={radarAnim} fallback={<RadarScan />} />
 */
export default function LottieSlot({
  animationData,
  fallback,
  className,
  loop = true,
}: {
  animationData?: object;
  fallback: ReactNode;
  className?: string;
  loop?: boolean;
}) {
  if (!animationData) {
    return <div className={className}>{fallback}</div>;
  }

  return (
    <Lottie animationData={animationData} loop={loop} className={className} />
  );
}
