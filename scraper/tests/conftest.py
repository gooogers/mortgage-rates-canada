"""Test configuration."""
import sys
from pathlib import Path

# Make scraper package importable as if scraper/ were the root
sys.path.insert(0, str(Path(__file__).parent.parent))
