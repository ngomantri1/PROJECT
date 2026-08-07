import asyncio
import unittest

from src.ae_sexy_collector import AeSexyCollector
from src.ae_sexy_ws import table_name_to_ids
from src.models import BetSide, TableState


class AeSexyCollectorMajorMinorTests(unittest.TestCase):
    def _collector(self) -> AeSexyCollector:
        collector = AeSexyCollector(TableState(), table_name="Baccarat C01")
        collector.set_in_room(True)
        tid = table_name_to_ids("Baccarat C01")[0]
        collector._last_game_shoe[tid] = 26086
        return collector

    def test_result_uses_locked_pool_for_same_round(self):
        collector = self._collector()
        tid = table_name_to_ids("Baccarat C01")[0]
        collector._pool_by_round[(tid, 26086, 2)] = {
            "game_shoe": 26086,
            "game_round": 2,
            "banker": 200,
            "player": 100,
            "captured_at": 1.0,
        }

        collector._record_major_minor_result(tid, 2, BetSide.PLAYER)

        self.assertEqual("I", collector.major_minor_history("Baccarat C01"))

    def test_same_round_is_not_recorded_twice(self):
        collector = self._collector()
        tid = table_name_to_ids("Baccarat C01")[0]
        collector._pool_by_round[(tid, 26086, 2)] = {
            "game_shoe": 26086,
            "game_round": 2,
            "banker": 100,
            "player": 200,
            "captured_at": 1.0,
        }

        collector._record_major_minor_result(tid, 2, BetSide.PLAYER)
        collector._record_major_minor_result(tid, 2, BetSide.BANKER)

        self.assertEqual("N", collector.major_minor_history("Baccarat C01"))

    def test_history_delta_records_new_round_after_bootstrap(self):
        collector = self._collector()
        tid = table_name_to_ids("Baccarat C01")[0]
        collector.state.history = [BetSide.BANKER]
        collector._pool_by_round[(tid, 26086, 2)] = {
            "game_shoe": 26086,
            "game_round": 2,
            "banker": 100,
            "player": 200,
            "captured_at": 1.0,
        }

        asyncio.run(
            collector._apply_history(
                [BetSide.BANKER, BetSide.PLAYER],
                "http-init-table",
                force=True,
            )
        )

        self.assertEqual("N", collector.major_minor_history("Baccarat C01"))


if __name__ == "__main__":
    unittest.main()
