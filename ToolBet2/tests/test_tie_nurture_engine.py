from __future__ import annotations

import unittest

from src.config import TieNurtureConfig
from src.models import BetSide
from src.tie_nurture_engine import TieNurtureEngine


def tie_config(**overrides) -> TieNurtureConfig:
    values = {
        "enabled": True,
        "preset": "custom",
        "gap_min": 3,
        "gap_max": 6,
        "max_bets": 2,
        "stake": 100,
        "payout": 8.0,
        "session_stop_loss": 0,
    }
    values.update(overrides)
    return TieNurtureConfig(**values)


class TieNurtureEngineTests(unittest.TestCase):
    def test_sync_activates_when_gap_reaches_minimum(self) -> None:
        engine = TieNurtureEngine(tie_config())

        engine.sync_from_history(
            [BetSide.TIE, BetSide.PLAYER, BetSide.BANKER, BetSide.PLAYER]
        )

        self.assertEqual(engine.gap, 3)
        self.assertTrue(engine.active)
        self.assertTrue(engine.wants_bet())

    def test_pending_blocks_another_tie_bet(self) -> None:
        engine = TieNurtureEngine(tie_config())
        engine.sync_from_history([BetSide.PLAYER] * 3)
        engine.begin_pending(round_id="r1", stake=100, target_round_index=4)

        self.assertTrue(engine.has_pending)
        self.assertFalse(engine.wants_bet())

    def test_tie_win_ends_cycle_and_uses_configured_payout(self) -> None:
        engine = TieNurtureEngine(tie_config())
        engine.sync_from_history([BetSide.PLAYER] * 3)
        engine.begin_pending(round_id="r1", stake=100, target_round_index=4)

        resolved = engine.resolve_pending(BetSide.TIE)

        self.assertEqual(resolved, ("win", 800.0))
        self.assertFalse(engine.active)
        self.assertEqual(engine.gap, 0)
        self.assertEqual(engine.session_pnl, 800.0)
        self.assertEqual(engine.wins, 1)

    def test_max_bets_cuts_cycle_after_losses(self) -> None:
        engine = TieNurtureEngine(tie_config(max_bets=2))
        engine.sync_from_history([BetSide.PLAYER] * 3)

        engine.begin_pending(round_id="r1", stake=100, target_round_index=4)
        engine.resolve_pending(BetSide.PLAYER)
        self.assertTrue(engine.active)

        engine.begin_pending(round_id="r2", stake=100, target_round_index=5)
        engine.resolve_pending(BetSide.BANKER)

        self.assertFalse(engine.active)
        self.assertEqual(engine.losses, 2)
        self.assertEqual(engine.session_pnl, -200.0)

    def test_session_stop_loss_stops_future_cycles(self) -> None:
        engine = TieNurtureEngine(tie_config(max_bets=0, session_stop_loss=100))
        engine.sync_from_history([BetSide.PLAYER] * 3)
        engine.begin_pending(round_id="r1", stake=100, target_round_index=4)

        engine.resolve_pending(BetSide.PLAYER)

        self.assertTrue(engine.stopped_sl)
        self.assertFalse(engine.active)
        self.assertFalse(engine.wants_bet())


if __name__ == "__main__":
    unittest.main()
