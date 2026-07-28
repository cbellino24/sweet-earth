#!/usr/bin/env python3
"""
Merge site-wide JSON-LD onto every HTML page:
- Removes existing <script type="application/ld+json"> blocks (typically in <head>).
- Injects one canonical @graph before the first <script src="js/nav.js">.
- Preserves page-specific nodes from the old graph (WebPage, FAQPage, ContactPage, etc.)
  while dropping duplicate WebSite / LocalBusiness / ProfessionalService stubs.
- Rewrites references to https://www.452digitalco.com/#localbusiness -> .../#business
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

LD_JSON_RE = re.compile(
    r"<script\s+type=\"application/ld\+json\"\s*>(.*?)</script>",
    re.DOTALL | re.IGNORECASE,
)

NAV_SCRIPT_RE = re.compile(r"(<script\s+src=\"js/nav\.js\"[^>]*>\s*</script>)", re.IGNORECASE)

LOCALBUSINESS_REF = "https://www.452digitalco.com/#localbusiness"
BUSINESS_REF = "https://www.452digitalco.com/#business"
WEBSITE_REF = "https://www.452digitalco.com/#website"
ORG_REF = "https://www.452digitalco.com/#organization"

SERVICE_AREAS = [
    "Omaha",
    "Papillion",
    "Bellevue",
    "Gretna",
    "Elkhorn",
    "Lincoln",
    "La Vista",
    "Ralston",
    "Bennington",
    "Fremont",
    "Schuyler",
]

SKIP_TYPES = frozenset({"WebSite", "Organization", "BreadcrumbList"})


def node_primary_type(node: dict) -> set[str]:
    t = node.get("@type")
    if isinstance(t, list):
        return {str(x) for x in t}
    if t:
        return {str(t)}
    return set()


def should_drop_old_node(node: dict) -> bool:
    types = node_primary_type(node)
    if types & SKIP_TYPES:
        return True
    # Drop standalone LocalBusiness / ProfessionalService entities from old graphs;
    # canonical combined entity is injected separately.
    if types <= {"LocalBusiness"}:
        return True
    if types <= {"ProfessionalService"}:
        return True
    if types == {"LocalBusiness", "ProfessionalService"}:
        return True
    if types <= {"BreadcrumbList"}:
        return True
    return False


def fix_localbusiness_refs(obj: object) -> None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            if v == LOCALBUSINESS_REF:
                obj[k] = BUSINESS_REF
            else:
                fix_localbusiness_refs(v)
    elif isinstance(obj, list):
        for item in obj:
            fix_localbusiness_refs(item)


def extract_extra_graph(html: str) -> list[dict]:
    extras: list[dict] = []
    for m in LD_JSON_RE.finditer(html):
        raw = m.group(1).strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        graph = data.get("@graph")
        if not isinstance(graph, list):
            continue
        for node in graph:
            if not isinstance(node, dict):
                continue
            if should_drop_old_node(node):
                continue
            fix_localbusiness_refs(node)
            extras.append(node)
    return extras


def strip_ld_json_scripts(html: str) -> str:
    return LD_JSON_RE.sub("", html)


def area_served_nodes() -> list[dict]:
    nodes = []
    for city in SERVICE_AREAS:
        nodes.append({"@type": "City", "name": f"{city}, Nebraska"})
    nodes.append({"@type": "State", "name": "Nebraska"})
    return nodes


def service_node(sid: str, name: str, service_type: str | None = None) -> dict:
    return {
        "@type": "Service",
        "@id": f"https://www.452digitalco.com/#service-{sid}",
        "name": name,
        "serviceType": service_type or name,
        "provider": {"@id": BUSINESS_REF},
        "areaServed": area_served_nodes(),
    }


def canonical_graph() -> list[dict]:
    services = [
        service_node("website-design", "Website Design"),
        service_node("web-development", "Web Development"),
        service_node("local-seo", "Local SEO"),
        service_node("website-redesign", "Website Redesign"),
        service_node("ecommerce", "E-commerce Stores"),
        service_node("graphic-design", "Graphic Design"),
        service_node("drone-services", "Drone Services"),
        service_node("google-ads", "Google Ads"),
        service_node("analytics", "Website Analytics"),
        service_node("google-business-profile", "Google Business Profile & Apple Maps"),
        service_node("branding-identity", "Branding & Identity"),
        service_node("event-websites", "Event Websites"),
        service_node("restaurant-web-design", "Restaurant Web Design"),
        service_node("spanish-web", "Paginas Web En Español"),
    ]
    return [
        {
            "@type": "WebSite",
            "@id": WEBSITE_REF,
            "url": "https://www.452digitalco.com/",
            "name": "452 Digital Co.",
            "publisher": {"@id": ORG_REF},
            "inLanguage": "en",
        },
        {
            "@type": "Organization",
            "@id": ORG_REF,
            "name": "452 Digital Co.",
            "url": "https://www.452digitalco.com/",
            "logo": "https://www.452digitalco.com/images/graphic-design-in-omaha-logo.png",
            "telephone": "+1-402-804-3315",
            "email": "hello@452digitalco.com",
            "sameAs": [
                "https://www.facebook.com/452.digital",
                "https://www.instagram.com/452.digitalco/",
            ],
        },
        {
            "@type": ["LocalBusiness", "ProfessionalService"],
            "@id": BUSINESS_REF,
            "name": "452 Digital Co.",
            "url": "https://www.452digitalco.com/",
            "telephone": "+1-402-804-3315",
            "email": "hello@452digitalco.com",
            "image": "https://www.452digitalco.com/images/graphic-design-in-omaha-logo.png",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": "Papillion",
                "addressRegion": "NE",
                "addressCountry": "US",
            },
            "areaServed": area_served_nodes(),
            "brand": {"@id": ORG_REF},
            "parentOrganization": {"@id": ORG_REF},
            "isPartOf": {"@id": WEBSITE_REF},
            "sameAs": [
                "https://www.facebook.com/452.digital",
                "https://www.instagram.com/452.digitalco/",
            ],
        },
        *services,
    ]


PAGE_BREADCRUMBS: dict[str, list[tuple[str, str]]] = {
    "services.html": [("Services", "https://www.452digitalco.com/services")],
    "website-design.html": [("Services", "https://www.452digitalco.com/services"), ("Website Design", "https://www.452digitalco.com/website-design")],
    "website-development.html": [("Services", "https://www.452digitalco.com/services"), ("Web Development", "https://www.452digitalco.com/website-development")],
    "website-analytics.html": [("Services", "https://www.452digitalco.com/services"), ("Analytics", "https://www.452digitalco.com/website-analytics")],
    "ecommerce-stores.html": [("Services", "https://www.452digitalco.com/services"), ("E-commerce", "https://www.452digitalco.com/ecommerce-stores")],
    "graphic-design-company.html": [("Services", "https://www.452digitalco.com/services"), ("Graphic Design", "https://www.452digitalco.com/graphic-design-company")],
    "drone-services.html": [("Services", "https://www.452digitalco.com/services"), ("Drone Services", "https://www.452digitalco.com/drone-services")],
    "google-ads.html": [("Services", "https://www.452digitalco.com/services"), ("Google Ads", "https://www.452digitalco.com/google-ads")],
    "search-engine-optimization.html": [("Services", "https://www.452digitalco.com/services"), ("SEO", "https://www.452digitalco.com/search-engine-optimization")],
    "google-business-profile-apple-maps.html": [("Services", "https://www.452digitalco.com/services"), ("Google Business Profile", "https://www.452digitalco.com/google-business-profile-apple-maps")],
    "branding-identity.html": [("Services", "https://www.452digitalco.com/services"), ("Branding & Identity", "https://www.452digitalco.com/branding-identity")],
    "event-websites.html": [("Services", "https://www.452digitalco.com/services"), ("Event Websites", "https://www.452digitalco.com/event-websites")],
    "restaurant-web-design-company-omaha.html": [("Services", "https://www.452digitalco.com/services"), ("Restaurant Web Design", "https://www.452digitalco.com/restaurant-web-design-company-omaha")],
    "paginas-web-en-espanol-omaha.html": [("Services", "https://www.452digitalco.com/services"), ("Paginas Web En Español", "https://www.452digitalco.com/paginas-web-en-espanol-omaha")],
    "omaha-web-design-company.html": [("Omaha Web Design", "https://www.452digitalco.com/omaha-web-design-company")],
    "papillion-web-design-company.html": [("Papillion Web Design", "https://www.452digitalco.com/papillion-web-design-company")],
    "lincoln-web-design.html": [("Lincoln Web Design", "https://www.452digitalco.com/lincoln-web-design")],
    "schuyler-ne-web-design-company.html": [("Schuyler Web Design", "https://www.452digitalco.com/schuyler-ne-web-design-company")],
    "fremont-website-design-company.html": [("Fremont Web Design", "https://www.452digitalco.com/fremont-website-design-company")],
    "work.html": [("Work", "https://www.452digitalco.com/work")],
    "about.html": [("About", "https://www.452digitalco.com/about")],
    "contact.html": [("Contact", "https://www.452digitalco.com/contact")],
    "blog.html": [("Blog", "https://www.452digitalco.com/blog")],
    "blog-own-your-website.html": [("Blog", "https://www.452digitalco.com/blog"), ("Own Your Website", "https://www.452digitalco.com/blog-own-your-website")],
    "testimonials.html": [("Testimonials", "https://www.452digitalco.com/testimonials")],
}

WORK_CREATIVEWORKS = [
    ("bellino-fireworks", "Bellino Fireworks", "https://bellinofireworks.com", "images/bellino-fireworks-in-omaha.jpg"),
    ("lincoln-tent", "Lincoln Tent", "https://lincolntent.com", "images/lincoln-tent-event-tent-rental-website-omaha-1.jpg"),
    ("las-chilenas", "Las Chilenas", "https://laschilenas.com", "images/laschilenas-coffee-in-omaha.jpg"),
    ("lux-american-grill", "Lux American Grill", "https://luxamericangrill.com", "images/lux-american-grill-omaha-restaurant-signage.jpg"),
    ("el-tikal-market", "El Tikal Market", "https://tikalmarket-ne.com", "images/tikal-market-en-omaha.jpg"),
    ("goliath-hats", "Goliath Hats", "https://goliathhats.com", "images/ecommerce-website-omaha-goliath-hats.jpg-1.png"),
    ("reynoso-auto", "Reynoso Auto Repair", "https://reynosoautomotive.com", "images/reynoso-auto-repair-in-omaha.jpg"),
    ("integrity-diesel", "Integrity Diesel", "https://integritydieselusa.com", "images/integrity-diesel-weeping-water-ne.jpg"),
]


def breadcrumb_list(filename: str, page_url: str) -> dict:
    crumbs = [("Home", "https://www.452digitalco.com/")]
    crumbs.extend(PAGE_BREADCRUMBS.get(filename, []))
    if filename == "index.html":
        crumbs = [("Home", "https://www.452digitalco.com/")]
    items = []
    for i, (name, url) in enumerate(crumbs, start=1):
        items.append(
            {
                "@type": "ListItem",
                "position": i,
                "name": name,
                "item": url,
            }
        )
    return {
        "@type": "BreadcrumbList",
        "@id": page_url + "#breadcrumb",
        "itemListElement": items,
    }


def creative_work_nodes() -> list[dict]:
    nodes = []
    for slug, name, url, image in WORK_CREATIVEWORKS:
        nodes.append(
            {
                "@type": "CreativeWork",
                "@id": f"https://www.452digitalco.com/work#project-{slug}",
                "name": name,
                "url": url,
                "image": f"https://www.452digitalco.com/{image}",
                "creator": {"@id": BUSINESS_REF},
                "isPartOf": {"@id": "https://www.452digitalco.com/work#webpage"},
            }
        )
    return nodes


DEFAULT_WEBPAGES: dict[str, tuple[str, str, str]] = {
    # filename: (canonical_url, page_name, description)
    "index.html": (
        "https://www.452digitalco.com/",
        "452 Digital Co. | Web Design & SEO in Papillion + Omaha",
        "452 Digital Co. offers local web design and SEO in Papillion and Omaha, Nebraska, with clear measurement and sites your team can own.",
    ),
    "work.html": (
        "https://www.452digitalco.com/work",
        "Work | 452 Digital Co.",
        "A sample of recent website builds and local SEO work by 452 Digital Co. in Papillion and Omaha, Nebraska.",
    ),
    "blog.html": (
        "https://www.452digitalco.com/blog",
        "Blog | 452 Digital Co.",
        "Web design, local SEO, and tracking tips for Omaha + Papillion businesses.",
    ),
    "testimonials.html": (
        "https://www.452digitalco.com/testimonials",
        "Testimonials | 452 Digital Co.",
        "Google reviews from local businesses we've built for — straightforward web design, local SEO structure, and sites clients own.",
    ),
    "thank-you.html": (
        "https://www.452digitalco.com/thank-you",
        "Thanks for subscribing | 452 Digital Co.",
        "Thanks for subscribing to 452 Digital Co.",
    ),
}


def default_webpage(filename: str) -> dict | None:
    spec = DEFAULT_WEBPAGES.get(filename)
    if not spec:
        return None
    url, name, desc = spec
    frag = "#webpage" if filename != "index.html" else "#home-webpage"
    return {
        "@type": "WebPage",
        "@id": url + frag,
        "url": url,
        "name": name,
        "description": desc,
        "isPartOf": {"@id": "https://www.452digitalco.com/#website"},
        "about": {"@id": BUSINESS_REF},
        "inLanguage": "en",
    }


def article_for_blog_post() -> dict:
    return {
        "@type": "BlogPosting",
        "@id": "https://www.452digitalco.com/blog-own-your-website#article",
        "mainEntityOfPage": {"@id": "https://www.452digitalco.com/blog-own-your-website#webpage"},
        "headline": "Why It’s Important to Own Your Website",
        "description": "Why website ownership matters for small businesses: avoid the website rental model, keep admin access, and make sure your site (and domain) stays under your control.",
        "url": "https://www.452digitalco.com/blog-own-your-website",
        "inLanguage": "en",
        "publisher": {"@id": "https://www.452digitalco.com/#organization"},
        "author": {"@id": "https://www.452digitalco.com/#organization"},
        "isPartOf": {"@id": "https://www.452digitalco.com/#website"},
    }


def merge_unique_by_id(nodes: list[dict]) -> list[dict]:
    """Later nodes win on duplicate @id (page-specific overrides)."""
    by_id: dict[str, dict] = {}
    no_id: list[dict] = []
    for node in nodes:
        _id = node.get("@id") if isinstance(node, dict) else None
        if isinstance(_id, str) and _id:
            by_id[_id] = node
        else:
            no_id.append(node)
    # Preserve stable order: first occurrence order for ids
    ordered_ids: list[str] = []
    seen: set[str] = set()
    for node in nodes:
        _id = node.get("@id") if isinstance(node, dict) else None
        if isinstance(_id, str) and _id and _id not in seen:
            seen.add(_id)
            ordered_ids.append(_id)
    merged = [by_id[i] for i in ordered_ids]
    return merged + no_id


def graph_has_type(nodes: list[dict], schema_type: str) -> bool:
    for node in nodes:
        if not isinstance(node, dict):
            continue
        t = node.get("@type")
        if isinstance(t, list):
            if schema_type in t:
                return True
        elif t == schema_type:
            return True
    return False


def blog_own_webpage() -> dict:
    return {
        "@type": "WebPage",
        "@id": "https://www.452digitalco.com/blog-own-your-website#webpage",
        "url": "https://www.452digitalco.com/blog-own-your-website",
        "name": "Why It’s Important to Own Your Website | 452 Digital Co.",
        "description": "Why website ownership matters for small businesses: avoid the website rental model, keep admin access, and make sure your site (and domain) stays under your control.",
        "isPartOf": {"@id": "https://www.452digitalco.com/#website"},
        "about": {"@id": BUSINESS_REF},
        "inLanguage": "en",
    }


def page_url_from_extras(extras: list[dict], filename: str) -> str:
    for node in extras:
        if isinstance(node, dict) and node.get("@type") == "WebPage" and node.get("url"):
            return str(node["url"])
    if filename == "index.html":
        return "https://www.452digitalco.com/"
    return f"https://www.452digitalco.com/{filename}"


def inject_into_html(path: Path) -> None:
    html = path.read_text(encoding="utf-8")
    extras = extract_extra_graph(html)
    html = strip_ld_json_scripts(html)

    core = canonical_graph()

    filename = path.name
    if filename == "blog-own-your-website.html":
        if not graph_has_type(extras, "WebPage"):
            extras.insert(0, blog_own_webpage())
        if not graph_has_type(extras, "BlogPosting"):
            extras.insert(1, article_for_blog_post())
    elif not graph_has_type(extras, "WebPage"):
        wp = default_webpage(filename)
        if wp:
            extras.insert(0, wp)

    page_url = page_url_from_extras(extras, filename)
    if not graph_has_type(extras, "BreadcrumbList"):
        extras.append(breadcrumb_list(filename, page_url))

    if filename == "work.html":
        for cw in creative_work_nodes():
            extras.append(cw)

    graph = merge_unique_by_id(core + extras)

    payload = {"@context": "https://schema.org", "@graph": graph}
    script = (
        '<script type="application/ld+json">\n'
        + json.dumps(payload, indent=2, ensure_ascii=False)
        + "\n</script>\n\n    "
    )

    m = NAV_SCRIPT_RE.search(html)
    if not m:
        raise RuntimeError(f"No js/nav.js script tag found in {path}")

    html = NAV_SCRIPT_RE.sub(script + m.group(1), html, count=1)
    path.write_text(html, encoding="utf-8")


def main() -> None:
    for path in sorted(ROOT.glob("*.html")):
        inject_into_html(path)
        print(f"updated {path.name}")


if __name__ == "__main__":
    main()
