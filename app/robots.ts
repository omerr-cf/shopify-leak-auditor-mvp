import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://leakauditb2b.netlify.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Excludes the whole /api/ prefix. /api/lead is the POST-only lead
      // form endpoint (nothing to index). /api/leads is a GET endpoint too
      // -- checked its source: it's a secret-protected admin export of every
      // captured lead (?secret=ADMIN_SECRET), not a form-submission route.
      // No page links to it, so it was never going to be discovered by
      // normal crawling anyway -- this entry is just directory-level
      // hygiene, not the endpoint's real protection (that's the shared
      // secret + its 503-if-unset guard). Deliberately excluding it as a
      // wildcard prefix rather than naming "/api/leads" specifically, since
      // robots.txt is a public file and naming a secret-protected admin
      // path in it would advertise its existence to anyone who reads it.
      disallow: "/api/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
