from __future__ import annotations

from src.models import BetSide, BetSignal
from src.rules.engine import BaseRule, build_rules


class RuleAnalyzer:
    """Quét các rule theo thứ tự ưu tiên, rule đầu tiên khớp sẽ được áp dụng."""

    def __init__(self, rule_configs: list[dict], default_side: str = "player"):
        self.rules: list[BaseRule] = build_rules(rule_configs)
        self.default_side = BetSide.PLAYER if default_side == "player" else BetSide.BANKER

    def analyze(self, history: list[BetSide]) -> BetSignal | None:
        for rule in self.rules:
            signal = rule.evaluate(history)
            if signal:
                return signal
        return None

    def filter_history(self, history: list[BetSide], skip_tie: bool = True) -> list[BetSide]:
        if skip_tie:
            return [s for s in history if s != BetSide.TIE]
        return list(history)
