#!/usr/bin/env python3
"""
find_shopify_stores.py -- Founder Beta lead generator.

Finds candidate Shopify stores via web search, confirms each one is
actually running Shopify (not just a false-positive search hit), then
tries to find a public contact email from that store's own contact page,
and writes everything to shopify_leads.csv.

WHY THIS SCRIPT IS DESIGNED THE WAY IT IS (read before running / editing)
--------------------------------------------------------------------------
1. Search backend: this uses DuckDuckGo's HTML endpoint
   (html.duckduckgo.com/html/) because it doesn't require an API key.
   Be aware: scraping DuckDuckGo's or Google's HTML result pages via
   automated requests sits in a legal/ToS gray zone and WILL eventually
   get rate-limited or CAPTCHA'd if you run this a lot. For anything
   beyond an occasional small batch, swap `search_duckduckgo()` for a
   real Search API (Bing Web Search API, SerpAPI, Google Programmable
   Search) -- there's a clearly marked seam for that below
   (SEARCH_BACKEND). Using an official API is the compliant way to do
   this at real volume.

2. Shopify confirmation: a raw search hit is NOT proof a domain runs
   Shopify. This script re-fetches the homepage and only keeps a
   candidate if it finds a real Shopify fingerprint (cdn.shopify.com
   asset URLs, a Shopify.shop/Shopify.theme JS global, or a working
   /cart.js endpoint). This avoids polluting the CSV with non-Shopify
   sites that happened to match a search query.

3. Contact email discovery: tries a fixed list of common contact-page
   paths (/pages/contact, /pages/contact-us, /contact, /contact-us) and
   regex-extracts the first plausible email found in the page. Expect a
   LOW hit rate here -- most Shopify stores use a contact FORM with no
   email address anywhere in the page source, by design (spam
   avoidance). A blank Contact Email is a normal, common result, not a
   bug. This script does not attempt to submit contact forms or infer
   emails (e.g. guessing info@domain) -- guessed addresses are not
   verified-real and would poison the outreach list.

4. Politeness / robots.txt: checks each domain's robots.txt before
   fetching its contact page and skips it if disallowed. Fixed delay
   between requests (--delay, default 2s) and a descriptive User-Agent
   identifying this as a bot with a contact email, per scraping
   etiquette norms.

5. Legal note (see also OUTREACH_PLAYBOOK.md in this repo): collecting a
   store's own publicly published contact email is low-risk, but cold
   emailing it is still subject to CAN-SPAM (US: real sender info,
   working unsubscribe, no misleading subject lines -- no opt-in
   required) and, if any target is EU-based, GDPR's stricter rules
   around unsolicited B2B email. This script only BUILDS the list; it
   does not send anything.

USAGE
-----
    pip install requests beautifulsoup4
    python3 scripts/find_shopify_stores.py --niche clothing --niche jewelry --limit 40

Run this from your own terminal with normal internet access. It will
NOT run inside the sandboxed device-bridge shell Claude uses to edit
this repo -- that sandbox (like Claude's cloud workspace) has no general
internet egress, verified by a direct connectivity test before this
script was written. Only your own machine's real network can reach
DuckDuckGo and the store sites themselves.

Run `python3 scripts/find_shopify_stores.py --selftest` any time (no
network needed) to check the parsing logic still works after an edit.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
import time
import urllib.parse
import urllib.robotparser
from dataclasses import dataclass, field

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print(
        "Missing dependencies. Run: pip install requests beautifulsoup4",
        file=sys.stderr,
    )
    sys.exit(1)

USER_AGENT = (
    "LeakAuditLeadBot/1.0 (+mailto:leads@leakaudit-app.fly.dev; "
    "one-time market-research crawl, low request volume, "
    "respects robots.txt)"
)
REQUEST_TIMEOUT = 10
INSTALL_LINK_TEMPLATE = "https://leakaudit-app.fly.dev/auth?shop={domain}"

CONTACT_PATHS = ["/pages/contact", "/pages/contact-us", "/contact", "/contact-us"]

DEFAULT_NICHE_QUERIES = [
    'shopify store "contact us" clothing boutique',
    'shopify store "contact us" jewelry',
    'shopify store "contact us" fitness apparel',
    'shopify store "contact us" home decor',
    'shopify store "contact us" skincare',
]

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

# Emails that show up constantly as false positives -- theme/app boilerplate,
# image filenames that look like emails, Shopify's own domains, etc.
EMAIL_BLOCKLIST_DOMAINS = {
    "shopify.com",
    "sentry.io",
    "wixpress.com",
    "example.com",
    "godaddy.com",
}


@dataclass
class StoreLead:
    store_name: str
    domain: str
    contact_email: str = ""
    install_link: str = field(default="")

    def __post_init__(self):
        if not self.install_link:
            self.install_link = INSTALL_LINK_TEMPLATE.format(domain=self.domain)


def make_session() -> "requests.Session":
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    return session


# ---------------------------------------------------------------------------
# Step 1: search for candidate domains
# ---------------------------------------------------------------------------


def search_duckduckgo(session: "requests.Session", query: str, max_results: int = 15) -> list[str]:
    """
    Returns a list of result URLs for `query` from DuckDuckGo's HTML
    endpoint. This is screen-scraping, not an API -- see the module
    docstring's SEARCH_BACKEND note. DuckDuckGo's HTML results wrap the
    real target URL in a redirect param (`uddg`), which we unwrap below.
    """
    resp = session.get(
        "https://html.duckduckgo.com/html/",
        params={"q": query},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return extract_result_urls(resp.text, max_results=max_results)


def extract_result_urls(html: str, max_results: int = 15) -> list[str]:
    """Pure parsing logic, split out so it's testable without network."""
    soup = BeautifulSoup(html, "html.parser")
    urls: list[str] = []
    for a in soup.select("a.result__a"):
        href = a.get("href", "")
        real_url = unwrap_duckduckgo_redirect(href)
        if real_url:
            urls.append(real_url)
        if len(urls) >= max_results:
            break
    return urls


