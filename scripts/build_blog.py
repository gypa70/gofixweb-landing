#!/usr/bin/env python3
"""Render blog/posts/*.md into static HTML (GitHub Pages) and Worker data."""

from __future__ import annotations

import html
import json
import re
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS_DIR = ROOT / "blog" / "posts"
BLOG_DIR = ROOT / "blog"
WORKER_DATA = ROOT / "worker" / "src" / "blog-posts.generated.js"
SITE = "https://gofixweb.com"
OG_IMAGE = f"{SITE}/blog/og.png"

MONTHS_CS = (
    "",
    "ledna",
    "února",
    "března",
    "dubna",
    "května",
    "června",
    "července",
    "srpna",
    "září",
    "října",
    "listopadu",
    "prosince",
)


def parse_frontmatter(raw: str) -> tuple[dict[str, str], str]:
    text = raw.lstrip("\ufeff")
    if not text.startswith("---"):
        raise ValueError("missing frontmatter")
    end = text.find("\n---", 3)
    if end < 0:
        raise ValueError("unterminated frontmatter")
    meta: dict[str, str] = {}
    for line in text[3:end].splitlines():
        line = line.strip()
        if not line or line == "---" or ":" not in line:
            continue
        key, value = line.split(":", 1)
        meta[key.strip()] = value.strip().strip('"').strip("'")
    body = text[end + 4 :].lstrip("\n")
    return meta, body


def inline_md(text: str) -> str:
    s = html.escape(text, quote=False)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", s)
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', s)
    return s


def md_to_html(md: str) -> str:
    lines = md.replace("\r\n", "\n").split("\n")
    out: list[str] = []
    para: list[str] = []
    list_kind: str | None = None

    def flush_para() -> None:
        nonlocal para
        if para:
            out.append("<p>" + inline_md(" ".join(para)) + "</p>")
            para = []

    def flush_list() -> None:
        nonlocal list_kind
        if list_kind:
            out.append(f"</{list_kind}>")
            list_kind = None

    for line in lines:
        stripped = line.strip()
        ol = re.match(r"^(\d+)\.\s+(.*)$", stripped)
        if stripped.startswith("## "):
            flush_para()
            flush_list()
            out.append(f"<h2>{inline_md(stripped[3:])}</h2>")
        elif stripped.startswith("### "):
            flush_para()
            flush_list()
            out.append(f"<h3>{inline_md(stripped[4:])}</h3>")
        elif stripped.startswith("# "):
            flush_para()
            flush_list()
            out.append(f"<h2>{inline_md(stripped[2:])}</h2>")
        elif stripped.startswith("- "):
            flush_para()
            if list_kind != "ul":
                flush_list()
                out.append("<ul>")
                list_kind = "ul"
            out.append(f"<li>{inline_md(stripped[2:])}</li>")
        elif ol:
            flush_para()
            if list_kind != "ol":
                flush_list()
                out.append("<ol>")
                list_kind = "ol"
            out.append(f"<li>{inline_md(ol.group(2))}</li>")
        elif stripped == "---":
            flush_para()
            flush_list()
            out.append("<hr>")
        elif not stripped:
            flush_para()
            flush_list()
        else:
            if list_kind:
                flush_list()
            para.append(stripped)
    flush_para()
    flush_list()
    return "\n".join(out)


def parse_date(raw: str) -> date:
    return datetime.strptime(raw.strip(), "%Y-%m-%d").date()


def format_date_cs(value: date) -> str:
    return f"{value.day}. {MONTHS_CS[value.month]} {value.year}"


def load_posts() -> list[dict]:
    posts: list[dict] = []
    if not POSTS_DIR.is_dir():
        raise FileNotFoundError(str(POSTS_DIR))
    for path in sorted(POSTS_DIR.glob("*.md")):
        meta, body = parse_frontmatter(path.read_text(encoding="utf-8"))
        slug = meta.get("slug") or path.stem
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
            raise ValueError(f"bad slug in {path.name}: {slug}")
        title = meta["title"]
        description = meta["description"]
        published = parse_date(meta["date"])
        posts.append(
            {
                "slug": slug,
                "title": title,
                "description": description,
                "date": published.isoformat(),
                "date_label": format_date_cs(published),
                "body_html": md_to_html(body),
                "url": f"{SITE}/blog/{slug}/",
            }
        )
    posts.sort(key=lambda item: item["date"], reverse=True)
    if not posts:
        raise RuntimeError("no blog posts")
    return posts


