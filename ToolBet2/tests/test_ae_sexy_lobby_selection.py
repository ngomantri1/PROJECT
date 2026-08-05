from __future__ import annotations

import inspect
import unittest

from src.ae_sexy import scroll_lobby_to_table


class AeSexyLobbySelectionTests(unittest.TestCase):
    def test_provider_lobby_fallback_excludes_toolbet_overlay(self) -> None:
        source = inspect.getsource(scroll_lobby_to_table)

        self.assertIn(
            "for (const el of doc.querySelectorAll('div.cursor-pointer, "
            "div[class*=\"cursor-pointer\"], *')) {\n"
            "                  if (el.closest('#toolbet-ui-v2')) continue;",
            source,
        )
        self.assertIn(
            "].filter(el => !el.closest('#toolbet-ui-v2') "
            "&& el.scrollHeight > el.clientHeight + 30);",
            source,
        )


if __name__ == "__main__":
    unittest.main()
