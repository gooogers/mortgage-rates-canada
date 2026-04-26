"""Smoke test for render_page using a data: URL (no network required)."""
from lenders._playwright import render_page


def test_render_page_returns_html_string():
    """Rendering a data URL returns the post-render HTML as a string."""
    html = render_page("data:text/html,<html><body><h1 id=hi>Hello</h1></body></html>")
    assert "<h1" in html
    assert "Hello" in html


def test_render_page_waits_for_selector():
    """When wait_for_selector is given, the call still succeeds for present selectors."""
    html = render_page(
        "data:text/html,<html><body><div id=ready>x</div></body></html>",
        wait_for_selector="#ready",
    )
    assert "ready" in html