SHARED_CSS = """
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --navy: #1a2332;
      --navy-light: #243044;
      --navy-card: #2a3548;
      --white: #ffffff;
      --text-light: #cbd5e1;
      --text-muted: #94a3b8;
      --green: #16a34a;
      --green-light: #22c55e;
      --green-bg: rgba(22, 163, 74, 0.12);
      --border: rgba(255, 255, 255, 0.08);
      --max: 1080px;
      --header-h: 4.5rem;
    }
    html { scroll-behavior: smooth; scroll-padding-top: var(--header-h); }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--navy);
      color: var(--white);
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      -webkit-font-smoothing: antialiased;
    }
    a { color: inherit; text-decoration: none; }
    .container { width: min(var(--max), 92vw); margin: 0 auto; }
    header {
      padding: 0.7rem 0;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      background: rgba(26, 35, 50, 0.92);
      backdrop-filter: blur(8px);
      z-index: 20;
    }
    .header-inner {
      display: flex;
      align-items: center;
      gap: 0.75rem 1.25rem;
      min-width: 0;
    }
    .brand { flex-shrink: 0; }
    .logo {
      font-size: 1.55rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.05;
    }
    .logo span { color: var(--green); }
    .site-nav {
      display: flex;
      align-items: center;
      gap: 0.1rem;
      margin-left: auto;
      min-width: 0;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-x: contain;
      scrollbar-width: none;
    }
    .site-nav::-webkit-scrollbar { display: none; }
    .site-nav a {
      flex: 0 0 auto;
      color: var(--text-muted);
      font-size: 1.1rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      white-space: nowrap;
      border-bottom: 2px solid transparent;
    }
    .site-nav a:hover {
      color: var(--white);
      background: rgba(255, 255, 255, 0.05);
    }
    .site-nav a.is-active {
      color: var(--green-light);
      border-bottom-color: var(--green);
    }
    main { flex: 1; padding: 3.5rem 0 4.5rem; }
    footer {
      padding: 2.25rem 0;
      border-top: 1px solid var(--border);
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9rem;
    }
    footer a { color: var(--green); font-weight: 500; }
    footer a:hover { text-decoration: underline; }
    .footer-links {
      margin-top: 0.5rem;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.5rem 1rem;
    }
    .blog-kicker {
      color: var(--green-light);
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-size: 0.82rem;
      margin-bottom: 0.65rem;
    }
    .blog-index h1, .article h1 {
      font-size: clamp(1.65rem, 3.2vw, 2.15rem);
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 0.75rem;
      max-width: 22ch;
    }
    .blog-lead {
      color: var(--text-muted);
      max-width: 48ch;
      margin-bottom: 2.25rem;
    }
    .blog-list {
      display: grid;
      gap: 1rem;
    }
    .blog-card {
      display: block;
      background: var(--navy-card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.35rem 1.4rem 1.4rem;
    }
    .blog-card:hover { border-color: rgba(34, 197, 94, 0.35); }
    .blog-card.featured { padding: 1.6rem 1.55rem 1.7rem; }
    .blog-card time, .article-meta {
      display: block;
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-bottom: 0.45rem;
    }
    .blog-card h2 {
      font-size: 1.22rem;
      font-weight: 750;
      letter-spacing: -0.02em;
      margin-bottom: 0.45rem;
    }
    .blog-card.featured h2 { font-size: 1.45rem; }
    .blog-card p { color: var(--text-light); }
    .article { max-width: 42rem; }
    .article-meta { margin-bottom: 1.5rem; }
    .article h2 {
      font-size: 1.25rem;
      font-weight: 750;
      letter-spacing: -0.02em;
      margin: 2rem 0 0.7rem;
    }
    .article h3 {
      font-size: 1.05rem;
      font-weight: 700;
      margin: 1.4rem 0 0.5rem;
    }
    .article p, .article li { color: var(--text-light); }
    .article p { margin-bottom: 0.95rem; }
    .article ul, .article ol { padding-left: 1.25rem; margin: 0 0 1.1rem; }
    .article li { margin-bottom: 0.4rem; }
    .article a { color: var(--green); font-weight: 600; }
    .article a:hover { text-decoration: underline; }
    .article strong { color: var(--white); }
    .article code {
      font-size: 0.9em;
      background: rgba(255,255,255,0.06);
      padding: 0.1em 0.35em;
      border-radius: 4px;
    }
    .article hr {
      border: 0;
      border-top: 1px solid var(--border);
      margin: 1.75rem 0;
    }
    .article-back {
      display: inline-block;
      color: var(--text-muted);
      font-weight: 600;
      margin-bottom: 1.35rem;
    }
    .article-back:hover { color: var(--green-light); }
    .article-cta {
      margin-top: 2.25rem;
      padding: 1.2rem 1.3rem;
      background: var(--navy-card);
      border: 1px solid var(--border);
      border-radius: 12px;
    }
    .article-cta p { margin: 0; }
    @media (max-width: 768px) {
      :root { --header-h: 4.15rem; }
      .logo { font-size: 1.28rem; }
      .site-nav a { font-size: 0.95rem; padding: 0.42rem 0.55rem; }
      main { padding: 2.5rem 0 3.25rem; }
      .blog-card, .blog-card.featured { padding: 1.15rem 1.1rem; }
      .blog-card.featured h2 { font-size: 1.22rem; }
    }
"""


