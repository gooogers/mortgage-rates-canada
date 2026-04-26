"""Read previous rates and write the new rates.json."""
from __future__ import annotations

import json
from pathlib import Path

from core.models import RatesData


def load_previous_rates(path: Path) -> RatesData | None:
    """Load previous rates.json if it exists; return None otherwise."""
    if not path.exists():
        return None
    return RatesData.model_validate_json(path.read_text())


def write_rates_json(data: RatesData, path: Path) -> None:
    """Write rates data to disk using the spec's JSON shape."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data.model_dump(mode="json"), indent=2) + "\n",
        encoding="utf-8",
    )
