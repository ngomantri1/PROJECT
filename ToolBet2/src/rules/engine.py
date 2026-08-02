from __future__ import annotations

from abc import ABC, abstractmethod

from src.models import BetSide, BetSignal


class BaseRule(ABC):
    def __init__(self, name: str, enabled: bool = True):
        self.name = name
        self.enabled = enabled

    @abstractmethod
    def evaluate(self, history: list[BetSide]) -> BetSignal | None:
        """Trả về tín hiệu cược nếu rule khớp, ngược lại None."""


class StreakRule(BaseRule):
    """Bệt: N ván liên tiếp cùng cửa (xanh hoặc đỏ)."""

    def __init__(
        self,
        name: str,
        min_streak: int,
        side: str = "any",
        bet_side: str = "follow",
        enabled: bool = True,
    ):
        super().__init__(name, enabled)
        self.min_streak = min_streak
        self.side = side
        self.bet_side = bet_side

    def evaluate(self, history: list[BetSide]) -> BetSignal | None:
        if not self.enabled or len(history) < self.min_streak:
            return None

        recent = history[-self.min_streak :]
        if any(s == BetSide.TIE for s in recent):
            return None

        first = recent[0]
        if not all(s == first for s in recent):
            return None

        if self.side != "any":
            expected = BetSide.PLAYER if self.side == "player" else BetSide.BANKER
            if first != expected:
                return None

        if self.bet_side == "follow":
            target = first
        elif self.bet_side == "player":
            target = BetSide.PLAYER
        else:
            target = BetSide.BANKER

        label = "xanh" if first == BetSide.PLAYER else "đỏ"
        return BetSignal(
            side=target,
            stake=0,
            rule_name=self.name,
            reason=f"Bệt {self.min_streak} lần {label} → đánh {'xanh' if target == BetSide.PLAYER else 'đỏ'}",
        )


class AlternatingRule(BaseRule):
    """Chuyền: xen kẽ xanh-đỏ (hoặc đỏ-xanh) đủ N cặp."""

    def __init__(
        self,
        name: str,
        min_pairs: int,
        start_side: str = "player",
        bet_side: str = "player",
        enabled: bool = True,
    ):
        super().__init__(name, enabled)
        self.min_pairs = min_pairs
        self.start_side = BetSide.PLAYER if start_side == "player" else BetSide.BANKER
        self.bet_side = BetSide.PLAYER if bet_side == "player" else BetSide.BANKER

    def evaluate(self, history: list[BetSide]) -> BetSignal | None:
        needed = self.min_pairs * 2
        if not self.enabled or len(history) < needed:
            return None

        recent = history[-needed:]
        if any(s == BetSide.TIE for s in recent):
            return None

        other = BetSide.BANKER if self.start_side == BetSide.PLAYER else BetSide.PLAYER
        expected = [
            self.start_side if i % 2 == 0 else other for i in range(needed)
        ]

        if recent != expected:
            return None

        target_label = "xanh" if self.bet_side == BetSide.PLAYER else "đỏ"
        return BetSignal(
            side=self.bet_side,
            stake=0,
            rule_name=self.name,
            reason=f"Chuyền {self.min_pairs} cặp xanh-đỏ xen kẽ → đánh {target_label}",
        )


def build_rules(rule_configs: list[dict]) -> list[BaseRule]:
    rules: list[BaseRule] = []
    for cfg in rule_configs:
        if not cfg.get("enabled", True):
            continue
        rtype = cfg.get("type", "")
        if rtype == "streak":
            rules.append(
                StreakRule(
                    name=cfg.get("name", "streak"),
                    min_streak=cfg.get("min_streak", 3),
                    side=cfg.get("side", "any"),
                    bet_side=cfg.get("bet_side", "follow"),
                    enabled=True,
                )
            )
        elif rtype == "alternating":
            rules.append(
                AlternatingRule(
                    name=cfg.get("name", "alternating"),
                    min_pairs=cfg.get("min_pairs", 2),
                    start_side=cfg.get("start_side", "player"),
                    bet_side=cfg.get("bet_side", "player"),
                    enabled=True,
                )
            )
    return rules
