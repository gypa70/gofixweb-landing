"""Guards for admin HTML KV store and cache heartbeat."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from check_admin_html_cache import (  # noqa: E402
    NTFY_TOPIC,
    STALE_AFTER_SEC,
    evaluate_store,
)

WORKER = ROOT / "worker" / "src" / "index.js"
WARM_WORKFLOW = ROOT / ".github" / "workflows" / "admin-cache-heartbeat.yml"


class AdminHtmlCacheTests(unittest.TestCase):
    def test_ntfy_topic_is_hard_to_guess(self) -> None:
        self.assertTrue(NTFY_TOPIC.startswith("gofixweb-admin-cache-alert-"))
        self.assertGreaterEqual(len(NTFY_TOPIC), 40)

    def test_stale_after_is_twenty_minutes(self) -> None:
        self.assertEqual(STALE_AFTER_SEC, 20 * 60)

    def test_evaluate_alerts_on_stub(self) -> None:
        page = '<p id="admin-cache-warming">Dashboard HTML se skládá na cron'
        decision = evaluate_store(
            {"kv": {"hit": False, "stale": True, "age_sec": 4000}, "would_serve_stub": True},
            page,
            200,
            "miss",
        )
        self.assertEqual(decision["action"], "alert")
        self.assertIn("warming_stub", decision["reasons"])
        self.assertIn("kv_miss", decision["reasons"])

    def test_evaluate_ok_on_dashboard(self) -> None:
        page = '<nav class="admin-tabs"></nav><section id="tab-legal"></section><section id="tab-legal-warmup"></section><section id="tab-scan-stats"></section><div id="legal-scan">'
        decision = evaluate_store(
            {
                "kv": {"hit": True, "stale": False, "age_sec": 60, "bytes": 100000, "generated_at": "2026-09-14T12:00:00Z"},
                "cache_api": {"hit": False},
                "would_serve_stub": False,
            },
            page,
            200,
            "kv",
        )
        self.assertEqual(decision["action"], "ok")
        self.assertEqual(decision["reasons"], [])

    def test_worker_reads_kv_on_get_admin(self) -> None:
        text = WORKER.read_text(encoding="utf-8")
        self.assertIn("ADMIN_HTML_KV_KEY", text)
        self.assertIn("readAdminHtmlStore", text)
        self.assertIn("peekAdminHtmlStore", text)
        self.assertIn("/admin/cache-status", text)
        self.assertIn("/admin/purge-colo-html", text)
        page_start = text.index("async function handleAdminPage")
        page_fn = text[page_start : text.find("\nasync function ", page_start + 1)]
        self.assertIn("readAdminHtmlStore", page_fn)
        self.assertNotIn("renderAdminHtml(", page_fn)
        self.assertNotIn("warmAdminPageCaches", page_fn)
        self.assertNotIn("ctx.waitUntil", page_fn)

    def test_get_admin_prefers_kv_over_colo_cache(self) -> None:
        text = WORKER.read_text(encoding="utf-8")
        store_start = text.index("async function readAdminHtmlStore")
        store_fn = text[store_start : text.find("\nasync function ", store_start + 1)]
        kv_at = store_fn.index("ADMIN_HTML.getWithMetadata(ADMIN_HTML_KV_KEY)")
        cache_at = store_fn.index("caches.default.match(ADMIN_HTML_CACHE)")
        self.assertLess(kv_at, cache_at)
        self.assertIn("page-html-v2", text)
        self.assertIn("hid Legal Health", store_fn)

    def test_heartbeat_workflow_exists(self) -> None:
        text = WARM_WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("check_admin_html_cache.py", text)
        self.assertIn("ntfy.sh", text)
        self.assertIn("admin-html-cache-alert", text)
        self.assertIn("*/15 * * * *", text)
        self.assertNotIn("POST /admin/warm-html", text)

    def test_legal_warmup_tab_in_worker(self) -> None:
        text = WORKER.read_text(encoding="utf-8")
        self.assertIn('id="tab-legal-warmup"', text)
        self.assertIn("/admin/resume-legal", text)
        self.assertIn("Warm-up — Legal", text)
        self.assertIn("handleAdminResumeLegal", text)
        self.assertNotIn("warmAdminPageCaches", text[text.index("async function handleAdminPage"):text.find("\nasync function ", text.index("async function handleAdminPage") + 1)])

    def test_scan_stats_tab_in_worker(self) -> None:
        text = WORKER.read_text(encoding="utf-8")
        self.assertIn('id="tab-scan-stats"', text)
        self.assertIn("/admin/scan-stats-ingest", text)
        self.assertIn("Agregátní statistiky", text)
        self.assertIn("handleAdminScanStatsIngest", text)
        self.assertIn("SCAN_STATS_KV_KEY", text)
        page_start = text.index("async function handleAdminPage")
        page_fn = text[page_start : text.find("\nasync function ", page_start + 1)]
        self.assertIn("readAdminHtmlStore", page_fn)
        self.assertNotIn("renderAdminHtml(", page_fn)
        self.assertNotIn("warmAdminPageCaches", page_fn)


if __name__ == "__main__":
    unittest.main()
