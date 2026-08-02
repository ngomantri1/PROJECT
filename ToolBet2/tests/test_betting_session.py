from __future__ import annotations

import unittest
from datetime import datetime

from src.betting_session import BettingSession, PendingBet
from src.capital_managers import create_money_manager
from src.models import BetSide


def pending_bet(
    *,
    side: BetSide = BetSide.PLAYER,
    stake: int = 100,
    round_id: str = "round-1",
) -> PendingBet:
    return PendingBet(
        bet_id=0,
        round_id=round_id,
        side=side,
        stake=stake,
        stake_index=0,
        pattern_id="test",
        pattern_name="Test",
        reason="characterization",
        target_round_index=1,
        placed_at=datetime(2026, 1, 1),
    )


class BettingSessionTests(unittest.TestCase):
    def test_requires_auto_bet_and_no_pending(self) -> None:
        session = BettingSession([100])
        self.assertFalse(session.can_place_bet())

        session.configure(auto_bet=True)
        self.assertTrue(session.can_place_bet())

        self.assertTrue(session.try_reserve_pending(pending_bet()))
        self.assertFalse(session.can_place_bet())

    def test_only_one_pending_bet_can_be_reserved(self) -> None:
        session = BettingSession([100])
        session.configure(auto_bet=True)

        self.assertTrue(session.try_reserve_pending(pending_bet(round_id="r1")))
        self.assertFalse(session.try_reserve_pending(pending_bet(round_id="r2")))
        self.assertEqual(session.state.total_bets, 1)
        self.assertEqual(session.state.pending.round_id, "r1")

    def test_resolve_pending_updates_stats_and_clears_pending(self) -> None:
        session = BettingSession([100])
        session.configure(auto_bet=True)
        session.try_reserve_pending(pending_bet())

        resolved = session.resolve_pending(BetSide.PLAYER)

        self.assertEqual(resolved, ("win", 100.0))
        self.assertIsNone(session.state.pending)
        self.assertEqual(session.state.wins, 1)
        self.assertEqual(session.state.losses, 0)
        self.assertEqual(session.state.session_profit, 100.0)

    def test_tie_counts_as_push(self) -> None:
        session = BettingSession([100])
        session.try_reserve_pending(pending_bet())

        resolved = session.resolve_pending(BetSide.TIE)

        self.assertEqual(resolved, ("push", 0.0))
        self.assertEqual(session.state.pushes, 1)
        self.assertEqual(session.state.session_profit, 0.0)

    def test_take_profit_disables_auto_bet_after_resolution(self) -> None:
        session = BettingSession([100], take_profit=100)
        session.configure(auto_bet=True)
        session.try_reserve_pending(pending_bet())

        session.resolve_pending(BetSide.PLAYER)

        self.assertEqual(session.state.limit_hit, "take_profit")
        self.assertFalse(session.state.auto_bet)
        self.assertFalse(session.can_place_bet())

    def test_external_profit_provider_is_authoritative_for_limits(self) -> None:
        session = BettingSession([100], stop_loss=200)
        session.configure(auto_bet=True)
        session.set_profit_for_limits(lambda: -250.0)

        hit = session.apply_limit_if_hit()

        self.assertEqual(hit, "stop_loss")
        self.assertFalse(session.state.auto_bet)

    def test_reference_money_manager_controls_live_stake_and_next_level(self):
        session = BettingSession([999])
        manager = create_money_manager("IncreaseWhenLose", [10, 20, 40])
        session.activate_money_manager(manager)
        session.configure(auto_bet=True)
        session.try_reserve_pending(pending_bet(stake=10))

        resolved = session.resolve_pending(BetSide.BANKER)

        self.assertEqual(("loss", -10.0), resolved)
        self.assertEqual(20, session.current_stake)
        self.assertEqual(1, session.current_stake_index)
        self.assertEqual("IncreaseWhenLose", session.overlay_status()["money_manager_id"])

    def test_reference_money_manager_applies_banker_commission_and_limit(self):
        session = BettingSession([999])
        manager = create_money_manager(
            "IncreaseWhenWin", [100, 200], take_profit=95
        )
        session.activate_money_manager(manager)
        session.configure(auto_bet=True)
        session.try_reserve_pending(
            pending_bet(side=BetSide.BANKER, stake=100)
        )

        resolved = session.resolve_pending(BetSide.BANKER)

        self.assertEqual(("win", 95.0), resolved)
        self.assertEqual("take_profit", session.state.limit_hit)
        self.assertFalse(session.state.auto_bet)


if __name__ == "__main__":
    unittest.main()
