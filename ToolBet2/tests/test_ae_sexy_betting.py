from __future__ import annotations

import unittest

from src.ae_sexy_betting import (
    split_stake_by_available_chips,
    stake_to_value_clicks,
    value_plan_effective_total,
)


class ChipPlanningTests(unittest.TestCase):
    def test_reference_plan_repeats_chip_10_for_stake_20(self):
        chips = [10, 50, 100, 500, 0]

        plan = stake_to_value_clicks(20, chips)

        self.assertEqual([(10, 2)], plan)
        self.assertEqual(20, value_plan_effective_total(plan or []))

    def test_reference_greedy_plan_splits_120_with_visible_chip_values(self):
        chips = [10, 50, 100, 500, 1000]

        self.assertEqual([(100, 1), (10, 2)], split_stake_by_available_chips(120, chips))
        plan = stake_to_value_clicks(120, chips)
        self.assertEqual([(100, 1), (10, 2)], plan)
        self.assertEqual(120, value_plan_effective_total(plan or []))

    def test_chip_plan_uses_values_not_their_visual_order(self):
        self.assertEqual(
            [(100, 1), (10, 2)],
            split_stake_by_available_chips(120, [500, 10, 100, 50]),
        )

    def test_unrepresentable_amount_is_rejected(self):
        self.assertIsNone(split_stake_by_available_chips(125, [10, 50, 100, 500]))


if __name__ == "__main__":
    unittest.main()
