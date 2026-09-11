#!/usr/bin/env python3
"""Weekly GoFixWeb blog post: next unused topic → Claude → markdown → queue log.

Writes both SPA source (frontend/seo/content) and Worker source (blog/posts).
Does not push; the GitHub Actions workflow commits / opens a PR.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUEUE_PATH = ROOT / "blog" / "weekly-queue.json"
LOG_PATH = ROOT / "blog" / "WEEKLY.md"
SEO_DIR = ROOT / "frontend" / "seo" / "content"
POSTS_DIR = ROOT / "blog" / "posts"
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
DEFAULT_MODEL = "claude-sonnet-4-5"
BANNED = (
    "revoluce ai",
    "zaručíme první stránku",
    "zaručíme 1. stránku",
    "100% nárůst organiky",
    "do první desítky do týdne",
)

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

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def format_display_date(value: date) -> str:
    return f"{value.day}. {MONTHS_CS[value.month]} {value.year}"


def load_queue() -> dict:
    data = json.loads(QUEUE_PATH.read_text(encoding="utf-8"))
    if not isinstance(data.get("queue"), list) or not isinstance(data.get("published"), list):
        raise ValueError("weekly-queue.json must have queue[] and published[]")
    return data


def save_queue(data: dict) -> None:
    QUEUE_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def existing_slugs() -> set[str]:
    names = {path.stem for path in SEO_DIR.glob("*.md")}
    names |= {path.stem for path in POSTS_DIR.glob("*.md")}
    return names


def existing_titles(data: dict) -> list[str]:
    titles = [str(item.get("title") or "") for item in data.get("existing_manual_posts") or []]
    titles.extend(str(item.get("title") or "") for item in data.get("published") or [])
    return [title for title in titles if title]


def next_topic(data: dict) -> dict | None:
    published_ids = {str(item.get("id") or "") for item in data.get("published") or []}
    for topic in data.get("queue") or []:
        topic_id = str(topic.get("id") or "")
        if topic_id and topic_id not in published_ids:
            return topic
    return None


def slug_for(topic: dict) -> str:
    slug = str(topic.get("slug") or topic.get("id") or "").strip()
    if not SLUG_RE.fullmatch(slug):
        raise ValueError(f"bad slug: {slug!r}")
    return slug


def yaml_quote(value: str) -> str:
    escaped = value.replace("'", "''")
    return f"'{escaped}'"


def seo_markdown(*, title: str, description: str, published: date, tags: list[str], body: str) -> str:
    tag_lines = "\n".join(f"  - {tag}" for tag in tags) or "  - AI"
    return (
        "---\n"
        f"title: {yaml_quote(title)}\n"
        f"description: {yaml_quote(description)}\n"
        f"date: '{published.isoformat()}'\n"
        f"display_date: {yaml_quote(format_display_date(published))}\n"
        "lang: 'cs'\n"
        "tags:\n"
        f"{tag_lines}\n"
        "---\n\n"
        f"{body.strip()}\n"
    )


def worker_markdown(*, title: str, description: str, published: date, slug: str, body: str) -> str:
    return (
        "---\n"
        f"title: {title}\n"
        f"description: {description}\n"
        f"date: {published.isoformat()}\n"
        f"slug: {slug}\n"
        "---\n\n"
        f"{body.strip()}\n"
    )


def strip_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:markdown|md)?\s*", "", cleaned, count=1)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def parse_generated_markdown(raw: str) -> tuple[dict[str, str], str]:
    text = strip_fences(raw)
    if not text.startswith("---"):
        raise ValueError("Claude output is missing YAML frontmatter")
    end = text.find("\n---", 3)
    if end < 0:
        raise ValueError("unterminated frontmatter in Claude output")
    meta: dict[str, str] = {}
    for line in text[3:end].splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        meta[key.strip()] = value.strip().strip('"').strip("'")
    body = text[end + 4 :].lstrip("\n")
    return meta, body


def validate_body(body: str, *, title: str, known_titles: list[str], cta: str) -> None:
    compact = " ".join(body.lower().split())
    if len(body) < 1400:
        raise ValueError(f"article too short ({len(body)} chars)")
    if len(body) > 9000:
        raise ValueError(f"article too long ({len(body)} chars)")
    if not re.search(r"[ěščřžýáíéůúťďň]", body, re.I):
        raise ValueError("article does not look like Czech")
    if len(re.findall(r"(?m)^## ", body)) < 3:
        raise ValueError("expected at least three ## headings")
    if "/#analyza" not in body and "Bezplatný report" not in body:
        raise ValueError("missing standard CTA / analysis link")
    for phrase in BANNED:
        if phrase in compact:
            raise ValueError(f"banned hype phrase: {phrase}")
    for other in known_titles:
        if other and other.lower() != title.lower() and other.lower() in compact:
            raise ValueError(f"repeats existing title: {other}")


def style_brief(data: dict) -> str:
    posts = data.get("existing_manual_posts") or []
    published = data.get("published") or []
    lines = ["Už vydané články — témata NEOPAKUJ, neparafrazuj 1:1:"]
    for item in posts + published:
        lines.append(f"- {item.get('title')}: {item.get('summary') or item.get('title')}")
    return "\n".join(lines)


def build_prompt(topic: dict, data: dict, published: date) -> str:
    cta = str(data.get("cta") or "")
    tags = ", ".join(topic.get("tags") or ["AI"])
    return f"""Napiš jeden blogový článek pro gofixweb.com v češtině (vykání).

