# Bank-Published Discounted Rates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace formula-based discount estimation with bank-published special-offer rates captured directly from each lender's HTML. When a bank doesn't publish a special offer for a particular term, the site shows only the posted rate (no strikethrough/discounted display).

**Architecture:** Each lender's `parse()` returns `Rate(posted, discounted)` with both values populated when the bank publishes them side-by-side; `discounted=None` otherwise. The runner's `apply_discount()` step is removed — the parser output is final. Site renders the rate cell differently when `rate.discounted` is null (posted only, no strikethrough). A disclaimer is added to the rate-table area noting that displayed discounted rates are bank-advertised specials and brokers may offer further discounts.

**Tech Stack:** Same — Python 3.12 / BeautifulSoup / Playwright / Astro 4.

**Decisions (resolved before plan):**
- Missing special offer for a term → show only posted (option 1b). No formula fallback.
- All 7 lenders extended (option 2a).
- Add disclaimer microcopy on the site (option 3c).

---

## File Map

**Scraper:**
- Modify: `scraper/core/runner.py` — drop `apply_discount` step
- Modify: `scraper/lenders/cibc.py`, `bmo.py`, `scotiabank.py`, `tangerine.py`, `national.py`, `rbc.py`, `td.py` — populate `discounted`
- Modify: `scraper/tests/fixtures/*.html` — refresh synthetic fixtures with both rates
- Modify: `scraper/tests/test_lenders.py` — relax test expectations (discounted may be None per term)

**Site:**
- Modify: `site/src/data/rates.sample.json` — realistic dual-rate samples
- Modify: `site/src/components/LenderRow.astro` — null discounted handling
- Modify: `site/src/components/HeroFeaturedRates.astro` — fallback to best posted when no discounted
- Modify: `site/src/lib/rates.ts` — `bestRateForTerm` should still work; verify behavior with null discounted
- Modify: `site/src/components/RateTable.astro` — add disclaimer footer line

---

## Task 1: Drop `apply_discount` from runner

**Files:** Modify `scraper/core/runner.py`

- [ ] **Step 1:** Open `scraper/core/runner.py`. Find the `_run_one` function. Replace the body block:

```python
    discounted = [apply_discount(r, formula) for r in raw_rates]
    return scraper.to_lender(discounted)
```

with:

```python
    return scraper.to_lender(raw_rates)
```

