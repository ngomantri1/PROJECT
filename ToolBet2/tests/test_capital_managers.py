from __future__ import annotations

import unittest

from src.capital_managers import (
    MONEY_MANAGER_IDS,
    CapitalStateSnapshot,
    create_money_manager,
)
from src.models import BetSide
from src.money_manager import MoneyOutcome


REFERENCE_STAKE_FIXTURES = {
    "IncreaseWhenLose": (
        ["L", "L", "L", "W"],
        [10, 20, 40, 10, 10],
    ),
    "IncreaseWhenWin": (
        ["W", "W", "W", "L"],
        [10, 20, 40, 10, 10],
    ),
    "Victor2": (
        ["W", "L", "W", "W", "L", "L", "L"],
        [10, 10, 20, 40, 10, 20, 40, 10],
    ),
    "ReverseFibo": (
        ["L", "L", "L", "W"],
        [10, 20, 40, 40, 10],
    ),
    "IncreaseEveryRound": (
        ["W", "L", "W"],
        [10, 20, 40, 10],
    ),
    "WinUpLoseKeep": (
        ["W", "L", "W"],
        [10, 20, 20, 40],
    ),
    "WinUpLoseDown": (
        ["W", "W", "L", "L"],
        [10, 20, 40, 20, 10],
    ),
}


def apply_code(manager, code: str):
    result = BetSide.PLAYER if code == "W" else BetSide.BANKER
    return manager.apply_result(BetSide.PLAYER, result)


