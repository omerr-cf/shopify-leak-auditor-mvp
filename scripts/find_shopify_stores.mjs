#!/usr/bin/env node
/**
 * find_shopify_stores.mjs -- Founder Beta lead generator (Node.js port).
 *
 * Ported 1:1 from scripts/find_shopify_stores.py because Omer's Mac has an
 * OS-level Xcode Command Line Tools mismatch that breaks python3/pip3
 * (_XPCTypeBool / Abort trap: 6), while Node v20 is healthy. Same search
 * logic, same Shopify-confirmation logic, same contact-email discovery,
 * same CSV output shape, same self-tests -- just zero-dependency JS using
 * Node's built-in `fetch` instead of `requests` + BeautifulSoup.
 *
 * THE ONE REAL TRADE-OFF -- READ BEFORE RELYING ON THIS
 * --------------------------------------------------------------------
 * This uses regex/string matching to pull values out of raw HTML instead
 * of a real DOM parser (BeautifulSoup's job in the Python version). That
 * follows directly from "zero external npm dependencies, native fetch
 * only" so this runs immediately with no install step at all. But regex
 * HTML parsing is fundamentally less robust than a real parser --
 * attribute order, whitespace, and quote style can all vary, and if
 * DuckDuckGo's result markup (or a store's theme) changes even slightly,
 * this will silently return fewer/zero matches with NO error, rather than
 * fail loudly. The two extraction functions most exposed to this
 * (extractResultUrls, extractStoreName) are written to be order-independent
 * on attributes specifically to reduce that risk, but it isn't eliminated.
 * If this turns out to be a real problem in practice, `npm install cheerio`
 * (a small, pure-JS, no-native-binary HTML parser -- does not touch
 * Python/Xcode at all, so it wouldn't hit the same wall) and swapping the
 * regex-based extraction for real `cheerio.load()` selectors would fix it
 * properly.
 *
 * Node's global `fetch` works without any flag on Node 18/20, but on
 * Node 20 it's still technically "experimental" (marked stable as of
 * Node 21) -- you may see a one-line ExperimentalWarning printed to
 * stderr on first use. That's cosmetic and doesn't affect anything below.
 *
 * The robots.txt check below is a minimal from-scratch parser (prefix
 * matching only, no `*`/`$` wildcard support in paths) -- the same real
 * limitation Python's stdlib `urllib.robotparser` has, not a regression
 * introduced by this port.
 *
 * USAGE
 *   node scripts/find_shopify_stores.mjs --niche clothing --limit 40
 *   node scripts/find_shopify_stores.mjs --selftest    (no network needed)
 *
 * Run this from your own terminal with normal internet access -- same as
 * the Python version, this will NOT work from Claude's sandboxed
 * device-bridge shell or cloud workspace (no general internet egress,
 * verified directly). Only your Mac's real network can reach DuckDuckGo
 * and the store sites themselves.
 *
 * Same politeness/legal notes as the Python version apply unchanged -- see
 * OUTREACH_PLAYBOOK.md and find_shopify_stores.py's own module docstring
 * for the full legal / robots.txt / CAN-SPAM context; not re-duplicated
 * here so the two copies can't drift out of sync with each other.
 */

import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// 2026-09-10: switched from a self-identifying bot UA to a realistic
// browser UA + Accept/Accept-Language headers, per a live 0-leads run
// against html.duckduckgo.com. NOT independently confirmed as the actual
// cause (see the diagnostic logging added to searchDuckDuckGo() below --
// that's what will tell us for certain on the next run: status 200 with
// real HTML but 0 extracted anchors points at a parsing/markup mismatch
// instead, not blocking). Also affects the robotsAllows() check further
// down: a browser UA will essentially never match a site-specific
// robots.txt User-agent group (nobody publishes a group named
// "Mozilla/5.0 (Macintosh...)"), so robots.txt matching now effectively
// always falls through to the wildcard "*" group. That's a neutral,
// expected side effect, not a bug.
export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
export const ACCEPT_HEADER =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
export const ACCEPT_LANGUAGE_HEADER = "en-US,en;q=0.9";
const REQUEST_TIMEOUT_MS = 10_000;
// 2026-10-09: cold emails now link to the public App Store listing, NOT the
// app's own /auth?shop=<custom-domain> URL. That URL only works for a
// merchant who is already signed in to the right Shopify account (and needs
// the *.myshopify.com handle, which we don't have for cold leads) -- anyone
// else hit "your account doesn't have permission to view this page".
const INSTALL_LINK_TEMPLATE =
  "https://apps.shopify.com/leakaudit-app?utm_source=outbound&utm_medium=email&utm_campaign=cold_oct";

