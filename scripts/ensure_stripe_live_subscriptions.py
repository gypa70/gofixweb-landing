#!/usr/bin/env python3
"""Ověří live Stripe Prices a webhook eventy pro Basic/Pro/Premium.

Vyžaduje STRIPE_SECRET_KEY (sk_live_). Nevypisuje secret.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ensure_stripe_subscription_prices import PRICES, _find_price, _request, ensure_price

WEBHOOK_NEEDLES = ("/stripe-webhook",)
REQUIRED_EVENTS = (
    "invoice.paid",
    "invoice.payment_failed",
    "customer.subscription.deleted",
)
KEEP_EVENTS = ("checkout.session.completed",)


def _is_our_webhook(url: str) -> bool:
    raw = str(url or "").strip().lower()
    return any(token in raw for token in WEBHOOK_NEEDLES)


def ensure_live_webhook(secret: str) -> dict:
    payload = _request(secret, "webhook_endpoints?limit=100")
    endpoints = [
        item
        for item in (payload.get("data") or [])
        if item.get("status") == "enabled" and _is_our_webhook(str(item.get("url") or ""))
    ]
    live = [item for item in endpoints if item.get("livemode") is not False]
    if not live:
        urls = [str(item.get("url") or "") for item in (payload.get("data") or [])]
        raise RuntimeError(
            "Chybí aktivní live Stripe webhook na /stripe-webhook. "
            f"Nalezené URL: {urls or '(žádné)'}"
        )

    updated = []
    for endpoint in live:
        current = list(endpoint.get("enabled_events") or [])
        if "*" in current:
            updated.append(
                {
                    "id": endpoint.get("id"),
                    "url": endpoint.get("url"),
                    "events": ["*"],
                    "changed": False,
                }
            )
            continue
        needed = set(REQUIRED_EVENTS) | set(KEEP_EVENTS) | set(current)
        ordered = []
        for name in list(KEEP_EVENTS) + list(REQUIRED_EVENTS) + sorted(needed):
            if name in needed and name not in ordered:
                ordered.append(name)
        missing = [name for name in REQUIRED_EVENTS if name not in current]
        if missing:
            saved = _request(
                secret,
                f"webhook_endpoints/{endpoint['id']}",
                {"enabled_events[]": ordered},
            )
            current = list(saved.get("enabled_events") or ordered)
        updated.append(
            {
                "id": endpoint.get("id"),
                "url": endpoint.get("url"),
                "events": current,
                "changed": bool(missing),
                "missing_before": missing,
            }
        )
    return {"ok": True, "endpoints": updated}


def main() -> int:
    secret = (os.environ.get("STRIPE_SECRET_KEY") or "").strip()
    if not secret:
        print("Chybí STRIPE_SECRET_KEY", file=sys.stderr)
        return 1
    if secret.startswith("sk_test_"):
        print("STRIPE_SECRET_KEY je test-mode; live checkout potřebuje sk_live_.", file=sys.stderr)
        return 1

    prices = {}
    for spec in PRICES:
        existing = _find_price(secret, spec["lookup_key"])
        price = existing or ensure_price(secret, spec)
        prices[spec["metadata_product"]] = price.get("id")
        print(
            f"price {spec['metadata_product']}={price.get('id')} "
            f"lookup={spec['lookup_key']} amount={spec['amount']}",
            file=sys.stderr,
        )

    webhook = ensure_live_webhook(secret)
    for item in webhook["endpoints"]:
        events = item.get("events") or []
        missing = [name for name in REQUIRED_EVENTS if name not in events and "*" not in events]
        status = "updated" if item.get("changed") else "ok"
        print(
            f"webhook {status} id={item.get('id')} url={item.get('url')} "
            f"events={','.join(events) if events != ['*'] else '*'}",
            file=sys.stderr,
        )
        if missing:
            print(f"webhook missing events: {missing}", file=sys.stderr)
            return 1

    print(f"basic_price_id={prices.get('basic') or ''}")
    print(f"pro_price_id={prices.get('pro') or ''}")
    print(f"premium_price_id={prices.get('premium') or ''}")
    print("webhook_ok=true")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
