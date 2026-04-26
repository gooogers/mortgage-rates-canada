"""Headless-Chromium page renderer used by per-lender scrapers.

Big 6 bank sites render rates via JavaScript, so we cannot use plain HTTP
requests. This helper opens a real browser, navigates to the URL, optionally
waits for a selector to confirm rates are loaded, and returns the rendered HTML.
"""
from __future__ import annotations

from playwright.sync_api import sync_playwright

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 "
    "MortgageRatesBot/0.1"
)

DEFAULT_TIMEOUT_MS = 30_000


def render_page(
    url: str,
    *,
    wait_for_selector: str | None = None,
    timeout_ms: int = DEFAULT_TIMEOUT_MS,
) -> str:
    """Open `url` in headless Chromium, return the post-JS HTML.

    If `wait_for_selector` is given, wait for that CSS selector to appear
    (rates are typically inside a specific container that mounts after JS runs).
    Otherwise, wait for the network to be idle.
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            context = browser.new_context(user_agent=USER_AGENT)
            page = context.new_page()
            page.goto(url, timeout=timeout_ms, wait_until="networkidle")
            if wait_for_selector:
                page.wait_for_selector(wait_for_selector, timeout=timeout_ms)
            return page.content()
        finally:
            browser.close()