class ReferenceMoneyManagerParityTests(unittest.TestCase):
    def test_all_eight_reference_manager_ids_are_present(self):
        self.assertEqual(
            {
                "IncreaseWhenLose",
                "IncreaseWhenWin",
                "Victor2",
                "ReverseFibo",
                "MultiChain",
                "IncreaseEveryRound",
                "WinUpLoseKeep",
                "WinUpLoseDown",
            },
            MONEY_MANAGER_IDS,
        )

    def test_single_chain_stake_level_fixtures_match_reference_runtime(self):
        for manager_id, (results, expected) in REFERENCE_STAKE_FIXTURES.items():
            with self.subTest(manager_id=manager_id):
                manager = create_money_manager(manager_id, [10, 20, 40])
                actual = [manager.quote().stake]
                for result in results:
                    apply_code(manager, result)
                    actual.append(manager.quote().stake)
                self.assertEqual(expected, actual)

    def test_multi_chain_moves_forward_on_exhausted_loss_and_back_on_recovery(self):
        manager = create_money_manager(
            "MultiChain",
            [10, 20],
            stake_chains=[[10, 20], [30, 60]],
        )

        self.assertEqual(10, manager.quote().stake)
        apply_code(manager, "L")
        self.assertEqual(20, manager.quote().stake)
        apply_code(manager, "L")
        self.assertEqual(30, manager.quote().stake)
        apply_code(manager, "W")

        self.assertEqual(10, manager.quote().stake)
        self.assertEqual(0, manager.snapshot().chain_index)

    def test_multi_chain_uses_actual_banker_commission_for_recovery(self):
        manager = create_money_manager(
            "MultiChain",
            [10, 20],
            stake_chains=[[10, 20], [30, 60]],
        )
        apply_code(manager, "L")
        apply_code(manager, "L")
        update = manager.apply_result(BetSide.BANKER, BetSide.BANKER)

        self.assertEqual(29.0, update.profit)
        self.assertEqual(1, manager.snapshot().chain_index)
        self.assertEqual(29.0, manager.snapshot().chain_profit)

    def test_nonnegative_win_total_resets_stake_level_like_reference(self):
        manager = create_money_manager(
            "IncreaseEveryRound", [100, 200, 300], auto_reset_on_nonnegative_pnl=True
        )
        update = manager.apply_result(BetSide.PLAYER, BetSide.PLAYER)

        self.assertEqual(0, update.next_quote.level_index)
        self.assertEqual(100, update.next_quote.stake)
        self.assertEqual(100.0, manager.snapshot().session_pnl)
        self.assertEqual(0.0, manager.snapshot().recovery_pnl)

    def test_nonnegative_option_resets_after_first_win_from_zero(self):
        manager = create_money_manager(
            "IncreaseWhenWin", [10, 20], auto_reset_on_nonnegative_pnl=True
        )

        update = apply_code(manager, "W")

        self.assertEqual(10, update.next_quote.stake)
        self.assertEqual(0, update.next_quote.level_index)

    def test_tie_is_push_and_does_not_change_next_quote(self):
        for manager_id in MONEY_MANAGER_IDS:
            with self.subTest(manager_id=manager_id):
                manager = create_money_manager(
                    manager_id,
                    [10, 20],
                    stake_chains=[[10, 20], [30, 60]],
                )
                before = manager.quote()
                update = manager.apply_result(BetSide.PLAYER, BetSide.TIE)
                after = manager.quote()
                self.assertEqual(MoneyOutcome.PUSH, update.outcome)
                self.assertEqual(0, update.profit)
                self.assertEqual(before.stake, after.stake)
                self.assertEqual(before.level_index, after.level_index)

    def test_quote_is_read_only_for_every_manager(self):
        for manager_id in MONEY_MANAGER_IDS:
            with self.subTest(manager_id=manager_id):
                manager = create_money_manager(
                    manager_id,
                    [10, 20],
                    stake_chains=[[10, 20], [30, 60]],
                )
                before = manager.snapshot()
                manager.quote()
                manager.quote()
                self.assertEqual(before, manager.snapshot())

    def test_banker_commission_and_take_profit_stop_are_snapshotted(self):
        manager = create_money_manager(
            "IncreaseWhenWin",
            [100],
            take_profit=95,
        )
        update = manager.apply_result(BetSide.BANKER, BetSide.BANKER)

        self.assertAlmostEqual(95, update.profit)
        self.assertEqual("take_profit", manager.limit_hit)
        self.assertEqual("take_profit", manager.snapshot().limit_hit)

    def test_stop_loss_is_applied_to_accumulated_real_profit(self):
        manager = create_money_manager(
            "IncreaseWhenLose",
            [100, 200],
            stop_loss=300,
        )
        apply_code(manager, "L")
        apply_code(manager, "L")

        self.assertEqual(-300, manager.snapshot().session_pnl)
        self.assertEqual("stop_loss", manager.limit_hit)

    def test_snapshot_restore_produces_same_next_decision_after_restart(self):
        for manager_id in MONEY_MANAGER_IDS:
            with self.subTest(manager_id=manager_id):
                kwargs = {
                    "stake_chains": [[10, 20], [30, 60]],
                    "stop_loss": 500,
                    "take_profit": 500,
                }
                original = create_money_manager(manager_id, [10, 20], **kwargs)
                apply_code(original, "L")
                apply_code(original, "W")
                snapshot = original.snapshot()

                restored = create_money_manager(manager_id, [10, 20], **kwargs)
                restored.restore(CapitalStateSnapshot.from_dict(snapshot.to_dict()))

                self.assertEqual(original.quote(), restored.quote())
                next_original = apply_code(original, "L")
                next_restored = apply_code(restored, "L")
                self.assertEqual(
                    next_original.next_quote,
                    next_restored.next_quote,
                )
                self.assertEqual(
                    original.snapshot(),
                    restored.snapshot(),
                )

    def test_reset_returns_to_first_level_and_clears_limits(self):
        manager = create_money_manager(
            "Victor2", [10, 20], stop_loss=20
        )
        apply_code(manager, "L")
        apply_code(manager, "L")
        manager.reset()

        self.assertEqual(10, manager.quote().stake)
        snapshot = manager.snapshot()
        self.assertEqual("", snapshot.limit_hit)
        self.assertEqual(0, snapshot.session_pnl)


if __name__ == "__main__":
    unittest.main()