def nav_html() -> str:
    return """
  <header>
    <div class="container header-inner">
      <a class="brand" href="/" aria-label="GoFixWeb — úvod">
        <div class="logo">GoFix<span>Web</span></div>
      </a>
      <nav class="site-nav" aria-label="Sekce stránky">
        <a href="/#signup-form">Report zdarma</a>
        <a href="/#reseni">Jak to funguje</a>
        <a href="/#tarify">Ceník</a>
        <a href="/blog/" class="is-active" aria-current="page">Blog</a>
        <a href="/#faq">FAQ</a>
        <a href="/#kontakt">Kontakt</a>
      </nav>
    </div>
  </header>
""".strip()


def footer_html() -> str:
    return """
  <footer>
    <div class="container">
      <p>© 2026 FinalEdge s.r.o. / GoFixWeb</p>
      <div class="footer-links">
        <a href="/">gofixweb.com</a>
        <span aria-hidden="true">|</span>
        <a href="mailto:info@gofixweb.com">info@gofixweb.com</a>
        <span aria-hidden="true">|</span>
        <a href="/terms.html?v=20260902">Obchodní podmínky</a>
        <span aria-hidden="true">|</span>
        <a href="/privacy.html?v=20260815">Ochrana osobních údajů</a>
      </div>
    </div>
  </footer>
""".strip()


def page_html(
    *,
    title: str,
    description: str,
    canonical: str,
    og_type: str,
    extra_head: str,
    body: str,
) -> str:
    desc = html.escape(description, quote=True)
    full_title = html.escape(title, quote=True)
    canon = html.escape(canonical, quote=True)
    return f"""<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{full_title}</title>
  <meta name="description" content="{desc}">
  <link rel="canonical" href="{canon}">
  <meta property="og:type" content="{og_type}">
  <meta property="og:site_name" content="GoFixWeb">
  <meta property="og:locale" content="cs_CZ">
  <meta property="og:title" content="{full_title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:url" content="{canon}">
  <meta property="og:image" content="{html.escape(OG_IMAGE, quote=True)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{full_title}">
  <meta name="twitter:description" content="{desc}">
  <meta name="twitter:image" content="{html.escape(OG_IMAGE, quote=True)}">
  {extra_head}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>{SHARED_CSS}</style>
</head>
<body>
{nav_html()}
  <main>
    <div class="container">
{body}
    </div>
  </main>
{footer_html()}
</body>
</html>
"""


