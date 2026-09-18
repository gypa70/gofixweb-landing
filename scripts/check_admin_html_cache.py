"""Cold check of GET /admin HTML store (KV + page). ntfy if stub or stale."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

BASE_URL = "https://gofixweb-report-trigger.gofixweb-report-trigger.workers.dev"
STALE_AFTER_SEC = 20 * 60
ISSUE_MARKER = "<!-- admin-html-cache-alert -->"
NTFY_TOPIC = "gofixweb-admin-cache-alert-k8n2p5w7q4m1x9c3"
USER_AGENT = "gofixweb-admin-cache-heartbeat"
ADMIN_USER = "gofixweb"


def _auth_header(password: str) -> str:
    import base64

    token = base64.b64encode(f"{ADMIN_USER}:{password}".encode("utf-8")).decode("ascii")
    return f"Basic {token}"


def fetch_json(url: str, password: str, timeout: int = 30) -> tuple[int, dict[str, Any]]:
    req = urllib.request.Request(
        url,
        headers={"Authorization": _auth_header(password), "User-Agent": USER_AGENT},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", "replace")
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                payload = {"raw": raw[:800]}
            return int(resp.status), payload if isinstance(payload, dict) else {"raw": payload}
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", "replace")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"raw": raw[:800]}
        return int(err.code), payload if isinstance(payload, dict) else {"raw": payload}


def fetch_text(url: str, password: str, timeout: int = 30) -> tuple[int, str, dict[str, str]]:
    req = urllib.request.Request(
        url,
        headers={"Authorization": _auth_header(password), "User-Agent": USER_AGENT},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            headers = {k.lower(): v for k, v in resp.headers.items()}
            return int(resp.status), resp.read().decode("utf-8", "replace"), headers
    except urllib.error.HTTPError as err:
        headers = {k.lower(): v for k, v in err.headers.items()} if err.headers else {}
        return int(err.code), err.read().decode("utf-8", "replace"), headers


def evaluate_store(status: dict[str, Any], page: str, page_code: int, cache_header: str) -> dict[str, Any]:
    kv = status.get("kv") if isinstance(status.get("kv"), dict) else {}
    cache_api = status.get("cache_api") if isinstance(status.get("cache_api"), dict) else {}
    stub = 'id="admin-cache-warming"' in page
    dashboard = 'id="tab-legal"' in page and 'id="tab-legal-warmup"' in page and 'id="tab-scan-stats"' in page and "admin-tabs" in page and not stub
    age = kv.get("age_sec")
    try:
        age_sec = int(age) if age is not None else None
    except (TypeError, ValueError):
        age_sec = None
    stale = bool(kv.get("stale")) or (age_sec is not None and age_sec > STALE_AFTER_SEC)
    missing = not bool(kv.get("hit"))
    reasons: list[str] = []
    if page_code != 200:
        reasons.append(f"admin_http_{page_code}")
    if stub:
        reasons.append("warming_stub")
    if not dashboard:
        reasons.append("not_dashboard")
    if missing:
        reasons.append("kv_miss")
    if stale:
        reasons.append("kv_stale")
    if "Error 1102" in page or "Worker exceeded resource limits" in page:
        reasons.append("error_1102")
    action = "alert" if reasons else "ok"
    title = "Admin dashboard HTML store je prázdný nebo starý"
    if action == "ok":
        title = "Admin dashboard HTML store je v pořádku"
    return {
        "action": action,
        "title": title,
        "reasons": reasons,
        "page_http": page_code,
        "page_bytes": len(page),
        "x_admin_cache": cache_header,
        "cache_api_hit": bool(cache_api.get("hit")),
        "kv_hit": bool(kv.get("hit")),
        "kv_bytes": kv.get("bytes") or 0,
        "kv_generated_at": kv.get("generated_at") or "",
        "kv_age_sec": age_sec,
        "would_serve_stub": bool(status.get("would_serve_stub")),
        "stale_after_sec": STALE_AFTER_SEC,
        "ntfy_topic": NTFY_TOPIC,
        "marker": ISSUE_MARKER,
    }


def send_ntfy(*, topic: str, title: str, message: str) -> bool:
    topic = (topic or "").strip()
    if not topic:
        return False
    url = f"https://ntfy.sh/{urllib.parse.quote(topic, safe='')}"
    req = urllib.request.Request(
        url,
        data=message.encode("utf-8"),
        method="POST",
        headers={
            "Title": title[:200],
            "Priority": "high",
            "Tags": "warning,hourglass",
            "Content-Type": "text/plain; charset=utf-8",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return 200 <= int(resp.status) < 300
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def _github_json(token: str, url: str, method: str = "GET", data: dict | None = None):
    body = None if data is None else json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": USER_AGENT,
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8", "replace"))
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
        return None


def find_open_issue(token: str, repo: str) -> dict[str, Any] | None:
    payload = _github_json(token, f"https://api.github.com/repos/{repo}/issues?state=open&per_page=100")
    if payload is None or not isinstance(payload, list):
        return None
    for issue in payload:
        if not isinstance(issue, dict) or issue.get("pull_request"):
            continue
        if ISSUE_MARKER in str(issue.get("body") or ""):
            return issue
    return {}


def apply_alert(decision: dict[str, Any], *, token: str, repo: str, dry_run: bool, run_url: str) -> dict[str, Any]:
    out = dict(decision)
    out["notified"] = False
    out["issue_url"] = ""
    if decision.get("action") != "alert":
        return out
    if dry_run:
        out["dry_run"] = True
        return out
    existing = find_open_issue(token, repo) if token and repo else {}
    if existing is None:
        out["notify_error"] = "github_issue_search_failed"
        return out
    if existing:
        out["duplicate"] = True
        out["issue_url"] = str(existing.get("html_url") or "")
        return out
    issue = _github_json(
        token,
        f"https://api.github.com/repos/{repo}/issues",
        method="POST",
        data={
            "title": str(decision.get("title") or "Admin HTML store"),
            "body": "\n".join(
                [
                    "GET `/admin` by vrátil warming stub, nebo je Workers KV prázdné/starší než 20 minut.",
                    "",
                    f"Důvody: `{', '.join(decision.get('reasons') or [])}`",
                    f"KV generated_at: `{decision.get('kv_generated_at') or '—'}`",
                    f"KV age: **{decision.get('kv_age_sec')} s**",
                    f"X-Admin-Cache: `{decision.get('x_admin_cache') or '—'}`",
                    f"Run: {run_url or '—'}",
                    "",
                    "Dokud je tohle issue otevřené, další ntfy/issue nevznikne.",
                    "",
                    ISSUE_MARKER,
                ]
            )
            + "\n",
        },
    )
    if isinstance(issue, dict) and issue.get("html_url"):
        out["issue_url"] = str(issue["html_url"])
    message = (
        f"Admin dashboard HTML store: {', '.join(decision.get('reasons') or [])}. "
        f"{out['issue_url'] or run_url}"
    )
    out["ntfy_ok"] = send_ntfy(
        topic=NTFY_TOPIC,
        title=str(decision.get("title") or "Admin HTML store"),
        message=message,
    )
    out["notified"] = True
    return out


def run_check(*, password: str, token: str = "", repo: str = "", dry_run: bool = False, run_url: str = "") -> dict[str, Any]:
    status_code, status = fetch_json(f"{BASE_URL}/admin/cache-status", password)
    page_code, page, headers = fetch_text(f"{BASE_URL}/admin?legal=1", password)
    decision = evaluate_store(status, page, page_code, headers.get("x-admin-cache") or "")
    decision["status_http"] = status_code
    decision["status"] = status
    decision["checked_at"] = datetime.now(timezone.utc).isoformat()
    applied = apply_alert(decision, token=token, repo=repo, dry_run=dry_run, run_url=run_url)
    return applied


def main() -> int:
    password = (os.environ.get("ADMIN_BASIC_PASSWORD") or "").strip()
    if not password:
        print("missing ADMIN_BASIC_PASSWORD")
        return 1
    dry_run = (os.environ.get("DRY_RUN") or "").strip() in {"1", "true", "yes"}
    result = run_check(
        password=password,
        token=(os.environ.get("GITHUB_TOKEN") or "").strip(),
        repo=(os.environ.get("GITHUB_REPOSITORY") or "").strip(),
        dry_run=dry_run,
        run_url=(os.environ.get("GITHUB_RUN_URL") or "").strip(),
    )
    print(json.dumps(result, ensure_ascii=False, indent=2)[:8000])
    return 1 if result.get("action") == "alert" and not dry_run else 0


if __name__ == "__main__":
    raise SystemExit(main())
