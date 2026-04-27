"""Refresh rates end-to-end:

  1. Open each manual-capture lender (BMO, Scotiabank, CIBC, Tangerine)
     in headed Chromium, wait for rates to render, save HTML.
  2. Run the full scraper to produce ../data/rates.json.
  3. Commit rates.json + history snapshot to the `data` branch and push.

Usage (from repo root):
    cd scraper
    uv run python scripts/refresh_rates.py [--no-push] [--wait-seconds 12]

The orchestrator skips the git push step if --no-push is given (useful for
local dry runs). The CF Pages deploy hook fires automatically on data branch
push (handled by the workflow that consumes the data branch downstream).
"""
from __future__ import annotations

import argparse
import datetime as dt
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from playwright.sync_api import sync_playwright

REAL_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)

LENDERS_TO_CAPTURE: list[tuple[str, str]] = [
    ("bmo",        "https://www.bmo.com/main/personal/mortgages/mortgage-rates/"),
    ("scotiabank", "https://www.scotiabank.com/ca/en/personal/mortgages.html"),
    ("cibc",       "https://www.cibc.com/en/personal-banking/mortgages/mortgage-rates.html"),
    ("tangerine",  "https://www.tangerine.ca/en/rates/mortgage-rates"),
]

SCRAPER_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = SCRAPER_DIR.parent
MANUAL_DIR = SCRAPER_DIR / "data" / "manual"
RATES_JSON = REPO_ROOT / "data" / "rates.json"


def capture(slug: str, url: str, wait_seconds: int) -> None:
    out = MANUAL_DIR / f"{slug}.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    print(f"[capture] {slug}: {url}", file=sys.stderr)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        try:
            context = browser.new_context(user_agent=REAL_UA, viewport={"width": 1280, "height": 900})
            page = context.new_page()
            page.goto(url, timeout=60_000, wait_until="domcontentloaded")
            page.wait_for_timeout(wait_seconds * 1000)
            html = page.content()
        finally:
            browser.close()
    out.write_text(html, encoding="utf-8")
    print(f"[capture] wrote {len(html):,} bytes to {out}", file=sys.stderr)


def run_scraper() -> None:
    print("[scrape] running core.cli ...", file=sys.stderr)
    subprocess.run(
        ["uv", "run", "python", "-m", "core.cli", "--output", str(RATES_JSON), "--verbose"],
        cwd=SCRAPER_DIR,
        check=True,
    )


def push_to_data_branch() -> None:
    print("[push] updating data branch ...", file=sys.stderr)
    today = dt.date.today().isoformat()
    worktree = REPO_ROOT.parent / f"_data-update-{today}"

    subprocess.run(["git", "fetch", "origin", "data"], cwd=REPO_ROOT, check=True)
    subprocess.run(["git", "worktree", "add", str(worktree), "origin/data"], cwd=REPO_ROOT, check=True)
    try:
        subprocess.run(["git", "checkout", "-B", "data"], cwd=worktree, check=True)
        # Copy fresh rates.json + add to history
        (worktree / "rates.json").write_bytes(RATES_JSON.read_bytes())
        history_dir = worktree / "history"
        history_dir.mkdir(exist_ok=True)
        (history_dir / f"{today}.json").write_bytes(RATES_JSON.read_bytes())

        subprocess.run(["git", "add", "rates.json", "history/"], cwd=worktree, check=True)
        # Skip if no changes
        diff = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=worktree)
        if diff.returncode == 0:
            print("[push] no changes — skipping commit", file=sys.stderr)
            return
        subprocess.run(
            ["git", "commit", "-m", f"chore(rates): refresh {today}"],
            cwd=worktree,
            check=True,
        )
        subprocess.run(["git", "push", "origin", "data"], cwd=worktree, check=True)
        print("[push] data branch updated", file=sys.stderr)
    finally:
        subprocess.run(["git", "worktree", "remove", "--force", str(worktree)], cwd=REPO_ROOT, check=False)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-push", action="store_true", help="skip the git push step")
    parser.add_argument("--wait-seconds", type=int, default=12, help="render-wait per page (default 12)")
    parser.add_argument("--skip-capture", action="store_true", help="skip captures (use existing fixtures)")
    args = parser.parse_args()

    if not args.skip_capture:
        for slug, url in LENDERS_TO_CAPTURE:
            try:
                capture(slug, url, args.wait_seconds)
            except Exception as exc:
                print(f"[capture] {slug} FAILED: {exc!r}", file=sys.stderr)
                # Continue — runner gracefully skips lenders with stale fixtures.

    try:
        run_scraper()
    except subprocess.CalledProcessError as exc:
        print(f"[scrape] FAILED: {exc}", file=sys.stderr)
        return 1

    if args.no_push:
        print(f"[push] skipped (--no-push). Output at {RATES_JSON}", file=sys.stderr)
        return 0

    try:
        push_to_data_branch()
    except subprocess.CalledProcessError as exc:
        print(f"[push] FAILED: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