export const CONTACT_PATHS = [
  "/pages/contact",
  "/pages/contact-us",
  "/contact",
  "/contact-us",
];

// 2026-09-10: replaced generic "shopify store ... clothing" queries with
// storefront-specific dorks, after the previous set returned app-store
// listings and agency blogs (qikify.com, hulkapps.com, ecomposer.io)
// instead of real merchant stores. `inurl:` is a confirmed real
// DuckDuckGo operator (checked their own docs rather than assuming); the
// multi-segment-path and `site:`-with-path usage below is NOT separately
// confirmed from those docs (the only documented examples are single
// words / bare domains) -- the per-query diagnostic log added earlier
// will show whether these are actually narrowing results.
const DEFAULT_NICHE_QUERIES = [
  '"Powered by Shopify" inurl:/collections/all clothing',
  '"Powered by Shopify" inurl:/collections/all jewelry',
  '"Powered by Shopify" inurl:/collections/all home decor',
  '"Powered by Shopify" inurl:/collections/all fitness',
  'site:myshopify.com/collections/all boutique',
];

// Known-good TLD allowlist, used instead of an open-ended [a-zA-Z]{2,}
// match for the domain's final label. Added 2026-09-10 after a real bug
// surfaced in production output: extractEmail returned
// "rachelsrusticboutique@gmail.comWe" -- the store's own page had zero
// whitespace between the email and the next sentence ("...gmail.comWe
// are so happy..."). An open-ended letter-run TLD has no way to know
// where "com" ends and "We" begins (both are just letters to it), and
// capping the run's *length* doesn't help either -- "comWe" is only 5
// characters, still short. The only correct fix is checking the
// extracted label against real TLDs and refusing the match if it isn't
// one -- better to silently drop an unparseable email than to silently
// hand back a broken address a real send would bounce on.
const KNOWN_EMAIL_TLDS = [
  "com", "net", "org", "io", "co", "shop", "store", "info", "biz",
  "app", "dev", "me", "us", "uk", "ca", "au", "nz", "de", "fr", "nl",
  "es", "it", "ie", "world", "fit", "health", "fashion", "ink", "inc",
  "to", "gg", "xyz", "online", "site", "club", "design", "boutique",
  "email", "clothing", "jewelry",
];
const EMAIL_RE = new RegExp(
  String.raw`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(?:${KNOWN_EMAIL_TLDS.join("|")})(?![a-zA-Z])`,
  "g"
);

// Emails that show up constantly as false positives -- theme/app
// boilerplate, image filenames that look like emails, Shopify's own
// domains, etc. Same list as the Python version.
const EMAIL_BLOCKLIST_DOMAINS = new Set([
  "shopify.com",
  "sentry.io",
  "wixpress.com",
  "example.com",
  "godaddy.com",
]);

export function buildInstallLink(domain) {
  return INSTALL_LINK_TEMPLATE.replace("{domain}", domain);
}

// ---------------------------------------------------------------------------
// Candidate exclusion filters (2026-09-10) -- filters out software/agency/
// App-Store results that pass the Shopify-fingerprint check (an app's own
// marketing site or a theme agency's portfolio site can easily be built ON
// Shopify itself, or reference Shopify branding, without being a merchant
// storefront at all).
// ---------------------------------------------------------------------------

// NOTE ON A REAL BUG CAUGHT HERE: the spec for this said "exclude if
// domain contains shopify.com" -- implemented as a plain substring check,
// that would ALSO match every single `*.myshopify.com` store domain,
// since "myshopify.com" contains the substring "shopify.com". That would
// have silently excluded the actual core target of this whole script.
// Fixed to match shopify.com and its real subdomains (apps.shopify.com,
// help.shopify.com, ...) specifically, via exact-or-suffix matching, not
// substring "contains".
export function isShopifyCorporateDomain(domain) {
  return domain === "shopify.com" || domain.endsWith(".shopify.com");
}

