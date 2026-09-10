import type { MetadataRoute } from "next";

// This marketing site is intentionally a single page (see app/page.tsx --
// there is no /privacy or /terms route here). Those pages exist on the
// SEPARATE leakaudit-app repo (a React Router app deployed to
// leakaudit-app.fly.dev, not this Next.js site) -- verified by checking
// that repo directly. A sitemap entry for a URL that 404s actively hurts
// crawl trust, so this only lists the one route that actually exists on
// this domain. If /privacy or /terms should ever be indexed, that needs a
// sitemap on the leakaudit-app.fly.dev domain instead (a throwaway Fly.io
// subdomain has no search authority to speak of, so it's worth asking
// whether that's actually worth building before doing it).
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://leakauditb2b.netlify.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