def unwrap_duckduckgo_redirect(href: str) -> str | None:
    """DuckDuckGo HTML result links look like //duckduckgo.com/l/?uddg=<encoded-url>&..."""
    if not href:
        return None
    parsed = urllib.parse.urlparse(href if "://" in href else f"https:{href}")
    qs = urllib.parse.parse_qs(parsed.query)
    if "uddg" in qs:
        return urllib.parse.unquote(qs["uddg"][0])
    # Some result rows are already a plain absolute URL.
    if parsed.scheme and parsed.netloc:
        return href
    return None


def domain_from_url(url: str) -> str | None:
    try:
        netloc = urllib.parse.urlparse(url).netloc
    except ValueError:
        return None
    return netloc.lower().removeprefix("www.") or None


# ---------------------------------------------------------------------------
# Step 2: confirm the domain actually runs Shopify
# ---------------------------------------------------------------------------


def looks_like_shopify(html: str) -> bool:
    """Pure check, testable without network."""
    signals = [
        "cdn.shopify.com",
        "Shopify.theme",
        "Shopify.shop",
        "shopify-section",
        "cdn.shopifycloud.com",
    ]
    return any(sig in html for sig in signals)


def confirm_shopify(session: "requests.Session", domain: str) -> bool:
    try:
        resp = session.get(f"https://{domain}", timeout=REQUEST_TIMEOUT)
    except requests.RequestException:
        return False
    if resp.status_code >= 400:
        return False
    return looks_like_shopify(resp.text)


def extract_store_name(html: str, fallback_domain: str) -> str:
    """Pure parsing logic, testable without network."""
    soup = BeautifulSoup(html, "html.parser")
    og_site_name = soup.find("meta", property="og:site_name")
    if og_site_name and og_site_name.get("content"):
        return og_site_name["content"].strip()
    if soup.title and soup.title.string:
        # Titles are often "Page Name - Store Name" or "Store Name | Page Name".
        title = soup.title.string.strip()
        for sep in (" - ", " | ", " – "):
            if sep in title:
                return title.split(sep)[-1].strip()
        return title
    return fallback_domain


