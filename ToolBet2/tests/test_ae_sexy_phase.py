from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, Mock, patch

from src.ae_sexy import PHASE_ROOM, PHASE_WEB, detect_ae_sexy_phase


class _Page:
    def __init__(self, url: str):
        self.url = url


class AeSexyPhaseTests(unittest.IsolatedAsyncioTestCase):
    async def test_vipbet_root_with_room_shell_is_not_classified_as_web(self):
        page = _Page("https://vipbet389.com/")
        site = Mock()
        site.info.shell_mode = "casino_iframe"

        with (
            patch("src.sites.resolve_site_from_page", return_value=site),
            patch("src.ae_sexy._get_shell_mode", AsyncMock(return_value="room")),
            patch("src.ae_sexy.probe_game_state", AsyncMock()) as probe,
        ):
            phase = await detect_ae_sexy_phase(page, "Baccarat C01")

        self.assertEqual(PHASE_ROOM, phase)
        probe.assert_not_awaited()

    async def test_unrelated_web_page_still_short_circuits_as_web(self):
        page = _Page("https://example.com/")

        with (
            patch("src.sites.resolve_site_from_page", return_value=None),
            patch("src.ae_sexy._get_shell_mode", AsyncMock()) as shell_mode,
        ):
            phase = await detect_ae_sexy_phase(page, "Baccarat C01")

        self.assertEqual(PHASE_WEB, phase)
        shell_mode.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
