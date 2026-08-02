from __future__ import annotations

import unittest

from src.models import BetSide
from src.money_manager import (
    MoneyManager,
    MoneyOutcome,
    ProgressionMoneyManager,
)
from src.progression import (
    PROGRESSION_MODE_LOSS_UP_WIN_RESET,
    PROGRESSION_MODE_PROFIT_LOCK_LOSS_UP,
)


class ProgressionMoneyManagerTests(unittest.TestCase):
    def test_conforms_to_money_manager_protocol(self) -> None:
        manager = ProgressionMoneyManager(
            [0, 100],
            mode=PROGRESSION_MODE_LOSS_UP_WIN_RESET,
        )
        self.assertIsInstance(manager, MoneyManager)

    def test_quote_marks_zero_stake_as_virtual(self) -> None:
        manager = ProgressionMoneyManager(
            [0, 100],
            mode=PROGRESSION_MODE_LOSS_UP_WIN_RESET,
        )

        quote = manager.quote()

        self.assertTrue(quote.is_virtual)
        self.assertEqual(quote.level_index, 0)
        self.assertEqual(quote.total_levels, 2)

    def test_apply_result_reports_previous_and_next_quote(self) -> None:
        manager = ProgressionMoneyManager(
            [0, 100, 200],
            mode=PROGRESSION_MODE_LOSS_UP_WIN_RESET,
        )

        update = manager.apply_result(BetSide.PLAYER, BetSide.BANKER)

        self.assertEqual(update.outcome, MoneyOutcome.LOSS)
        self.assertEqual(update.profit, 0.0)
        self.assertEqual(update.previous_quote.stake, 0)
        self.assertEqual(update.next_quote.stake, 100)
        self.assertFalse(update.group_closed)

    def test_group_close_information_is_preserved(self) -> None:
        manager = ProgressionMoneyManager(
            [100, 200],
            mode=PROGRESSION_MODE_LOSS_UP_WIN_RESET,
            group_take_profit=100,
        )

        update = manager.apply_result(BetSide.PLAYER, BetSide.PLAYER)

        self.assertTrue(update.group_closed)
        self.assertEqual(update.group_close_reason, "take_profit")
        self.assertEqual(update.closed_group_pnl, 100.0)
        self.assertEqual(update.next_quote.level_index, 0)

    def test_snapshot_restore_round_trip(self) -> None:
        manager = ProgressionMoneyManager(
            [0, 100, 100],
            mode=PROGRESSION_MODE_PROFIT_LOCK_LOSS_UP,
        )
        manager.apply_result(BetSide.PLAYER, BetSide.BANKER)
        manager.apply_result(BetSide.PLAYER, BetSide.BANKER)
        snapshot = manager.snapshot()

        restored = ProgressionMoneyManager(
            [0, 100, 100],
            mode=PROGRESSION_MODE_PROFIT_LOCK_LOSS_UP,
        )
        restored.restore(snapshot)

        self.assertEqual(restored.snapshot(), snapshot)
        self.assertEqual(restored.quote().stake, manager.quote().stake)

    def test_restore_rejects_different_mode_or_stakes(self) -> None:
        source = ProgressionMoneyManager(
            [0, 100],
            mode=PROGRESSION_MODE_LOSS_UP_WIN_RESET,
        )
        snapshot = source.snapshot()

        different_stakes = ProgressionMoneyManager(
            [0, 200],
            mode=PROGRESSION_MODE_LOSS_UP_WIN_RESET,
        )
        with self.assertRaises(ValueError):
            different_stakes.restore(snapshot)

        different_mode = ProgressionMoneyManager(
            [0, 100],
            mode=PROGRESSION_MODE_PROFIT_LOCK_LOSS_UP,
        )
        with self.assertRaises(ValueError):
            different_mode.restore(snapshot)

    def test_from_progression_clones_state_without_sharing_it(self) -> None:
        progression = ProgressionMoneyManager(
            [0, 100, 200],
            mode=PROGRESSION_MODE_LOSS_UP_WIN_RESET,
        ).progression
        progression.apply_result(BetSide.PLAYER, BetSide.BANKER)

        clone = ProgressionMoneyManager.from_progression(progression)
        clone.apply_result(BetSide.PLAYER, BetSide.BANKER)

        self.assertEqual(progression.index, 1)
        self.assertEqual(clone.progression.index, 2)


if __name__ == "__main__":
    unittest.main()