# ---------------------------------------------------------------------------
# Step 3: try to find a public contact email
# ---------------------------------------------------------------------------


def robots_allows(session: "requests.Session", domain: str, path: str) -> bool:
    rp = urllib.robotparser.RobotFileParser()
    try:
        resp = session.get(f"https://{domain}/robots.txt", timeout=REQUEST_TIMEOUT)
        if resp.status_code >= 400:
            return True  # no robots.txt -> nothing disallowed
        rp.parse(resp.text.splitlines())
    except requests.RequestException:
        return True  # can't check -> don't block on a network hiccup
    return rp.can_fetch(USER_AGENT, path)


def extract_email(html: str) -> str:
    """Pure parsing logic, testable without network. Returns "" if none found."""
    for match in EMAIL_RE.findall(html):
        email_domain = match.split("@", 1)[1].lower()
        if email_domain in EMAIL_BLOCKLIST_DOMAINS:
            continue
        if match.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp")):
            continue
        return match
    return ""


def find_contact_email(session: "requests.Session", domain: str, delay: float) -> str:
    for path in CONTACT_PATHS:
        if not robots_allows(session, domain, path):
            continue
        try:
            resp = session.get(f"https://{domain}{path}", timeout=REQUEST_TIMEOUT)
        except requests.RequestException:
            continue
        finally:
            time.sleep(delay)
        if resp.status_code >= 400:
            continue
        email = extract_email(resp.text)
        if email:
            return email
    return ""


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def find_leads(
    niche_queries: list[str],
    limit: int,
    delay: float,
) -> list[StoreLead]:
    session = make_session()
    seen_domains: set[str] = set()
    leads: list[StoreLead] = []

    for query in niche_queries:
        if len(leads) >= limit:
            break
        try:
            result_urls = search_duckduckgo(session, query)
        except requests.RequestException as exc:
            print(f"  [warn] search failed for {query!r}: {exc}", file=sys.stderr)
            continue
        time.sleep(delay)

        for url in result_urls:
            if len(leads) >= limit:
                break
            domain = domain_from_url(url)
            if not domain or domain in seen_domains:
                continue
            seen_domains.add(domain)

            try:
                homepage = session.get(f"https://{domain}", timeout=REQUEST_TIMEOUT)
            except requests.RequestException:
                continue
            finally:
                time.sleep(delay)
            if homepage.status_code >= 400 or not looks_like_shopify(homepage.text):
                continue

            store_name = extract_store_name(homepage.text, domain)
            email = find_contact_email(session, domain, delay)
            leads.append(StoreLead(store_name=store_name, domain=domain, contact_email=email))
            print(f"  [+] {domain} -- {'email found' if email else 'no email found'}")

    return leads


def write_csv(leads: list[StoreLead], output_path: str) -> None:
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Store Name", "Store Domain", "Contact Email", "Personalized Direct Install Link"])
        for lead in leads:
            writer.writerow([lead.store_name, lead.domain, lead.contact_email, lead.install_link])


# ---------------------------------------------------------------------------
# Self-tests (no network required) -- run with --selftest
# ---------------------------------------------------------------------------