def index_body(posts: list[dict]) -> str:
    cards = []
    for i, post in enumerate(posts):
        featured = " featured" if i == 0 else ""
        cards.append(
            f"""      <a class="blog-card{featured}" href="/blog/{html.escape(post["slug"])}/">
        <time datetime="{html.escape(post["date"])}">{html.escape(post["date_label"])}</time>
        <h2>{html.escape(post["title"])}</h2>
        <p>{html.escape(post["description"])}</p>
      </a>"""
        )
    return f"""      <div class="blog-index">
        <p class="blog-kicker">Blog</p>
        <h1>Rychlost, SEO a opravy e-shopů</h1>
        <p class="blog-lead">Praktické texty pro provozovatele WooCommerce a dalších e-shopů. Bez newsletteru, bez paywallu.</p>
        <div class="blog-list">
{chr(10).join(cards)}
        </div>
      </div>"""


def article_body(post: dict) -> str:
    return f"""      <article class="article">
        <a class="article-back" href="/blog/">← Všechny články</a>
        <p class="blog-kicker">Blog</p>
        <h1>{html.escape(post["title"])}</h1>
        <time class="article-meta" datetime="{html.escape(post["date"])}">{html.escape(post["date_label"])}</time>
        {post["body_html"]}
        <div class="article-cta">
          <p>Chcete stejný typ kontroly na svém e-shopu? <a href="/#signup-form">Bezplatný report do 10 minut</a> — nebo se podívejte na <a href="/#faq">FAQ</a> a <a href="/#tarify">ceník</a>.</p>
        </div>
      </article>"""


def json_ld(post: dict) -> str:
    payload = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post["title"],
        "description": post["description"],
        "datePublished": post["date"],
        "dateModified": post["date"],
        "inLanguage": "cs",
        "url": post["url"],
        "image": OG_IMAGE,
        "author": {"@type": "Organization", "name": "GoFixWeb", "url": SITE},
        "publisher": {
            "@type": "Organization",
            "name": "FinalEdge s.r.o.",
            "url": SITE,
        },
        "mainEntityOfPage": post["url"],
    }
    dumped = json.dumps(payload, ensure_ascii=False)
    return f'<script type="application/ld+json">{dumped}</script>'


def write_pages(posts: list[dict]) -> dict[str, str]:
    pages: dict[str, str] = {}
    index = page_html(
        title="Blog — GoFixWeb",
        description="Články o SEO, rychlosti a opravách e-shopů. PageSpeed, WooCommerce a praktické kontroly, které zvládnete sami.",
        canonical=f"{SITE}/blog/",
        og_type="website",
        extra_head="",
        body=index_body(posts),
    )
    pages["index"] = index
    BLOG_DIR.mkdir(parents=True, exist_ok=True)
    (BLOG_DIR / "index.html").write_text(index, encoding="utf-8")
    for post in posts:
        slug_dir = BLOG_DIR / post["slug"]
        slug_dir.mkdir(parents=True, exist_ok=True)
        article = page_html(
            title=f"{post['title']} — GoFixWeb",
            description=post["description"],
            canonical=post["url"],
            og_type="article",
            extra_head=json_ld(post),
            body=article_body(post),
        )
        (slug_dir / "index.html").write_text(article, encoding="utf-8")
        pages[post["slug"]] = article
    return pages


def write_worker_data(posts: list[dict], pages: dict[str, str]) -> None:
    payload = {
        "indexHtml": pages["index"],
        "posts": [
            {"slug": post["slug"], "html": pages[post["slug"]]} for post in posts
        ],
    }
    WORKER_DATA.parent.mkdir(parents=True, exist_ok=True)
    WORKER_DATA.write_text(
        "export const BLOG_DATA = " + json.dumps(payload, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )


def main() -> int:
    posts = load_posts()
    pages = write_pages(posts)
    write_worker_data(posts, pages)
    print(f"built {len(posts)} posts", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
