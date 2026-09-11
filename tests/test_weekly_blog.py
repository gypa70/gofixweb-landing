"""Guards for the weekly AI blog queue."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUEUE = ROOT / "blog" / "weekly-queue.json"
SEO = ROOT / "frontend" / "seo" / "content"
POSTS = ROOT / "blog" / "posts"

import sys

sys.path.insert(0, str(ROOT / "scripts"))
from publish_weekly_blog import (  # noqa: E402
    existing_slugs,
    next_topic,
    slug_for,
    validate_body,
    write_log,
)


class WeeklyQueueTests(unittest.TestCase):
    def setUp(self) -> None:
        self.data = json.loads(QUEUE.read_text(encoding="utf-8"))

    def test_queue_ids_are_unique_ascii_slugs(self) -> None:
        ids = [item["id"] for item in self.data["queue"]]
        ids += [item["id"] for item in self.data["published"]]
        self.assertEqual(len(ids), len(set(ids)))
        for topic_id in ids:
            self.assertRegex(topic_id, r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

    def test_queue_does_not_reuse_manual_slugs(self) -> None:
        manuals = {item["slug"] for item in self.data["existing_manual_posts"]}
        queued = {item["id"] for item in self.data["queue"]}
        self.assertTrue(manuals.isdisjoint(queued))

    def test_enough_future_topics(self) -> None:
        remaining = [item for item in self.data["queue"] if item["id"] not in {p["id"] for p in self.data["published"]}]
        self.assertGreaterEqual(len(remaining), 15)

    def test_next_topic_skips_published(self) -> None:
        topic = next_topic(self.data)
        self.assertIsNotNone(topic)
        assert topic is not None
        self.assertEqual(topic["id"], "ai-onpage-seo-male-eshopy")
        self.assertEqual(slug_for(topic), "ai-onpage-seo-male-eshopy")

    def test_review_article_exists_in_both_sources(self) -> None:
        slug = "ai-diagnoza-eshopu-neni-lidske-audit"
        self.assertIn(slug, existing_slugs())
        seo = (SEO / f"{slug}.md").read_text(encoding="utf-8")
        worker = (POSTS / f"{slug}.md").read_text(encoding="utf-8")
        self.assertIn("AI diagnostika e-shopu není totéž co lidský audit", seo)
        self.assertIn("slug: ai-diagnoza-eshopu-neni-lidske-audit", worker)
        self.assertNotIn("1. WordPress", seo)

    def test_validate_body_rejects_short_and_hype(self) -> None:
        with self.assertRaises(ValueError):
            validate_body("krátké", title="x", known_titles=[], cta="")
        body = (
            "## Jedna\n\n"
            + ("ěščřž diagnostika sken " * 120)
            + "\n\n## Dvě\n\ntext s odkazem /#analyza\n\n## Tři\n\n"
            "Chcete stejný typ kontroly na svém e-shopu? [Bezplatný report](/#analyza)\n"
        )
        validate_body(body, title="Nový", known_titles=["Jiný článek"], cta="")
        hyped = body + "\nrevoluce AI na první stránce\n"
        with self.assertRaises(ValueError):
            validate_body(hyped, title="Nový", known_titles=[], cta="")

    def test_write_log_mentions_queue(self) -> None:
        write_log(self.data)
        log = (ROOT / "blog" / "WEEKLY.md").read_text(encoding="utf-8")
        self.assertIn("ai-onpage-seo-male-eshopy", log)
        self.assertIn("ai-diagnoza-eshopu-neni-lidske-audit", log)


if __name__ == "__main__":
    unittest.main()
