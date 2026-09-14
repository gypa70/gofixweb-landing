"""Create or reuse the ADMIN_HTML Workers KV namespace and bind it in wrangler.toml."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ACCOUNT_FALLBACK = "47c841c4775065340b62547db3608ea4"
TITLE = "gofixweb-admin-html"
BINDING = "ADMIN_HTML"
API = "https://api.cloudflare.com/client/v4"


def _request(token: str, method: str, url: str, payload: dict | None = None) -> dict:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "gofixweb-ensure-admin-html-kv",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", "replace")
        raise SystemExit(f"cloudflare_kv_{err.code}:{body[:800]}") from err


def list_namespaces(token: str, account: str) -> list[dict]:
    rows: list[dict] = []
    page = 1
    while page <= 20:
        payload = _request(
            token,
            "GET",
            f"{API}/accounts/{account}/storage/kv/namespaces?per_page=100&page={page}",
        )
        chunk = payload.get("result") or []
        if not isinstance(chunk, list):
            break
        rows.extend(item for item in chunk if isinstance(item, dict))
        info = payload.get("result_info") or {}
        total = int(info.get("total_count") or len(rows))
        if len(rows) >= total or not chunk:
            break
        page += 1
    return rows


def ensure_namespace(token: str, account: str) -> str:
    for item in list_namespaces(token, account):
        if item.get("title") == TITLE and item.get("id"):
            return str(item["id"])
    created = _request(
        token,
        "POST",
        f"{API}/accounts/{account}/storage/kv/namespaces",
        {"title": TITLE},
    )
    ns_id = str(((created.get("result") or {}) if isinstance(created.get("result"), dict) else {}).get("id") or "")
    if not ns_id:
        raise SystemExit(f"kv_create_failed:{json.dumps(created)[:800]}")
    return ns_id


def patch_wrangler(path: Path, ns_id: str) -> None:
    text = path.read_text(encoding="utf-8")
    block = (
        f"\n[[kv_namespaces]]\n"
        f'binding = "{BINDING}"\n'
        f'id = "{ns_id}"\n'
    )
    start = text.find("[[kv_namespaces]]")
    if start >= 0:
        text = text[:start].rstrip() + "\n" + block
    else:
        text = text.rstrip() + "\n" + block
    path.write_text(text, encoding="utf-8")


def main() -> int:
    token = (os.environ.get("CLOUDFLARE_API_TOKEN") or "").strip()
    if not token:
        print("no CLOUDFLARE_API_TOKEN")
        return 1
    account = (os.environ.get("CLOUDFLARE_ACCOUNT_ID") or ACCOUNT_FALLBACK).strip()
    ns_id = ensure_namespace(token, account)
    wrangler = Path(__file__).resolve().parent.parent / "worker" / "wrangler.toml"
    patch_wrangler(wrangler, ns_id)
    print(f"kv_namespace {TITLE} id={ns_id}")
    print(wrangler.read_text(encoding="utf-8"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
