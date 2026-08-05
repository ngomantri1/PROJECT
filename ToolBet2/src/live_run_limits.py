"""Process-local take-profit and stop-loss tracking for Live strategy tabs."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class LiveRunLimitStatus:
    profit: float = 0.0
    limit_hit: str = ""


class LiveRunLimitTracker:
    """Keep each Live tab's net profit isolated to one explicit run.

    This deliberately has no database dependency: historical SQLite P&L and
    MoneyManager progression must not decide the operator's current run limit.
    """

    def __init__(self) -> None:
        self._status_by_tab: dict[str, LiveRunLimitStatus] = {}

    def reset(self, tab_ids: list[str]) -> None:
        self._status_by_tab = {
            str(tab_id): LiveRunLimitStatus() for tab_id in tab_ids if tab_id
        }

    def reset_tab(self, tab_id: str) -> None:
        """Clear only one tab after its auto-reset-to-first-stake condition."""
        if tab_id:
            self._status_by_tab[str(tab_id)] = LiveRunLimitStatus()

    def status_for(self, tab_id: str) -> LiveRunLimitStatus:
        return self._status_by_tab.get(str(tab_id), LiveRunLimitStatus())

    def record(
        self,
        tab_id: str,
        profit: float,
        *,
        take_profit: float,
        stop_loss: float,
    ) -> LiveRunLimitStatus:
        previous = self.status_for(tab_id)
        total = previous.profit + float(profit)
        limit_hit = previous.limit_hit
        if not limit_hit:
            if take_profit > 0 and total >= float(take_profit):
                limit_hit = "take_profit"
            elif stop_loss > 0 and total <= -float(stop_loss):
                limit_hit = "stop_loss"
        status = LiveRunLimitStatus(profit=total, limit_hit=limit_hit)
        self._status_by_tab[str(tab_id)] = status
        return status
