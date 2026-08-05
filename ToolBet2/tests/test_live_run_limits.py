from __future__ import annotations

import unittest

from src.live_run_limits import LiveRunLimitTracker


class LiveRunLimitTrackerTests(unittest.TestCase):
    def test_tabs_have_independent_profit_and_limits(self):
        tracker = LiveRunLimitTracker()
        tracker.reset(["one", "two"])

        one = tracker.record("one", 100, take_profit=100, stop_loss=0)
        two = tracker.record("two", -40, take_profit=0, stop_loss=100)

        self.assertEqual("take_profit", one.limit_hit)
        self.assertEqual(100, one.profit)
        self.assertEqual("", two.limit_hit)
        self.assertEqual(-40, two.profit)

    def test_zero_limits_never_stop_a_tab(self):
        tracker = LiveRunLimitTracker()
        tracker.reset(["one"])

        status = tracker.record("one", -1000, take_profit=0, stop_loss=0)

        self.assertEqual("", status.limit_hit)
        self.assertEqual(-1000, status.profit)

    def test_reset_tab_keeps_other_tab_run_profit(self):
        tracker = LiveRunLimitTracker()
        tracker.reset(["tab-a", "tab-b"])
        tracker.record("tab-a", 20, take_profit=0, stop_loss=0)
        tracker.record("tab-b", -10, take_profit=0, stop_loss=0)

        tracker.reset_tab("tab-a")

        self.assertEqual(0, tracker.status_for("tab-a").profit)
        self.assertEqual(-10, tracker.status_for("tab-b").profit)

    def test_start_reset_discards_previous_run_profit_and_limit(self):
        tracker = LiveRunLimitTracker()
        tracker.reset(["one"])
        tracker.record("one", -100, take_profit=0, stop_loss=100)

        tracker.reset(["one"])

        self.assertEqual(0, tracker.status_for("one").profit)
        self.assertEqual("", tracker.status_for("one").limit_hit)