Téma (drž se ho, nerozšiřuj na jiný článek):
Název k použití: {topic['title']}
Úhel: {topic['angle']}
Čemu se vyhnout: {topic.get('avoid') or 'opakování existujících článků'}
Tagy: {tags}
Datum: {published.isoformat()}

{style_brief(data)}

Styl existujících textů GoFixWeb:
- věcný, bez hype, bez slibů pozic ve vyhledávání
- krátké věty, konkrétní ověření (prohlížeč, PageSpeed, HTML)
- přiznat hranice produktu: sken z veřejných dat; Auto jen WooCommerce (SEO pole, komprese, doporučené pluginy, Application Password); jinak Manuál / PDF
- žádná vymyšlená case-study čísla (65→100 apod. nepoužívej jako slib výsledku)
- 4 až 5 nadpisů ##, volitelně odrážky, bez H1 v těle (H1 je title)
- 700–1100 slov
- poslední odstavec přesně:
{cta}

Vrať POUZE markdown s YAML frontmatter:
---
title: '...'
description: 'jedna věta, max 180 znaků'
date: '{published.isoformat()}'
---

pak tělo článku. Žádné omluvy, žádné ``` ploty.
"""


def call_claude(prompt: str, *, api_key: str, model: str) -> str:
    payload = json.dumps(
        {
            "model": model,
            "max_tokens": 4500,
            "temperature": 0.4,
            "system": (
                "Jsi copywriter GoFixWeb. Píšeš česky, střízlivě, pro majitele e-shopu. "
                "Nehalucinuj administraci ani výsledky měření."
            ),
            "messages": [{"role": "user", "content": prompt}],
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        ANTHROPIC_URL,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.load(resp)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Anthropic HTTP {exc.code}: {detail[:500]}") from exc
    chunks = data.get("content") or []
    text = "".join(str(chunk.get("text") or "") for chunk in chunks if chunk.get("type") == "text")
    if not text.strip():
        raise RuntimeError("Anthropic returned empty text")
    return text


def write_log(data: dict) -> None:
    queued = data.get("queue") or []
    published = data.get("published") or []
    published_ids = {str(item.get("id") or "") for item in published}
    remaining = [item for item in queued if str(item.get("id") or "") not in published_ids]
    lines = [
        "# Týdenní blog — fronta a historie",
        "",
        "Pondělí 07:00 UTC, workflow **Weekly AI blog post**. Klíč: GitHub secret `ANTHROPIC_API_KEY`.",
        "",
        f"Zbývá témat ve frontě: **{len(remaining)}**. Publikováno z pipeline: **{len(published)}**.",
        "",
        "## Fronta (další běhy)",
        "",
    ]
    if remaining:
        for i, topic in enumerate(remaining, start=1):
            lines.append(f"{i}. `{topic.get('id')}` — {topic.get('title')}")
    else:
        lines.append("_Fronta je prázdná. Doplň nová témata do weekly-queue.json._")
    lines.extend(["", "## Publikováno", ""])
    if published:
        for item in reversed(published):
            lines.append(
                f"- {item.get('date')} — [{item.get('title')}]({item.get('url')}) "
                f"(`{item.get('slug')}`, zdroj: {item.get('source')})"
            )
    else:
        lines.append("_Zatím nic._")
    lines.extend(
        [
            "",
            "## Ruční články (mimo frontu)",
            "",
        ]
    )
    for item in data.get("existing_manual_posts") or []:
        lines.append(f"- [{item.get('title')}](/blog/{item.get('slug')}/)")
    LOG_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def is_first_pipeline_run(data: dict) -> bool:
    """True only when nothing has been published yet (including the review draft)."""
    return not (data.get("published") or [])


def generate_and_write(*, dry_run: bool) -> dict:
    data = load_queue()
    topic = next_topic(data)
    if topic is None:
        raise SystemExit("weekly blog queue is empty")
    slug = slug_for(topic)
    if slug in existing_slugs():
        raise SystemExit(f"slug already exists: {slug}")
    today = date.today()
    api_key = (os.environ.get("ANTHROPIC_API_KEY") or "").strip()
    if not api_key:
        raise SystemExit("ANTHROPIC_API_KEY is empty")
    model = str(data.get("model") or DEFAULT_MODEL)
    prompt = build_prompt(topic, data, today)
    if dry_run:
        return {
            "dry_run": True,
            "id": topic["id"],
            "slug": slug,
            "first_run": is_first_pipeline_run(data),
            "prompt_chars": len(prompt),
        }
    raw = call_claude(prompt, api_key=api_key, model=model)
    meta, body = parse_generated_markdown(raw)
    title = (meta.get("title") or str(topic["title"])).strip()
    description = (meta.get("description") or "").strip()
    if not description:
        raise ValueError("missing description")
    cta = str(data.get("cta") or "")
    if cta and cta not in body:
        body = body.rstrip() + "\n\n" + cta + "\n"
    validate_body(
        body,
        title=title,
        known_titles=existing_titles(data),
        cta=cta,
    )
    tags = [str(tag) for tag in (topic.get("tags") or ["AI"])]
    seo = seo_markdown(
        title=title,
        description=description,
        published=today,
        tags=tags,
        body=body,
    )
    worker = worker_markdown(
        title=title,
        description=description,
        published=today,
        slug=slug,
        body=body,
    )
    (SEO_DIR / f"{slug}.md").write_text(seo, encoding="utf-8")
    POSTS_DIR.mkdir(parents=True, exist_ok=True)
    (POSTS_DIR / f"{slug}.md").write_text(worker, encoding="utf-8")

    first_run = is_first_pipeline_run(data)
    data["published"].append(
        {
            "id": topic["id"],
            "slug": slug,
            "title": title,
            "date": today.isoformat(),
            "source": "anthropic",
            "url": f"/blog/{slug}/",
        }
    )
    data["queue"] = [item for item in data["queue"] if str(item.get("id")) != topic["id"]]
    save_queue(data)
    write_log(data)
    return {
        "dry_run": False,
        "id": topic["id"],
        "slug": slug,
        "title": title,
        "first_run": first_run,
        "url": f"/blog/{slug}/",
        "date": today.isoformat(),
    }


def render_log_only() -> None:
    write_log(load_queue())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--write-log", action="store_true", help="rebuild WEEKLY.md from JSON")
    parser.add_argument("--github-output", default="")
    args = parser.parse_args()
    if args.write_log:
        render_log_only()
        print(f"wrote {LOG_PATH}", flush=True)
        return 0
    result = generate_and_write(dry_run=args.dry_run)
    print(json.dumps(result, ensure_ascii=False), flush=True)
    if args.github_output:
        path = Path(args.github_output)
        lines = [
            f"slug={result['slug']}",
            f"title={result.get('title') or ''}",
            f"first_run={'true' if result['first_run'] else 'false'}",
            f"dry_run={'true' if result['dry_run'] else 'false'}",
        ]
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
