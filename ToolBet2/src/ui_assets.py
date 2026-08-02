from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


_UI_DIR = Path(__file__).with_name("ui")


@dataclass(frozen=True)
class UiAssetBundle:
    theme_css: str
    components_css: str
    bridge_js: str


@lru_cache(maxsize=1)
def load_ui_assets() -> UiAssetBundle:
    """Load versioned UI assets once; fail early when an installation is incomplete."""

    return UiAssetBundle(
        theme_css=(_UI_DIR / "shared" / "theme.css").read_text(encoding="utf-8"),
        components_css=(_UI_DIR / "shared" / "components.css").read_text(encoding="utf-8"),
        bridge_js=(_UI_DIR / "bridge.js").read_text(encoding="utf-8"),
    )
