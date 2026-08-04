from __future__ import annotations

import unittest

from src.models import BetSide
from src.progression import (
    GroupStakeProgression,
    PROGRESSION_MODE_BOTH_UP,
    PROGRESSION_MODE_LOSS_UP_WIN_RESET,
    PROGRESSION_MODE_PROFIT_LOCK_LOSS_UP,
    PROGRESSION_MODE_WIN_UP_LOSS_HOLD,
    PROGRESSION_MODE_WIN_UP_LOSS_RESET,
    win_profit,
)


class WinProfitTests(unittest.TestCase):
    def test_player_win_pays_one_to_one(self) -> None:
        self.assertEqual(win_profit(100, BetSide.PLAYER), 100.0)

    def test_banker_win_applies_default_commission(self) -> None:
        self.assertEqual(win_profit(100, BetSide.BANKER), 95.0)

    def test_banker_win_rounds_half_up_to_whole_chip_units(self) -> None:
        self.assertEqual(win_profit(10, BetSide.BANKER), 10.0)

    def test_non_positive_stake_has_no_profit(self) -> None:
        self.assertEqual(win_profit(0, BetSide.PLAYER), 0.0)


class GroupStakeProgressionTests(unittest.TestCase):
    def test_rejects_empty_or_negative_stakes(self) -> None:
        with self.assertRaises(ValueError):
            GroupStakeProgression([])
        with self.assertRaises(ValueError):
            GroupStakeProgression([0, -100])

    def test_unknown_mode_falls_back_to_loss_up_win_reset(self) -> None:
        progression = GroupStakeProgression([0, 100], mode="not-a-mode")
        self.assertEqual(progression.mode, PROGRESSION_MODE_LOSS_UP_WIN_RESET)

    def test_tie_is_push_and_keeps_level(self) -> None:
        progression = GroupStakeProgression([0, 100, 200])
        progression.apply_result(BetSide.PLAYER, BetSide.BANKER)
        index_before = progression.index
        pnl_before = progression.group_pnl

        outcome, next_stake, profit = progression.apply_result(
            BetSide.PLAYER,
            BetSide.TIE,
        )

        self.assertEqual(outcome, "push")
        self.assertEqual(profit, 0.0)
        self.assertEqual(next_stake, 100)
        self.assertEqual(progression.index, index_before)
        self.assertEqual(progression.group_pnl, pnl_before)
        self.assertEqual(progression.state.group_results, ["L", "T"])

    def test_loss_up_win_reset_characterization(self) -> None:
        progression = GroupStakeProgression(
            [0, 100, 200],
            mode=PROGRESSION_MODE_LOSS_UP_WIN_RESET,
        )

        progression.apply_result(BetSide.PLAYER, BetSide.BANKER)
        self.assertEqual((progression.index, progression.loss_count), (1, 1))

        progression.apply_result(BetSide.PLAYER, BetSide.PLAYER)
        self.assertEqual((progression.index, progression.loss_count), (0, 0))
        self.assertEqual(progression.group_pnl, 100.0)

    def test_win_up_loss_reset_characterization(self) -> None:
        progression = GroupStakeProgression(
            [0, 100, 200],
            mode=PROGRESSION_MODE_WIN_UP_LOSS_RESET,
        )

        progression.apply_result(BetSide.PLAYER, BetSide.PLAYER)
        self.assertEqual(progression.index, 1)

        progression.apply_result(BetSide.PLAYER, BetSide.BANKER)
        self.assertEqual(progression.index, 0)
        self.assertEqual(progression.loss_count, 1)

    def test_both_up_characterization(self) -> None:
        progression = GroupStakeProgression(
            [0, 100, 200],
            mode=PROGRESSION_MODE_BOTH_UP,
        )

        progression.apply_result(BetSide.PLAYER, BetSide.PLAYER)
        self.assertEqual(progression.index, 1)
        progression.apply_result(BetSide.PLAYER, BetSide.BANKER)
        self.assertEqual(progression.index, 2)

    def test_win_up_loss_hold_characterization(self) -> None:
        progression = GroupStakeProgression(
            [0, 100, 200],
            mode=PROGRESSION_MODE_WIN_UP_LOSS_HOLD,
        )

        progression.apply_result(BetSide.PLAYER, BetSide.BANKER)
        self.assertEqual(progression.index, 0)
        progression.apply_result(BetSide.PLAYER, BetSide.PLAYER)
        self.assertEqual(progression.index, 1)

    def test_profit_lock_climbs_until_group_pnl_is_positive(self) -> None:
        progression = GroupStakeProgression(
            [0, 100, 100],
            mode=PROGRESSION_MODE_PROFIT_LOCK_LOSS_UP,
        )

        progression.apply_result(BetSide.PLAYER, BetSide.BANKER)
        progression.apply_result(BetSide.PLAYER, BetSide.BANKER)
        self.assertEqual((progression.index, progression.group_pnl), (2, -100.0))

        progression.apply_result(BetSide.PLAYER, BetSide.PLAYER)
        self.assertEqual((progression.index, progression.group_pnl), (2, 0.0))

        progression.apply_result(BetSide.PLAYER, BetSide.PLAYER)
        self.assertEqual((progression.index, progression.loss_count), (0, 0))
        self.assertEqual(progression.group_pnl, 100.0)

    def test_loss_watch_resets_when_group_pnl_recovers_to_zero(self) -> None:
        progression = GroupStakeProgression(
            [100, 100],
            mode=PROGRESSION_MODE_LOSS_UP_WIN_RESET,
            loss_watch_recover=True,
        )

        progression.apply_result(BetSide.PLAYER, BetSide.BANKER)
        progression.apply_result(BetSide.PLAYER, BetSide.PLAYER)

        self.assertEqual((progression.index, progression.loss_count), (0, 0))
        self.assertEqual(0.0, progression.group_pnl)
        self.assertEqual(progression.group_pnl, 0.0)

    def test_take_profit_closes_and_resets_group(self) -> None:
        progression = GroupStakeProgression(
            [100, 200],
            group_take_profit=100,
        )

        outcome, next_stake, profit = progression.apply_result(
            BetSide.PLAYER,
            BetSide.PLAYER,
        )

        self.assertEqual((outcome, next_stake, profit), ("win", 100, 100.0))
        self.assertEqual(progression.state.groups_closed, 1)
        self.assertEqual(progression.state.last_group_close, "take_profit")
        self.assertEqual(progression.state.last_closed_group_pnl, 100.0)
        self.assertEqual(progression.group_pnl, 0.0)

    def test_stop_loss_closes_and_resets_group(self) -> None:
        progression = GroupStakeProgression(
            [100, 200],
            group_stop_loss=100,
        )

        progression.apply_result(BetSide.PLAYER, BetSide.BANKER)

        self.assertEqual(progression.state.groups_closed, 1)
        self.assertEqual(progression.state.last_group_close, "stop_loss")
        self.assertEqual(progression.state.last_closed_group_pnl, -100.0)
        self.assertEqual((progression.index, progression.loss_count), (0, 0))


if __name__ == "__main__":
    unittest.main()