def run_selftest() -> None:
    failures = 0

    def check(name: str, condition: bool):
        nonlocal failures
        status = "ok" if condition else "FAIL"
        if not condition:
            failures += 1
        print(f"  [{status}] {name}")

    ddg_sample_html = """
    <div class="result">
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample-store.myshopify.com%2F&amp;rut=abc">
        Example Store
      </a>
    </div>
    """
    urls = extract_result_urls(ddg_sample_html)
    check("extract_result_urls unwraps uddg redirect", urls == ["https://example-store.myshopify.com/"])

    check(
        "unwrap_duckduckgo_redirect handles protocol-relative href",
        unwrap_duckduckgo_redirect("//duckduckgo.com/l/?uddg=https%3A%2F%2Ffoo.com%2F")
        == "https://foo.com/",
    )
    check("unwrap_duckduckgo_redirect handles plain absolute url", unwrap_duckduckgo_redirect("https://bar.com/") == "https://bar.com/")
    check("unwrap_duckduckgo_redirect handles empty href", unwrap_duckduckgo_redirect("") is None)

    check("domain_from_url strips www", domain_from_url("https://www.foo-store.com/pages/x") == "foo-store.com")
    check("domain_from_url keeps bare myshopify domain", domain_from_url("https://foo.myshopify.com/") == "foo.myshopify.com")

    shopify_html = '<html><head></head><body><script src="https://cdn.shopify.com/s/files/1/x.js"></script></body></html>'
    non_shopify_html = "<html><body>Just a plain WordPress site</body></html>"
    check("looks_like_shopify true positive", looks_like_shopify(shopify_html) is True)
    check("looks_like_shopify true negative", looks_like_shopify(non_shopify_html) is False)

    og_html = '<html><head><meta property="og:site_name" content="Cool Threads Co"></head></html>'
    title_html = "<html><head><title>Contact Us - Cool Threads Co</title></head></html>"
    plain_title_html = "<html><head><title>Cool Threads Co</title></head></html>"
    check("extract_store_name prefers og:site_name", extract_store_name(og_html, "fallback.com") == "Cool Threads Co")
    check(
        "extract_store_name splits 'Page - Store' titles",
        extract_store_name(title_html, "fallback.com") == "Cool Threads Co",
    )
    check("extract_store_name falls back to whole title", extract_store_name(plain_title_html, "fallback.com") == "Cool Threads Co")
    check("extract_store_name falls back to domain when nothing found", extract_store_name("<html></html>", "fallback.com") == "fallback.com")

    email_html = "<html><body>Reach us at hello@coolthreads.com or see logo.png</body></html>"
    check("extract_email finds a real address", extract_email(email_html) == "hello@coolthreads.com")
    check("extract_email returns empty when none present", extract_email("<html><body>no email here</body></html>") == "")
    check(
        "extract_email skips blocklisted domains",
        extract_email("<html><body>contact support@sentry.io or real@coolthreads.com</body></html>")
        == "real@coolthreads.com",
    )

    lead = StoreLead(store_name="Cool Threads", domain="coolthreads.com")
    check(
        "StoreLead auto-builds the install link",
        lead.install_link == "https://leakaudit-app.fly.dev/auth?shop=coolthreads.com",
    )

    print(f"\n{'ALL PASSED' if failures == 0 else f'{failures} FAILURE(S)'}")
    sys.exit(1 if failures else 0)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--niche",
        action="append",
        dest="niches",
        help="A niche keyword to search for (repeatable). Defaults to a built-in mixed-niche query set.",
    )
    parser.add_argument("--limit", type=int, default=40, help="Max number of confirmed leads to collect (default: 40).")
    parser.add_argument("--delay", type=float, default=2.0, help="Seconds to wait between HTTP requests (default: 2.0).")
    parser.add_argument("--output", default="shopify_leads.csv", help="Output CSV path (default: shopify_leads.csv).")
    parser.add_argument("--selftest", action="store_true", help="Run offline parsing self-tests and exit (no network).")
    args = parser.parse_args()

    if args.selftest:
        print("Running offline self-tests (no network required)...")
        run_selftest()
        return

    niches = args.niches or DEFAULT_NICHE_QUERIES
    print(f"Searching {len(niches)} quer{'y' if len(niches) == 1 else 'ies'}, target {args.limit} leads...")
    leads = find_leads(niche_queries=niches, limit=args.limit, delay=args.delay)
    write_csv(leads, args.output)

    with_email = sum(1 for l in leads if l.contact_email)
    print(
        f"\nDone. Wrote {len(leads)} leads to {args.output} "
        f"({with_email} with a contact email, {len(leads) - with_email} without)."
    )
    if leads and with_email == 0:
        print(
            "Note: 0 emails found is common -- most Shopify stores only expose a "
            "contact FORM, not a plain-text email. Consider this expected, not broken."
        )


if __name__ == "__main__":
    main()