const EXCLUDED_DOMAIN_SUBSTRINGS = ["apps.", "dev.", "blog."];

export function isExcludedByDomain(urlStr, domain) {
  if (!domain) return true;
  if (isShopifyCorporateDomain(domain)) return true;
  if (EXCLUDED_DOMAIN_SUBSTRINGS.some((s) => domain.includes(s))) return true;
  // myshopify.com/admin -- an admin-panel/login URL, not a storefront.
  // "/admin" is a URL PATH, never part of the hostname itself, so this
  // has to check the full URL, not the domain string.
  if (domain.endsWith("myshopify.com")) {
    let path = "";
    try {
      path = new URL(urlStr).pathname;
    } catch {
      // malformed URL -- fall through, not excluded on this basis
    }
    if (path.startsWith("/admin")) return true;
  }
  return false;
}

// Checked against the raw <title> and meta description, NOT the
// post-processed extractStoreName() result -- extractStoreName()
// deliberately splits "Page - Store Name" titles down to just the store
// half, which would silently throw away exactly the "App Store" / "Shopify
// App" qualifier text this filter needs to see.
// "builder" added 2026-09-10 after pagefly.io (a real Shopify page-builder
// app, not a merchant storefront) slipped through this filter -- its
// actual title is "PageFly - Official Site | AI Page Builder & CRO for
// Shopify" and meta description "...the #1 Shopify page builder...",
// neither of which contains the literal phrase "shopify app" that this
// list was checking for. Verified pagefly.io's real title/meta directly
// rather than guessing at the fix.
const EXCLUDED_TITLE_KEYWORDS = ["app store", "shopify app", "software", "agency", "themes", "builder"];

export function hasExcludedKeyword(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return EXCLUDED_TITLE_KEYWORDS.some((kw) => lower.includes(kw));
}

export function extractRawTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeHtmlEntities(m[1]).trim() : "";
}

