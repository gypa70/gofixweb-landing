#!/usr/bin/env python3
"""Jednorázový Stripe TEST-mode Checkout Session pro Basic předplatné.

Odmítne live klíč (sk_live_). Metadata jdou na Session i na Subscription, aby
invoice.paid na Workeru dostal plan=basic a domain.

  set STRIPE_SECRET_KEY_TEST=sk_test_...
  python scripts/create_test_subscription_checkout.py
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from ensure_stripe_subscription_prices import (  # noqa: E402
    PRICES,
    _find_price,
    _request,
)

DEFAULT_EMAIL = "trueforexway@gmail.com"
# C:\wp-test — URL z scanu id 73 (trycloudflare tunel k lokálnímu WP).
DEFAULT_DOMAIN = "https://reporters-reductions-manuals-vbulletin.trycloudflare.com"
PAID_THANKS_URL = "https://gofixweb-report-trigger.gofixweb-report-trigger.workers.dev/paid"
CANCEL_URL = "https://gofixweb.com/#tarify"
LOOKUP_BASIC = "gofixweb_basic_1490_month"
BASIC_AMOUNT = 149000


def _secret() -> str:
    test = (os.environ.get("STRIPE_SECRET_KEY_TEST") or "").strip()
    live_or_test = (os.environ.get("STRIPE_SECRET_KEY") or "").strip()
    for candidate in (test, live_or_test):
        if candidate.startswith("sk_test_"):
            return candidate
        if candidate.startswith("sk_live_"):
            print(
                "Nalezený Stripe klíč je LIVE (sk_live_). Test Checkout se tím nevytvoří.",
                file=sys.stderr,
            )
            raise SystemExit(2)
    print(
        "Chybí sk_test_ klíč. Nastav STRIPE_SECRET_KEY_TEST (Dashboard → Test mode → API keys).",
        file=sys.stderr,
    )
    raise SystemExit(1)


def _find_basic_price(secret: str) -> str:
    existing = _find_price(secret, LOOKUP_BASIC)
    if existing and existing.get("id"):
        return str(existing["id"])

    products = _request(secret, "products?limit=100&active=true")
    for product in products.get("data") or []:
        name = str(product.get("name") or "").lower()
        meta = product.get("metadata") or {}
        product_tag = str(meta.get("gofixweb_product") or meta.get("plan") or "").lower()
        if product_tag != "basic" and "basic" not in name:
            continue
        product_id = str(product.get("id") or "")
        prices = _request(secret, f"prices?product={product_id}&active=true&limit=100")
        for price in prices.get("data") or []:
            recurring = price.get("recurring") or {}
            if (
                int(price.get("unit_amount") or 0) == BASIC_AMOUNT
                and str(price.get("currency") or "") == "czk"
                and str(recurring.get("interval") or "") == "month"
            ):
                return str(price["id"])
        default_price = product.get("default_price")
        if isinstance(default_price, str) and default_price.startswith("price_"):
            return default_price
        if isinstance(default_price, dict) and str(default_price.get("id") or "").startswith("price_"):
            return str(default_price["id"])

    prices = _request(secret, "prices?active=true&limit=100&type=recurring")
    for price in prices.get("data") or []:
        recurring = price.get("recurring") or {}
        if (
            int(price.get("unit_amount") or 0) == BASIC_AMOUNT
            and str(price.get("currency") or "") == "czk"
            and str(recurring.get("interval") or "") == "month"
        ):
            return str(price["id"])

    raise RuntimeError(
        "V test mode není Price Basic 1 490 Kč/měsíc. "
        f"Očekávaný lookup_key {LOOKUP_BASIC} nebo produkt se jménem Basic."
    )


def create_session(*, secret: str, email: str, domain: str, plan: str) -> dict:
    price_id = _find_basic_price(secret) if plan == "basic" else ""
    if plan != "basic":
        spec = next((item for item in PRICES if item["metadata_product"] == plan), None)
        if not spec:
            raise RuntimeError(f"Neznámý tarif {plan}")
        found = _find_price(secret, spec["lookup_key"])
        if not found:
            raise RuntimeError(f"Chybí test Price pro {plan} ({spec['lookup_key']})")
        price_id = str(found["id"])

    success = f"{PAID_THANKS_URL}?session_id={{CHECKOUT_SESSION_ID}}&lang=cs"
    data = {
        "mode": "subscription",
        "success_url": success,
        "cancel_url": CANCEL_URL,
        "client_reference_id": plan,
        "customer_email": email,
        "locale": "cs",
        "managed_payments[enabled]": "false",
        "line_items[0][quantity]": "1",
        "line_items[0][price]": price_id,
        "metadata[product]": plan,
        "metadata[plan]": plan,
        "metadata[domain]": domain,
        "subscription_data[metadata][product]": plan,
        "subscription_data[metadata][plan]": plan,
        "subscription_data[metadata][domain]": domain,
    }
    return _request(secret, "checkout/sessions", data)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Test-mode Stripe Checkout pro předplatné.")
    parser.add_argument("--email", default=DEFAULT_EMAIL)
    parser.add_argument("--domain", default=DEFAULT_DOMAIN)
    parser.add_argument("--plan", default="basic", choices=("basic", "pro", "premium"))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    secret = _secret()
    session = create_session(
        secret=secret,
        email=str(args.email).strip().lower(),
        domain=str(args.domain).strip(),
        plan=str(args.plan).strip().lower(),
    )
    url = str(session.get("url") or "").strip()
    session_id = str(session.get("id") or "").strip()
    if not url:
        print(session, file=sys.stderr)
        print("Stripe nevrátil url Checkout Session.", file=sys.stderr)
        return 1
    print(f"session_id={session_id}")
    print(f"livemode={session.get('livemode')}")
    print(url)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