Remove the now-unused import `from core.discount import DiscountFormula, apply_discount` (keep `from core.discount import DiscountFormula` only if still referenced for the type hint on `build_rates_data`'s `formula` parameter; otherwise remove the entire import line).

The `formula` parameter is still passed through `build_rates_data` for backward compatibility with `RatesData.discount_formula`. Leave that field populated from the YAML — the site can ignore it.

- [ ] **Step 2:** Run the scraper test suite — some tests will still pass since the discount module is just unused, not deleted:
```bash
cd scraper && uv run pytest -v 2>&1 | tail -20
```
Expected: existing tests still pass (parsers haven't changed yet, and the test of apply_discount itself still works since the function still exists).

- [ ] **Step 3:** Commit:
```bash
git add scraper/core/runner.py
git commit -m "refactor(scraper): drop apply_discount step — parsers populate discounted directly"
```

---

## Task 2: CIBC parser — populate `discounted` from Special Offer column

**Files:** Modify `scraper/lenders/cibc.py`

CIBC's HTML has 4 cells per row: `Term | Posted Rate | Special Offer | APR`. We currently take the first numeric cell after the label (cells[1] = Posted). We need cells[2] (Special Offer) for `discounted`.

- [ ] **Step 1:** In `scraper/lenders/cibc.py`, replace the inner rate-extraction block:

```python
                rate = None
                for cell in cells[1:]:
                    rate = _extract_rate(cell.get_text(strip=True))
                    if rate is not None:
                        break
                if rate is None:
                    continue
                rates.append(Rate(term=term, posted=rate))
                seen.add(term.value)
                break
```

with:

```python
                # cells[1] = Posted Rate, cells[2] = Special Offer (may be "N/A")
                posted = _extract_rate(cells[1].get_text(strip=True)) if len(cells) > 1 else None
                discounted = _extract_rate(cells[2].get_text(strip=True)) if len(cells) > 2 else None
                if posted is None:
                    continue
                rates.append(Rate(term=term, posted=posted, discounted=discounted))
                seen.add(term.value)
                break
```

- [ ] **Step 2:** Verify against captured CIBC HTML (already at `scraper/data/manual/cibc.html`):

```bash
cd scraper && export PATH="$PATH:/c/Users/CSR/.local/bin" && uv run python -c "
import sys; sys.path.insert(0, '.')
from lenders.cibc import CIBCScraper
s = CIBCScraper()
for r in s.parse(s.fetch()):
    print(f'{r.term:15s} posted={r.posted:.2f}  discounted={r.discounted}')"
```

Expected: each fixed term has both posted and discounted (e.g. `1yr_fixed posted=4.99 discounted=4.74`). Variable should also have both (`variable posted=4.45 discounted=3.95`).

- [ ] **Step 3:** Run tests (fixture-based):
```bash
uv run pytest tests/test_lenders.py -v -k cibc
```
Expected: 3 tests pass. (Synthetic fixture has only 2 cells, so discounted will be None for synthetic — the existing tests check `posted` is in 1-15% range and required terms exist; they don't check discounted.)

- [ ] **Step 4:** Commit:
```bash
git add scraper/lenders/cibc.py
git commit -m "feat(scraper): CIBC parser populates discounted from Special Offer column"
```

---

## Task 3: BMO parser — populate `discounted` via cross-table lookup

**Files:** Modify `scraper/lenders/bmo.py`

BMO has the special offers in a separate table (Table 0) from posted rates (Table 1). We need to first build a `{term → special_rate}` map by walking the special-offer table, then attach those when emitting posted rows.

- [ ] **Step 1:** In `scraper/lenders/bmo.py`, replace the entire `parse()` method body with this two-pass version:

```python
    def parse(self, html: str) -> list[Rate]:
        soup = BeautifulSoup(html, "lxml")

        # Pass 1: collect special-offer rates (rows whose label contains parens
        # or "smart"). Map term → discounted rate.
        specials: dict[str, float] = {}
        for row in soup.find_all("tr"):
            cells = row.find_all(["th", "td"])
            if len(cells) < 2:
                continue
            label = _normalize(cells[0].get_text(" ", strip=True))
            if "(" not in label and "smart" not in label:
                continue
            if "open" in label:
                continue
            for keyword, term in TERM_KEYWORD_MAP:
                if keyword not in label:
                    continue
                rate = None
                for cell in cells[1:]:
                    rate = _extract_rate(cell.get_text(strip=True))
                    if rate is not None:
                        break
                if rate is not None and term.value not in specials:
                    specials[term.value] = rate
                break

        # Pass 2: emit posted rates with matching specials.
        rates: list[Rate] = []
        seen: set[str] = set()
        for row in soup.find_all("tr"):
            cells = row.find_all(["th", "td"])
            if len(cells) < 2:
                continue
            label = _normalize(cells[0].get_text(" ", strip=True))
            if "open" in label:
                continue
            if "variable" not in label and ("(" in label or "smart" in label):
                continue
            for keyword, term in TERM_KEYWORD_MAP:
                if keyword not in label:
                    continue
                if term.value in seen:
                    continue
                posted = None
                for cell in cells[1:]:
                    posted = _extract_rate(cell.get_text(strip=True))
                    if posted is not None:
                        break
                if posted is None:
                    continue
                discounted = specials.get(term.value)
                # If this row IS the variable special-offer row (no separate posted),
                # treat the same value as both.
                if "variable" in label and "(" in label and discounted is None:
                    discounted = posted
                rates.append(Rate(term=term, posted=posted, discounted=discounted))
                seen.add(term.value)
                break

        return rates
```

- [ ] **Step 2:** Verify against captured HTML:
```bash
cd scraper && uv run python -c "
import sys; sys.path.insert(0, '.')
from lenders.bmo import BMOScraper
s = BMOScraper()
for r in s.parse(s.fetch()):
    print(f'{r.term:15s} posted={r.posted:.2f}  discounted={r.discounted}')"
```
Expected: 3yr/5yr have discounted populated from Special Offers table; 1yr/2yr/4yr/7yr/10yr have discounted=None; variable has discounted=4.10 (same as posted since variable lives only in special-offers table).

- [ ] **Step 3:** Run tests:
```bash
uv run pytest tests/test_lenders.py -v -k bmo
```
Expected: 3 tests pass.

- [ ] **Step 4:** Commit:
```bash
git add scraper/lenders/bmo.py
git commit -m "feat(scraper): BMO parser populates discounted from special-offers table"
```

---

## Task 4: Scotiabank parser — populate `discounted` via cross-table lookup

**Files:** Modify `scraper/lenders/scotiabank.py`

Scotiabank has special offers in Table 0 (rows containing "scotia ultimate", "scotia flex value-closed") and posted fixed rates in Table 1 (rows like "1 year", "2 years"). Variable lives only in Table 0.

- [ ] **Step 1:** Replace the `parse()` method body in `scraper/lenders/scotiabank.py` with the same two-pass pattern as BMO, adapted for Scotiabank's filters:

```python
    def parse(self, html: str) -> list[Rate]:
        soup = BeautifulSoup(html, "lxml")

        # Pass 1: special offers (rows containing "scotia" or "flex" except "open").
        specials: dict[str, float] = {}
        for row in soup.find_all("tr"):
            cells = row.find_all(["th", "td"])
            if len(cells) < 2:
                continue
            label = _normalize(cells[0].get_text(" ", strip=True))
            if "open" in label or "month" in label:
                continue
            if "scotia" not in label and "flex" not in label:
                continue
            for keyword, term in TERM_KEYWORD_MAP:
                if keyword not in label:
                    continue
                rate = None
                for cell in cells[1:]:
                    rate = _extract_rate(cell.get_text(strip=True))
                    if rate is not None:
                        break
                if rate is not None and term.value not in specials:
                    specials[term.value] = rate
                break

        # Pass 2: posted rates from clean rows.
        rates: list[Rate] = []
        seen: set[str] = set()
        for row in soup.find_all("tr"):
            cells = row.find_all(["th", "td"])
            if len(cells) < 2:
                continue
            label = _normalize(cells[0].get_text(" ", strip=True))
            if "open" in label or "month" in label:
                continue
            if "variable" not in label and ("flex" in label or "scotia" in label):
                continue
            for keyword, term in TERM_KEYWORD_MAP:
                if keyword not in label:
                    continue
                if term.value in seen:
                    continue
                posted = None
                for cell in cells[1:]:
                    posted = _extract_rate(cell.get_text(strip=True))
                    if posted is not None:
                        break
                if posted is None:
                    continue
                discounted = specials.get(term.value)
                if "variable" in label and ("scotia" in label or "ultimate" in label) and discounted is None:
                    discounted = posted
                rates.append(Rate(term=term, posted=posted, discounted=discounted))
                seen.add(term.value)
                break

        return rates
```

- [ ] **Step 2:** Verify:
```bash
cd scraper && uv run python -c "
import sys; sys.path.insert(0, '.')
from lenders.scotiabank import ScotiabankScraper
s = ScotiabankScraper()
for r in s.parse(s.fetch()):
    print(f'{r.term:15s} posted={r.posted:.2f}  discounted={r.discounted}')"
```
Expected: 5yr has discounted from Flex Value Closed (4.90); variable has discounted=5.95 (same as posted).

- [ ] **Step 3:** Run tests + commit:
```bash
uv run pytest tests/test_lenders.py -v -k scotiabank
git add scraper/lenders/scotiabank.py
git commit -m "feat(scraper): Scotiabank parser populates discounted from special-offers table"
```

---

## Task 5: Tangerine parser — `discounted = posted` (single advertised rate)

**Files:** Modify `scraper/lenders/tangerine.py`

Tangerine doesn't have a posted/special split — they advertise a single rate per term. That rate IS what they offer. So `discounted = posted` for every term. The "Already a Client" section is a separate rate band (we ignore it via dedup since Standard appears first).

- [ ] **Step 1:** In `scraper/lenders/tangerine.py`, change the line:
```python
                rates.append(Rate(term=term, posted=rate))
```
to:
```python
                rates.append(Rate(term=term, posted=rate, discounted=rate))
```

- [ ] **Step 2:** Verify + tests + commit:
```bash
cd scraper && uv run python -c "
import sys; sys.path.insert(0, '.')
from lenders.tangerine import TangerineScraper
s = TangerineScraper()
for r in s.parse(s.fetch()):
    print(f'{r.term:15s} posted={r.posted:.2f}  discounted={r.discounted}')"

uv run pytest tests/test_lenders.py -v -k tangerine
git add scraper/lenders/tangerine.py
git commit -m "feat(scraper): Tangerine sets discounted=posted (single advertised rate)"
```
Expected: every term has `posted == discounted`.

---

## Task 6: National Bank parser — populate `discounted` from `tauxPromo*` fields

**Files:** Modify `scraper/lenders/national.py`

The existing parser explicitly ignores `tauxPromo*` fields (per the docstring). They contain the bank's promotional/special-offer rate. Map them to the same Term values as the posted `taux*F` fields.

- [ ] **Step 1:** In `scraper/lenders/national.py`, after the existing `FIXED_FIELD_MAP`, add:

```python
PROMO_FIELD_MAP: dict[str, Term] = {
    "tauxPromo1anF": Term.ONE_YEAR_FIXED,
    "tauxPromo2ansF": Term.TWO_YEAR_FIXED,
    "tauxPromo3ansF": Term.THREE_YEAR_FIXED,
    "tauxPromo4ansF": Term.FOUR_YEAR_FIXED,
    "tauxPromo5ansF": Term.FIVE_YEAR_FIXED,
    "tauxPromo7ansF": Term.SEVEN_YEAR_FIXED,
    "tauxPromo10ansF": Term.TEN_YEAR_FIXED,
}

PROMO_VARIABLE_FIELD = "tauxPromo5ansO"
```

- [ ] **Step 2:** In `parse()`, after the lookup `by_condition: dict[str, dict] = {}` is built, add a helper to extract per-term promo rates:

```python
        # Build term → promo rate lookup from the same product objects.
        promos: dict[str, float] = {}
        fixed_product = by_condition.get(FIXED_CONDITION_ID, {})
        for field, term in PROMO_FIELD_MAP.items():
            raw_value = fixed_product.get(field, "")
            if not raw_value:
                continue
            try:
                value = float(str(raw_value).replace(",", "."))
            except ValueError:
                continue
            if 1.0 <= value <= 15.0:
                promos[term.value] = value

        variable_product = by_condition.get(VARIABLE_CONDITION_ID, {})
        raw_promo_var = variable_product.get(PROMO_VARIABLE_FIELD, "")
        if raw_promo_var:
            try:
                v = float(str(raw_promo_var).replace(",", "."))
                if 1.0 <= v <= 15.0:
                    promos[Term.VARIABLE.value] = v
            except ValueError:
                pass
```

- [ ] **Step 3:** Update the `Rate(term=term, posted=value)` constructions in both the fixed and variable extraction blocks to include `discounted=promos.get(term.value)`:

For the fixed block, change:
```python
            rates.append(Rate(term=term, posted=value))
```
to:
```python
            rates.append(Rate(term=term, posted=value, discounted=promos.get(term.value)))
```

For the variable block, change:
```python
                    rates.append(Rate(term=Term.VARIABLE, posted=var_value))
```
to:
```python
                    rates.append(Rate(term=Term.VARIABLE, posted=var_value, discounted=promos.get(Term.VARIABLE.value)))
```

- [ ] **Step 4:** Verify against the existing fixture:
```bash
cd scraper && uv run python -c "
import sys; sys.path.insert(0, '.')
from lenders.national import NationalScraper
html = open('tests/fixtures/national.html', encoding='utf-8').read()
for r in NationalScraper().parse(html):
    print(f'{r.term:15s} posted={r.posted:.2f}  discounted={r.discounted}')"
```
Expected: terms with `tauxPromo*` populated should have a discounted value (less than posted); terms without promo should have `discounted=None`.

- [ ] **Step 5:** Tests + commit:
```bash
uv run pytest tests/test_lenders.py -v -k national
git add scraper/lenders/national.py
git commit -m "feat(scraper): National Bank parser populates discounted from tauxPromo* fields"
```

---

## Task 7: RBC parser — capture special-rates section codes

**Files:** Modify `scraper/lenders/rbc.py`

RBC's page has a "Special Rates" section in addition to the "Posted Rates" section we currently use. The special-offer rate codes need identification from the RBC fixture.

- [ ] **Step 1:** First, inspect the existing fixture to find the special-rates section structure:

```bash
cd scraper && uv run python -c "
from bs4 import BeautifulSoup
html = open('tests/fixtures/rbc.html', encoding='utf-8').read()
soup = BeautifulSoup(html, 'lxml')
for div in soup.find_all('div', id=True):
    if 'special' in div['id'].lower() or 'rate' in div['id'].lower():
        print(div['id'])
"
```

Likely IDs to inspect: `special-rates`, `rbc-special-rates`, etc.

- [ ] **Step 2:** Inspect rate codes inside the special section:

```bash
uv run python -c "
from bs4 import BeautifulSoup
html = open('tests/fixtures/rbc.html', encoding='utf-8').read()
soup = BeautifulSoup(html, 'lxml')
section = soup.find('div', id='special-rates')
if section:
    for span in section.select('span[data-rate-code]'):
        code = span.get('data-rate-code')
        text = span.get_text(strip=True)
        print(f'{code}: {text}')"
```

This produces a list of `(code, value)` pairs. Match each rate value to a Term by looking at surrounding text in the fixture (e.g. spans for "1 Year Closed", "5 Year Closed").

- [ ] **Step 3:** Add a `SPECIAL_RATE_CODE_MAP` constant in `rbc.py` after `RATE_CODE_MAP`:

```python
# Special-offer rate codes (under 25yr amortization, "Special Rates" section).
# Codes identified from tests/fixtures/rbc.html during Step 2 inspection.
SPECIAL_RATE_CODE_MAP: dict[str, Term] = {
    # Fill in codes per term mapping discovered in Step 2.
    # Example shape:
    # "0006340014": Term.ONE_YEAR_FIXED,
    # "0006340026": Term.FIVE_YEAR_FIXED,
}
```

- [ ] **Step 4:** In `parse()`, after the existing posted-rate extraction block, add a special-rates extraction pass that builds a `specials: dict[str, float]` map (same shape as BMO/Scotia), then attach to the existing `rates` list by matching term:

```python
        special_div = soup.find("div", id="special-rates")
        specials: dict[str, float] = {}
        if isinstance(special_div, Tag):
            for span in special_div.select("span[data-rate-code]"):
                code = span.get("data-rate-code", "")
                term = SPECIAL_RATE_CODE_MAP.get(code)
                if term is None:
                    continue
                try:
                    val = float(span.get_text(strip=True))
                except ValueError:
                    continue
                if 1.0 <= val <= 15.0 and term.value not in specials:
                    specials[term.value] = val

        # Attach to already-collected rates by term match
        for i, r in enumerate(rates):
            term_key = r.term if isinstance(r.term, str) else r.term.value
            if term_key in specials:
                rates[i] = Rate(term=r.term, posted=r.posted, discounted=specials[term_key])
```

(For variable rate, RBC's "Special Rates" section may also publish a variable spread; if so, add similar logic for `PRIME_RATE_CODE` + special-spread code identified in Step 2.)

- [ ] **Step 5:** Verify + tests + commit:
```bash
uv run python -c "
import sys; sys.path.insert(0, '.')
from lenders.rbc import RBCScraper
html = open('tests/fixtures/rbc.html', encoding='utf-8').read()
for r in RBCScraper().parse(html):
    print(f'{r.term:15s} posted={r.posted:.2f}  discounted={r.discounted}')"

uv run pytest tests/test_lenders.py -v -k rbc
git add scraper/lenders/rbc.py
git commit -m "feat(scraper): RBC parser captures special-rates section codes for discounted"
```

If the fixture lacks a special-rates section (it may be `tests/fixtures/rbc.html` was captured without that tab being expanded), report DONE_WITH_CONCERNS and the operator can re-capture via `manual_capture.py rbc` to refresh the fixture before final tests.

---

## Task 8: TD parser — capture SpecialRate values

**Files:** Modify `scraper/lenders/td.py`

The existing TD parser filters `data-source='tdct-resl'` with `data-value='PostedRate'`. There should be a corresponding `data-value='SpecialRate'` (or similar) for each product. Inspect the fixture to confirm the exact attribute name.

- [ ] **Step 1:** Inspect:
```bash
cd scraper && uv run python -c "
from bs4 import BeautifulSoup
html = open('tests/fixtures/td.html', encoding='utf-8').read()
soup = BeautifulSoup(html, 'lxml')
# What data-value attributes exist?
seen = set()
for el in soup.find_all(attrs={'data-source': 'tdct-resl'}):
    seen.add(el.get('data-value'))
print('data-value attributes:', seen)"
```

Common values are likely: `PostedRate`, `SpecialRate`, `BestRate`, `APR`. Use whichever matches the bank's "special offer" / "best advertised" rate.

- [ ] **Step 2:** In `scraper/lenders/td.py`, locate the existing block that filters by `PostedRate`. After it, add a parallel block that walks elements with `data-value` set to the special-offer attribute identified in Step 1 (e.g. `SpecialRate`), builds a `specials: dict[str, float]` keyed by term, then attaches to the existing rates list (same pattern as RBC Step 4).

- [ ] **Step 3:** Verify + tests + commit:
```bash
uv run pytest tests/test_lenders.py -v -k td
git add scraper/lenders/td.py
git commit -m "feat(scraper): TD parser captures SpecialRate values for discounted"
```

If the fixture lacks special-rate attributes, report DONE_WITH_CONCERNS — operator will refresh the TD fixture.

---

## Task 9: Update `rates.sample.json` with realistic dual-rate data

**Files:** Modify `site/src/data/rates.sample.json`

Replace placeholder rates with values reflecting bank-published special offers. For lenders with no special offer for a particular term, set `"discounted": null`.

- [ ] **Step 1:** For each lender, set `discounted` per term as follows. Use the values currently observed (or representative if not):

For brevity, the operator should run the live scraper output as the source of truth:

```bash
cd scraper && uv run python -m core.cli --output ../site/src/data/rates.sample.json --verbose --dry-run > /tmp/scraped.json 2>&1
```

But since `--dry-run` writes to stdout, instead:

```bash
cd scraper && uv run python -m core.cli --dry-run 2>/dev/null > ../site/src/data/rates.sample.json
```

This makes the sample data exactly match a fresh scraper run (assumes all 7 fixtures exist in `data/manual/`). If any lender is missing fixtures, the runner skips them and the sample is still valid.

- [ ] **Step 2:** Verify the JSON parses and run site tests:
```bash
cd ../site && npm run test
```

Expected: tests pass. Note that `rates.test.ts` may need updating if the "best 5yr" assertion no longer matches — update the expected value to whatever the sample now shows.

- [ ] **Step 3:** Commit:
```bash
git add site/src/data/rates.sample.json site/src/lib/rates.test.ts
git commit -m "feat(site): regenerate sample data with bank-published discounted rates"
```

---

## Task 10: Update `LenderRow.astro` to render posted-only when discounted is null

**Files:** Modify `site/src/components/LenderRow.astro`

Currently the rate cell renders `<s>posted</s><br><strong>discounted</strong>`. When `discounted` is null, render only `<strong>posted</strong>` with no strikethrough.

- [ ] **Step 1:** In `site/src/components/LenderRow.astro`, find the rate cell:

```astro
        <td class="lender-row__rate">
          {rate ? (
            <>
              <s class="lender-row__posted">{formatPercent(rate.posted)}</s>
              <br />
              <strong class="lender-row__discounted">
                {formatPercent(rate.discounted)}
              </strong>
            </>
          ) : (
            "—"
          )}
        </td>
```

Replace with:

```astro
        <td class="lender-row__rate">
          {rate ? (
            rate.discounted !== null && rate.discounted !== undefined ? (
              <>
                <s class="lender-row__posted">{formatPercent(rate.posted)}</s>
                <br />
                <strong class="lender-row__discounted">
                  {formatPercent(rate.discounted)}
                </strong>
              </>
            ) : (
              <strong class="lender-row__discounted">
                {formatPercent(rate.posted)}
              </strong>
            )
          ) : (
            "—"
          )}
        </td>
```

- [ ] **Step 2:** Run `cd site && npm run check && npm run build` — expect 2 pre-existing errors only.

- [ ] **Step 3:** Commit:
```bash
git add site/src/components/LenderRow.astro
git commit -m "feat(site): render posted-only when no discounted rate published"
```

---

## Task 11: Update `HeroFeaturedRates` fallback when no discounted

**Files:** Modify `site/src/lib/rates.ts`

`bestRateForTerm` currently sorts by `discounted` ascending, treating null as Infinity (last). When ALL lenders have null discounted for a term, the function returns null. We want it to fall back to best `posted` in that case.

- [ ] **Step 1:** In `site/src/lib/rates.ts`, find `bestRateForTerm`. Replace it with:

```ts
/** Return the lender + rate with the lowest effective rate for the given term, or null.
 *  Effective rate = discounted ?? posted (so we still rank when bank doesn't publish a special). */
export function bestRateForTerm(
  data: RatesData,
  term: Term,
): BestRate | null {
  let best: BestRate | null = null;
  let bestRate = Infinity;
  for (const lender of data.lenders) {
    const rate = lender.rates.find((r) => r.term === term);
    if (!rate) continue;
    const effective = rate.discounted ?? rate.posted;
    if (effective < bestRate) {
      bestRate = effective;
      best = { lender, rate };
    }
  }
  return best;
}
```

- [ ] **Step 2:** In `site/src/components/HeroFeaturedRates.astro`, the line `<p class="hero-card__rate">{formatPercent(best!.rate.discounted)}</p>` needs to handle null. Replace with:

```astro
          <p class="hero-card__rate">{formatPercent(best!.rate.discounted ?? best!.rate.posted)}</p>
```

- [ ] **Step 3:** Tests:
```bash
cd site && npm run test
```
Update `rates.test.ts` if the best-rate assertion fails (the new effective-rate logic might change which lender wins).

- [ ] **Step 4:** Commit:
```bash
git add site/src/lib/rates.ts site/src/components/HeroFeaturedRates.astro site/src/lib/rates.test.ts
git commit -m "feat(site): bestRateForTerm uses discounted ?? posted as effective rate"
```

---

## Task 12: Add disclaimer microcopy to RateTable

**Files:** Modify `site/src/components/RateTable.astro`

- [ ] **Step 1:** In `site/src/components/RateTable.astro`, after the `</table>` closing tag, add a small disclaimer paragraph:

```astro
<p class="rate-table__disclaimer">
  Discounted rates shown are bank-advertised special offers. Mortgage brokers may
  offer further discounts. Posted rates are used by federal stress tests; actual
  qualifying rates may differ.
</p>

<style>
  .rate-table__disclaimer {
    margin-top: 1rem;
    font-size: 0.85rem;
    color: #6c757d;
    line-height: 1.4;
  }
</style>
```

(If `RateTable.astro` already has a `<style>` block, append the rule to it instead of adding a new block.)

- [ ] **Step 2:** Build + commit:
```bash
cd site && npm run build && cd ..
git add site/src/components/RateTable.astro
git commit -m "feat(site): add disclaimer noting brokers may offer further discounts"
```

---

## Task 13: End-to-end refresh and verification

- [ ] **Step 1:** Run the full refresh pipeline locally:
```bash
cd scraper
uv run python scripts/refresh_rates.py --no-push
```
Expected: all 4 manual-capture lenders refresh, scraper runs, `data/rates.json` is updated. Inspect the file to confirm the `discounted` field is populated where banks publish specials and `null` otherwise.

- [ ] **Step 2:** Run all tests:
```bash
cd scraper && uv run pytest -v 2>&1 | tail -10
cd ../site && npm run check && npm run test && npm run build
```
Expected: scraper 21+ tests pass; site 30+ tests pass; build succeeds.

- [ ] **Step 3:** If tests pass, push everything and update the data branch:
```bash
cd ..
git push origin main
cd scraper
uv run python scripts/refresh_rates.py --skip-capture
```
(Skip capture since fixtures are already fresh from Step 1.)

- [ ] **Step 4:** Inspect the live staging site after Cloudflare rebuilds (~2 min). Verify:
- Rows where bank publishes both rates show strikethrough posted + bold discounted
- Rows where bank doesn't publish a special show only bold posted
- Disclaimer is visible below the rate table
- Hero card shows reasonable best rates

---

## Self-Review Checklist

- [ ] `apply_discount` no longer called in the runner path
- [ ] All 7 lenders' parsers populate `discounted` where the bank publishes a special offer
- [ ] Tangerine sets `discounted = posted` (single advertised rate)
- [ ] Site renders posted-only correctly when `rate.discounted` is null
- [ ] `bestRateForTerm` falls back to `posted` when no `discounted` present
- [ ] Disclaimer is visible on the rate table
- [ ] All tests pass; build succeeds
- [ ] Live staging site shows correct dual/single-rate rendering for all 7 lenders