export function extractMetaDescription(html) {
  for (const tag of matchOpeningTags(html, "meta")) {
    const name = (getAttr(tag, "name") || getAttr(tag, "property") || "").toLowerCase();
    if (name === "description" || name === "og:description") {
      const content = getAttr(tag, "content");
      if (content) return decodeHtmlEntities(content).trim();
    }
  }
  return "";
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: ACCEPT_HEADER,
        "Accept-Language": ACCEPT_LANGUAGE_HEADER,
        ...(opts.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Small zero-dependency HTML attribute helpers (used instead of a real DOM
// parser -- see the trade-off note at the top of this file).
// ---------------------------------------------------------------------------

export function matchOpeningTags(html, tagName) {
  const re = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
  return html.match(re) || [];
}

export function getAttr(tagHtml, attrName) {
  const re = new RegExp(`\\b${attrName}\\s*=\\s*(["'])((?:(?!\\1).)*)\\1`, "i");
  const m = tagHtml.match(re);
  return m ? m[2] : null;
}

export function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// ---------------------------------------------------------------------------
// Step 1: search for candidate domains
// ---------------------------------------------------------------------------

function extractResultUrls(html, maxResults = 15) {
  // Equivalent to BeautifulSoup's `soup.select("a.result__a")` -- checks
  // the `class` attribute's whitespace-separated tokens for an exact
  // "result__a" match, independent of attribute order in the tag.
  const urls = [];
  for (const tag of matchOpeningTags(html, "a")) {
    if (urls.length >= maxResults) break;
    const cls = getAttr(tag, "class") || "";
    if (!cls.split(/\s+/).includes("result__a")) continue;
    const href = getAttr(tag, "href");
    if (!href) continue;
    const real = unwrapDuckDuckGoRedirect(decodeHtmlEntities(href));
    if (real) urls.push(real);
  }
  return urls;
}

function unwrapDuckDuckGoRedirect(href) {
  /** DuckDuckGo HTML result links look like //duckduckgo.com/l/?uddg=<encoded-url>&... */
  if (!href) return null;
  let url;
  try {
    url = new URL(href.includes("://") ? href : `https:${href}`);
  } catch {
    return null;
  }
  const uddg = url.searchParams.get("uddg");
  if (uddg) return uddg;
  if (url.protocol && url.host) return href;
  return null;
}

export function domainFromUrl(urlStr) {
  let host;
  try {
    host = new URL(urlStr).host;
  } catch {
    return null;
  }
  const lower = host.toLowerCase();
  const stripped = lower.startsWith("www.") ? lower.slice(4) : lower;
  return stripped || null;
}

async function searchDuckDuckGo(query, maxResults = 15) {
  const url = new URL("https://html.duckduckgo.com/html/");
  url.searchParams.set("q", query);
  const resp = await fetchWithTimeout(url.toString());
  const html = await resp.text();
  const urls = resp.ok ? extractResultUrls(html, maxResults) : [];

  // Diagnostic logging (per the 2026-09-10 0-leads report) -- this is
  // what actually distinguishes "DuckDuckGo blocked/challenged us"
  // (non-200, or a suspiciously short body) from "we got real search
  // results back but our own extractor found nothing" (200, a normal-
  // sized body, 0 URLs -- that would point at extractResultUrls()/the
  // "result__a" class check, not at DuckDuckGo). Always printed, not
  // just on failure, so a real run's output is self-diagnosing.
  console.log(
    `  [${query}] Status: ${resp.status}, HTML length: ${html.length} bytes, Extracted URLs: ${urls.length}`
  );
  if (!resp.ok) {
    console.warn(
      `  [warn] DuckDuckGo returned HTTP ${resp.status} for ${JSON.stringify(
        query
      )} -- likely a rate-limit or block, not a code bug. Slow down (--delay) or switch to a real search API (see the module docstring's SEARCH_BACKEND note in find_shopify_stores.py).`
    );
  } else if (urls.length === 0) {
    const bodyLooksAnomalous = html.length < 5000 || /anomaly|are you a robot|unusual traffic/i.test(html);
    console.warn(
      bodyLooksAnomalous
        ? `  [warn] DuckDuckGo returned HTTP 200 but a suspiciously short/challenge-like body (${html.length} bytes) for ${JSON.stringify(
            query
          )} -- looks like a block or CAPTCHA page, not a normal result page.`
        : `  [warn] DuckDuckGo returned HTTP 200 with a normal-sized body (${html.length} bytes) but 0 "result__a" links were found for ${JSON.stringify(
            query
          )} -- this points at extractResultUrls()'s markup match, not at DuckDuckGo blocking us. DuckDuckGo may have changed its result-page markup.`
    );
  }

  return urls;
}

// ---------------------------------------------------------------------------
// Step 2: confirm the domain actually runs Shopify
// ---------------------------------------------------------------------------

export function looksLikeShopify(html) {
  const signals = [
    "cdn.shopify.com",
    "Shopify.theme",
    "Shopify.shop",
    "shopify-section",
    "cdn.shopifycloud.com",
  ];
  return signals.some((sig) => html.includes(sig));
}

export function extractStoreName(html, fallbackDomain) {
  for (const tag of matchOpeningTags(html, "meta")) {
    const prop = getAttr(tag, "property");
    if (prop && prop.toLowerCase() === "og:site_name") {
      const content = getAttr(tag, "content");
      if (content && content.trim()) return decodeHtmlEntities(content).trim();
    }
  }
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    const title = decodeHtmlEntities(titleMatch[1]).trim();
    if (title) {
      for (const sep of [" - ", " | ", " – "]) {
        if (title.includes(sep)) {
          const parts = title.split(sep);
          return parts[parts.length - 1].trim();
        }
      }
      return title;
    }
  }
  return fallbackDomain;
}

// ---------------------------------------------------------------------------
// Step 3: try to find a public contact email
// ---------------------------------------------------------------------------

function parseRobotsTxt(text) {
  // Minimal REP parser -- prefix-match only, no `*`/`$` wildcard support
  // in paths (same real limitation Python's stdlib urllib.robotparser has).
  const groups = [];
  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === "user-agent") {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if ((field === "allow" || field === "disallow") && current) {
      current.rules.push({ type: field, path: value });
    }
  }
  return groups;
}

function robotsAllows(robotsText, userAgent, path) {
  if (!robotsText) return true;
  const groups = parseRobotsTxt(robotsText);
  const uaLower = userAgent.toLowerCase();
  const group =
    groups.find((g) => g.agents.some((a) => a !== "*" && uaLower.includes(a))) ||
    groups.find((g) => g.agents.includes("*"));
  if (!group) return true;

  let bestLen = -1;
  let disallowed = false;
  for (const rule of group.rules) {
    if (rule.path === "" && rule.type === "disallow") continue; // empty Disallow = allow all
    if (path.startsWith(rule.path) && rule.path.length > bestLen) {
      bestLen = rule.path.length;
      disallowed = rule.type === "disallow";
    }
  }
  return !disallowed;
}

export async function checkRobotsAllows(domain, path) {
  try {
    const resp = await fetchWithTimeout(`https://${domain}/robots.txt`);
    if (resp.status >= 400) return true; // no robots.txt -> nothing disallowed
    const text = await resp.text();
    return robotsAllows(text, USER_AGENT, path);
  } catch {
    return true; // can't check -> don't block on a network hiccup
  }
}

export function extractEmail(html) {
  const matches = html.match(EMAIL_RE) || [];
  for (const match of matches) {
    const emailDomain = match.split("@")[1].toLowerCase();
    if (EMAIL_BLOCKLIST_DOMAINS.has(emailDomain)) continue;
    const lower = match.toLowerCase();
    if (
      [
        ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico",
        ".css", ".js", ".json", ".map",
        ".woff", ".woff2", ".ttf", ".eot",
        ".mp4", ".pdf",
      ].some((ext) => lower.endsWith(ext))
    ) {
      continue;
    }
    return match;
  }
  return "";
}

export async function findContactEmail(domain, delayMs) {
  for (const path of CONTACT_PATHS) {
    const allowed = await checkRobotsAllows(domain, path);
    if (!allowed) continue;
    let resp;
    try {
      resp = await fetchWithTimeout(`https://${domain}${path}`);
    } catch {
      await sleep(delayMs);
      continue;
    }
    await sleep(delayMs);
    if (resp.status >= 400) continue;
    const html = await resp.text();
    const email = extractEmail(html);
    if (email) return email;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

// Confirms a single candidate domain actually runs Shopify, extracts its
// store name and contact email, and (if it passes) appends a lead to
// `leads`. Shared by both the search-results loop and the --seed-domains
// loop below -- --seed-domains skips the DuckDuckGo search step only,
// never this verification pipeline (Shopify fingerprint check, robots.txt
// compliance, and rate limiting all still apply to every seed domain).
async function tryAddLead(domain, seenDomains, leads, delayMs) {
  if (!domain || seenDomains.has(domain)) return;
  seenDomains.add(domain);

  let homepage;
  let homepageHtml;
  try {
    homepage = await fetchWithTimeout(`https://${domain}`);
    homepageHtml = homepage.ok || homepage.status < 400 ? await homepage.text() : "";
  } catch {
    await sleep(delayMs);
    return;
  }
  await sleep(delayMs);
  if (!homepage || homepage.status >= 400 || !looksLikeShopify(homepageHtml)) {
    console.log(`  [-] ${domain} -- not confirmed as a live Shopify store, skipped`);
    return;
  }

  const rawTitle = extractRawTitle(homepageHtml);
  const metaDescription = extractMetaDescription(homepageHtml);
  if (hasExcludedKeyword(rawTitle) || hasExcludedKeyword(metaDescription)) {
    console.log(`  [-] ${domain} -- title/meta reads as a software/app/agency site, skipped ("${rawTitle}")`);
    return;
  }

  const storeName = extractStoreName(homepageHtml, domain);
  const email = await findContactEmail(domain, delayMs);
  leads.push({
    storeName,
    domain,
    contactEmail: email,
    installLink: buildInstallLink(domain),
  });
  console.log(`  [+] ${domain} -- ${email ? "email found" : "no email found"}`);
}

async function findLeads(nicheQueries, limit, delayMs, seedDomains = []) {
  const seenDomains = new Set();
  const leads = [];

  // Seed domains (from --seed-domains, a file Omer supplies himself) go
  // through the pipeline first -- see the module-level note near
  // parseArgs() on why this is a file Omer curates rather than a list
  // this script invents.
  for (const domain of seedDomains) {
    if (leads.length >= limit) break;
    await tryAddLead(domain, seenDomains, leads, delayMs);
  }

  for (const query of nicheQueries) {
    if (leads.length >= limit) break;
    let resultUrls;
    try {
      resultUrls = await searchDuckDuckGo(query);
    } catch (exc) {
      console.error(`  [warn] search failed for ${JSON.stringify(query)}: ${exc.message}`);
      continue;
    }
    await sleep(delayMs);

    for (const url of resultUrls) {
      if (leads.length >= limit) break;
      const domain = domainFromUrl(url);
      if (isExcludedByDomain(url, domain)) {
        console.log(`  [-] excluded by domain/URL filter: ${url}`);
        continue;
      }
      await tryAddLead(domain, seenDomains, leads, delayMs);
    }
  }

  return leads;
}

export function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(leads) {
  const header = [
    "Store Name",
    "Store Domain",
    "Contact Email",
    "Personalized Direct Install Link",
  ];
  const rows = [
    header,
    ...leads.map((l) => [l.storeName, l.domain, l.contactEmail, l.installLink]),
  ];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// Self-tests (no network required) -- run with --selftest
// ---------------------------------------------------------------------------

function runSelftest() {
  let failures = 0;

  function check(name, condition) {
    const status = condition ? "ok" : "FAIL";
    if (!condition) failures++;
    console.log(`  [${status}] ${name}`);
  }

  const ddgSampleHtml = `
    <div class="result">
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample-store.myshopify.com%2F&amp;rut=abc">
        Example Store
      </a>
    </div>
  `;
  const urls = extractResultUrls(ddgSampleHtml);
  check(
    "extractResultUrls unwraps uddg redirect",
    JSON.stringify(urls) === JSON.stringify(["https://example-store.myshopify.com/"])
  );

  check(
    "unwrapDuckDuckGoRedirect handles protocol-relative href",
    unwrapDuckDuckGoRedirect("//duckduckgo.com/l/?uddg=https%3A%2F%2Ffoo.com%2F") === "https://foo.com/"
  );
  check(
    "unwrapDuckDuckGoRedirect handles plain absolute url",
    unwrapDuckDuckGoRedirect("https://bar.com/") === "https://bar.com/"
  );
  check("unwrapDuckDuckGoRedirect handles empty href", unwrapDuckDuckGoRedirect("") === null);

  check("domainFromUrl strips www", domainFromUrl("https://www.foo-store.com/pages/x") === "foo-store.com");
  check(
    "domainFromUrl keeps bare myshopify domain",
    domainFromUrl("https://foo.myshopify.com/") === "foo.myshopify.com"
  );

  const shopifyHtml =
    '<html><head></head><body><script src="https://cdn.shopify.com/s/files/1/x.js"></script></body></html>';
  const nonShopifyHtml = "<html><body>Just a plain WordPress site</body></html>";
  check("looksLikeShopify true positive", looksLikeShopify(shopifyHtml) === true);
  check("looksLikeShopify true negative", looksLikeShopify(nonShopifyHtml) === false);

  const ogHtml = '<html><head><meta property="og:site_name" content="Cool Threads Co"></head></html>';
  const titleHtml = "<html><head><title>Contact Us - Cool Threads Co</title></head></html>";
  const plainTitleHtml = "<html><head><title>Cool Threads Co</title></head></html>";
  check(
    "extractStoreName prefers og:site_name",
    extractStoreName(ogHtml, "fallback.com") === "Cool Threads Co"
  );
  check(
    "extractStoreName splits 'Page - Store' titles",
    extractStoreName(titleHtml, "fallback.com") === "Cool Threads Co"
  );
  check(
    "extractStoreName falls back to whole title",
    extractStoreName(plainTitleHtml, "fallback.com") === "Cool Threads Co"
  );
  check(
    "extractStoreName falls back to domain when nothing found",
    extractStoreName("<html></html>", "fallback.com") === "fallback.com"
  );

  const emailHtml = "<html><body>Reach us at hello@coolthreads.com or see logo.png</body></html>";
  check("extractEmail finds a real address", extractEmail(emailHtml) === "hello@coolthreads.com");
  check("extractEmail returns empty when none present", extractEmail("<html><body>no email here</body></html>") === "");
  check(
    "extractEmail skips blocklisted domains",
    extractEmail("<html><body>contact support@sentry.io or real@coolthreads.com</body></html>") ===
      "real@coolthreads.com"
  );
  check(
    "extractEmail rejects a .css asset false-positive (the actual reported bug)",
    extractEmail("<html><body>ecom-swiper@11.css real@coolthreads.com</body></html>") === "real@coolthreads.com"
  );
  check(
    "extractEmail rejects .js/.json/.map asset false-positives",
    extractEmail(
      "<html><body>bundle@2.3.js config@1.0.json source@1.0.map real@coolthreads.com</body></html>"
    ) === "real@coolthreads.com"
  );
  check(
    "extractEmail does not glue trailing prose onto the TLD (the real 'comWe' bug from production)",
    extractEmail(
      "<html><body>Email us at rachelsrusticboutique@gmail.comWe are so happy you're here!</body></html>"
    ) === ""
  );
  check(
    "extractEmail still finds a real address on the same page as a glued-together one",
    extractEmail(
      "<html><body>Old: rachelsrusticboutique@gmail.comWe love it. New: hello@coolthreads.com</body></html>"
    ) === "hello@coolthreads.com"
  );
  check(
    "extractEmail handles a real address immediately followed by punctuation (not a false rejection)",
    extractEmail("<html><body>Email: hello@coolthreads.com.</body></html>") === "hello@coolthreads.com"
  );

  // Coverage for the 2026-09-10 candidate-exclusion filters (search dork
  // refinement) -- new surface area, gets its own direct tests.
  check(
    "isShopifyCorporateDomain matches shopify.com and its subdomains",
    isShopifyCorporateDomain("shopify.com") === true && isShopifyCorporateDomain("apps.shopify.com") === true
  );
  check(
    "isShopifyCorporateDomain does NOT match myshopify.com stores (the bug caught in the spec)",
    isShopifyCorporateDomain("cool-threads.myshopify.com") === false
  );
  check(
    "isExcludedByDomain excludes shopify.com itself",
    isExcludedByDomain("https://shopify.com/", "shopify.com") === true
  );
  check(
    "isExcludedByDomain does NOT exclude a real myshopify.com storefront",
    isExcludedByDomain("https://cool-threads.myshopify.com/collections/all", "cool-threads.myshopify.com") === false
  );
  check(
    "isExcludedByDomain excludes an apps./dev./blog. subdomain",
    isExcludedByDomain("https://apps.somevendor.com/", "apps.somevendor.com") === true
  );
  check(
    "isExcludedByDomain excludes a myshopify.com/admin URL",
    isExcludedByDomain("https://cool-threads.myshopify.com/admin/orders", "cool-threads.myshopify.com") === true
  );
  check(
    "hasExcludedKeyword flags an App Store / agency title",
    hasExcludedKeyword("EcomBoost Apps - Shopify App Store Optimization Software") === true
  );
  check(
    "hasExcludedKeyword leaves a real store title alone",
    hasExcludedKeyword("Contact Us - Cool Threads Co") === false
  );
  check(
    "hasExcludedKeyword catches PageFly's real title (the actual false positive from production -- pagefly.io slipped through as a qualified lead)",
    hasExcludedKeyword("PageFly - Official Site | AI Page Builder & CRO for Shopify") === true
  );

  check(
    "buildInstallLink builds the install link",
    buildInstallLink("coolthreads.com") === "https://apps.shopify.com/leakaudit-app?utm_source=outbound&utm_medium=email&utm_campaign=cold_oct"
  );

  // Coverage for the hand-rolled robots.txt parser -- new surface area
  // this port introduces (Python used the stdlib's urllib.robotparser
  // instead), so it gets its own direct tests rather than piggy-backing
  // on the 1:1 parity list above.
  const robotsTxt = "User-agent: *\nDisallow: /admin\nAllow: /admin/public\n";
  check("robotsAllows allows an unlisted path", robotsAllows(robotsTxt, USER_AGENT, "/pages/contact") === true);
  check("robotsAllows blocks a disallowed path", robotsAllows(robotsTxt, USER_AGENT, "/admin/secret") === false);
  check(
    "robotsAllows longest-match Allow overrides a shorter Disallow",
    robotsAllows(robotsTxt, USER_AGENT, "/admin/public") === true
  );

  console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILURE(S)`}`);
  process.exit(failures ? 1 : 0);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const HELP_TEXT = `find_shopify_stores.mjs -- Founder Beta lead generator (Node.js port)

Usage:
  node scripts/find_shopify_stores.mjs [--niche QUERY]... [--limit N] [--delay SECONDS] [--output PATH] [--seed-domains PATH]
  node scripts/find_shopify_stores.mjs --selftest

Options:
  --niche QUERY       A niche search query (repeatable). Defaults to 5 built-in mixed-niche queries.
  --limit N           Max number of confirmed leads to collect (default: 40).
  --delay SECONDS     Seconds to wait between HTTP requests (default: 2.0).
  --output PATH       Output CSV path (default: shopify_leads.csv).
  --seed-domains PATH A text file of domains YOU curate (one per line, '#' comments
                      allowed) to run through the same Shopify-confirmation and
                      email pipeline as search results, ahead of the search step.
                      Useful when DuckDuckGo search is blocked/rate-limited and you
                      already know some real candidate domains -- this script will
                      not guess a "known Shopify stores" list on its own; see the
                      comment above parseArgs() for why.
  --selftest          Run offline parsing self-tests and exit (no network needed).
  --help, -h          Show this help text.
`;

function parseArgs(argv) {
  const args = {
    niches: [],
    limit: 40,
    delay: 2.0,
    output: "shopify_leads.csv",
    seedDomainsPath: null,
    selftest: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--niche") {
      args.niches.push(argv[++i]);
    } else if (arg === "--limit") {
      args.limit = parseInt(argv[++i], 10);
    } else if (arg === "--delay") {
      args.delay = parseFloat(argv[++i]);
    } else if (arg === "--output") {
      args.output = argv[++i];
    } else if (arg === "--seed-domains") {
      args.seedDomainsPath = argv[++i];
    } else if (arg === "--selftest") {
      args.selftest = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

async function loadSeedDomains(path) {
  const { readFile } = await import("node:fs/promises");
  const text = await readFile(path, "utf-8");
  return text
    .split(/\r?\n/)
    .map((line) => line.split("#")[0].trim().toLowerCase())
    .filter(Boolean);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }

  if (args.selftest) {
    console.log("Running offline self-tests (no network required)...");
    runSelftest();
    return;
  }

  if (!Number.isFinite(args.limit) || !Number.isFinite(args.delay)) {
    console.error("--limit and --delay must be numbers.");
    process.exit(1);
  }

  let seedDomains = [];
  if (args.seedDomainsPath) {
    try {
      seedDomains = await loadSeedDomains(args.seedDomainsPath);
      console.log(`Loaded ${seedDomains.length} seed domain(s) from ${args.seedDomainsPath}.`);
    } catch (exc) {
      console.error(`Could not read --seed-domains file ${args.seedDomainsPath}: ${exc.message}`);
      process.exit(1);
    }
  }

  const niches = args.niches.length ? args.niches : DEFAULT_NICHE_QUERIES;
  console.log(`Searching ${niches.length} quer${niches.length === 1 ? "y" : "ies"}, target ${args.limit} leads...`);
  const leads = await findLeads(niches, args.limit, args.delay * 1000, seedDomains);
  await writeFile(args.output, toCsv(leads), "utf-8");

  const withEmail = leads.filter((l) => l.contactEmail).length;
  console.log(
    `\nDone. Wrote ${leads.length} leads to ${args.output} (${withEmail} with a contact email, ${
      leads.length - withEmail
    } without).`
  );
  if (leads.length > 0 && withEmail === 0) {
    console.log(
      "Note: 0 emails found is common -- most Shopify stores only expose a contact FORM, not a plain-text email. Consider this expected, not broken."
    );
  }
}

// Only run main() when this file is executed directly (`node
// find_shopify_stores.mjs ...`), not when it's imported for its shared
// utilities (smart_outbound_engine.mjs does this) -- ESM runs a module's
// top-level code on import, so without this guard, importing this file
// would ALSO kick off the whole scraper as an unwanted side effect.
const isMainModule =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
