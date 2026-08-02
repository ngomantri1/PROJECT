"""Deterministic B/P statistical strategies ported from BaccaratChromeAgent2."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from math import exp
from typing import Callable

from src.models import BetSide
from src.strategy_decision import StrategyDecision


@dataclass(frozen=True, slots=True)
class StrategySpec:
    id: str
    label: str
    reference_id: str
    live_eligible: bool = True
    unavailable_reason: str = ""


STATISTICAL_STRATEGIES = (
    StrategySpec("ai_stat_parity", "Bám cầu B/P theo thống kê AI", "ai-stat-cl"),
    StrategySpec("state_transition", "Xu hướng chuyển trạng thái", "state-trans-bias"),
    StrategySpec("run_length", "Run-length", "run-length-bias"),
    StrategySpec("ensemble_majority", "Chuyên gia bỏ phiếu", "ensemble-majority"),
    StrategySpec("time_sliced_hedge", "Lịch chẻ 10 tay", "time-sliced-hedge"),
    StrategySpec("knn_subsequence", "KNN chuỗi con", "knn-subseq"),
    StrategySpec("dual_schedule_hedge", "Lịch hai lớp", "dual-schedule-hedge"),
    StrategySpec("online_ngram", "AI học tại chỗ (n-gram)", "ai-online-ngram"),
    StrategySpec("expert_panel", "Hội đồng Chuyên gia (Top10 + Guard + Regime)", "ai-expert-panel"),
    StrategySpec("top10_pattern", "Top10 tích lũy (khởi từ 50 B/P)", "top10-pattern-follow"),
    StrategySpec("parity_hotback", "Chuỗi cầu B/P hay về", "seq-cl-hotback"),
    StrategySpec(
        "sequence_major_minor", "Chuỗi cầu I/N tự nhập", "seq-ni", False,
        "Collector hiện tại chưa cung cấp pool Banker/Player và chuỗi N/I",
    ),
    StrategySpec(
        "pattern_major_minor", "Thế cầu I/N tự nhập", "pattern-ni", False,
        "Collector hiện tại chưa cung cấp pool Banker/Player và chuỗi N/I",
    ),
)
SPEC_BY_ID = {item.id: item for item in STATISTICAL_STRATEGIES}


def _seq(history: list[BetSide]) -> str:
    return "".join(
        "B" if item == BetSide.BANKER else "P"
        for item in history if item in (BetSide.BANKER, BetSide.PLAYER)
    )


def _opp(value: str) -> str:
    return "P" if value == "B" else "B"


def _ai_stat(seq: str, minimum_support: int = 1) -> tuple[str, float, int, int]:
    if len(seq) <= 1:
        return (seq[-1] if seq else "B"), .5, 0, 0
    for size in range(min(6, len(seq) - 1), 0, -1):
        tail = seq[-size:]
        after = [
            seq[pos + size] for pos in range(len(seq) - size)
            if seq[pos:pos + size] == tail
        ]
        if len(after) < minimum_support:
            continue
        counts = Counter(after)
        if counts["B"] == counts["P"]:
            return after[-1], .5, size, len(after)
        pick = "B" if counts["B"] > counts["P"] else "P"
        return pick, abs(counts["B"] - counts["P"]) / len(after), size, len(after)
    return seq[-1], .5, 0, 0


def _transition(seq: str) -> tuple[str, float]:
    if len(seq) < 2:
        return (seq[-1] if seq else "B"), .5
    recent = seq[-7:]
    same = sum(a == b for a, b in zip(recent, recent[1:]))
    flip = len(recent) - 1 - same
    return (_opp(seq[-1]) if flip > same else seq[-1]), max(same, flip) / max(1, same + flip)


def _run(seq: str) -> tuple[str, int]:
    if not seq:
        return "B", 0
    length = 1
    while length < len(seq) and seq[-length - 1] == seq[-1]:
        length += 1
    return (_opp(seq[-1]) if length >= 3 else seq[-1]), length


def _knn(seq: str) -> tuple[str, int, int]:
    for size in range(min(6, len(seq) - 1), 2, -1):
        tail = seq[-size:]
        b_score = p_score = matches = 0
        for pos in range(len(seq) - size):
            distance = sum(a != b for a, b in zip(seq[pos:pos + size], tail))
            if distance <= 1:
                weight = 2 if distance == 0 else 1
                matches += 1
                if seq[pos + size] == "B":
                    b_score += weight
                else:
                    p_score += weight
        if matches:
            pick = "B" if b_score > p_score else "P" if p_score > b_score else _opp(seq[-1])
            return pick, size, matches
    return (seq[-1] if seq else "B"), 0, 0


def _regime(seq: str) -> tuple[str, float]:
    recent = seq[-10:]
    if len(recent) < 4:
        return "NEUTRAL", .5
    rate = sum(a != b for a, b in zip(recent, recent[1:])) / (len(recent) - 1)
    return ("CHOP" if rate >= .67 else "TREND" if rate <= .33 else "NEUTRAL"), rate


def _experts() -> tuple[tuple[str, float, Callable[[str], str]], ...]:
    return (
        ("ExactMatch", 1.30, lambda value: _ai_stat(value, 3)[0]),
        ("Transition", 1.05, lambda value: _transition(value)[0]),
        ("RunLength", 1.00, lambda value: _run(value)[0]),
        ("FollowLast", .90, lambda value: value[-1] if value else "B"),
        ("OppLast", .90, lambda value: _opp(value[-1]) if value else "P"),
    )


def _ensemble(seq: str) -> tuple[str, float, str]:
    regime, flip_rate = _regime(seq)
    votes = {"B": 0.0, "P": 0.0}
    exact_pick = "B"
    for name, base, predictor in _experts():
        score = sum(predictor(seq[:pos]) == seq[pos] for pos in range(1, len(seq)))
        count = max(0, len(seq) - 1)
        perf = 1.0 if count < 8 else min(1.9, max(.4, 1 + (score - count / 2) * .18))
        weights = (
            {"RunLength": 1.25, "FollowLast": 1.25, "Transition": .85, "OppLast": .75}
            if regime == "TREND" else
            {"Transition": 1.25, "OppLast": 1.25, "RunLength": .8, "FollowLast": .75}
            if regime == "CHOP" else {}
        )
        pick = predictor(seq)
        exact_pick = pick if name == "ExactMatch" else exact_pick
        votes[pick] += base * perf * weights.get(name, 1.0)
    pick = exact_pick if abs(votes["B"] - votes["P"]) < .1 else ("B" if votes["B"] > votes["P"] else "P")
    confidence = abs(votes["B"] - votes["P"]) / max(.001, votes["B"] + votes["P"])
    return pick, confidence, f"{regime}; flip={flip_rate:.2f}; B={votes['B']:.2f}; P={votes['P']:.2f}"


def _ngram(seq: str) -> tuple[str, float, int, int]:
    for size in range(min(6, len(seq)), 0, -1):
        tail = seq[-size:]
        after = [
            seq[pos + size] for pos in range(max(0, len(seq) - 51), len(seq) - size)
            if seq[pos:pos + size] == tail
        ]
        if len(after) >= 3:
            probability_b = (after.count("B") + 1) / (len(after) + 2)
            confidence = min(1.0, abs(probability_b - .5) * 2) * (1 - exp(-len(after) / 12))
            return ("B" if probability_b >= .5 else "P"), confidence, size, len(after)
    return (seq[-1] if seq else "B"), 0.0, 0, 0


def _top10(seq: str) -> tuple[str, str, int]:
    recent = seq[-50:]
    if len(recent) < 10:
        return (recent[-1] if recent else "B"), "", 0
    windows = Counter(recent[pos:pos + 10] for pos in range(len(recent) - 9))
    count = max(windows.values())
    pattern = next(
        recent[pos:pos + 10] for pos in range(len(recent) - 10, -1, -1)
        if windows[recent[pos:pos + 10]] == count
    )
    return pattern[len(seq) % 10], pattern, count


def _hotback(seq: str) -> tuple[str, str, int]:
    candidates = {format(value, "05b").translate(str.maketrans("01", "BP")): 0 for value in range(32)}
    recent = seq[-52:]
    for pos in range(max(0, len(recent) - 4)):
        window = recent[pos:pos + 5]
        candidates[window] = candidates.get(window, 0) + 1
        candidates.pop("".join(_opp(char) for char in window), None)
    if not candidates:
        return seq[-1], "", 0
    count = max(candidates.values())
    # Stable lexical tie-break is required for repeatable replay/shadow.
    pattern = min(key for key, value in candidates.items() if value == count)
    return pattern[len(seq) % 5], pattern, count


def evaluate_statistical_strategy(strategy_id: str, history: list[BetSide]) -> StrategyDecision:
    spec = SPEC_BY_ID[strategy_id]
    seq = _seq(history)
    if not spec.live_eligible:
        return StrategyDecision.skip(
            strategy_id=strategy_id, strategy_name=spec.label,
            reason=spec.unavailable_reason, history_size=len(history),
            metadata={"live_eligible": False, "reference_id": spec.reference_id},
        )
    if not seq:
        return StrategyDecision.skip(
            strategy_id=strategy_id, strategy_name=spec.label,
            reason="Chưa có kết quả Banker/Player", history_size=len(history),
        )

    metadata: dict[str, object] = {
        "live_eligible": True, "reference_id": spec.reference_id,
    }
    if strategy_id == "ai_stat_parity":
        pick, confidence, size, support = _ai_stat(seq)
        reason = f"Khớp hậu tố k={size}, support={support}"
    elif strategy_id == "state_transition":
        pick, confidence = _transition(seq)
        reason = "Đếm same/flip trong 6 chuyển trạng thái gần nhất"
    elif strategy_id == "run_length":
        pick, length = _run(seq)
        confidence, reason = min(.9, .5 + length * .05), f"Độ dài dây={length}; đảo khi >= 3"
    elif strategy_id in ("ensemble_majority", "expert_panel"):
        pick, confidence, reason = _ensemble(seq)
        if strategy_id == "expert_panel":
            metadata["reference_note"] = "Top10 provider trong bản C# là mock/glue"
    elif strategy_id == "time_sliced_hedge":
        position = len(seq) % 10
        pick = seq[-1] if position < 5 else _opp(seq[-1])
        confidence, reason = .5, f"Lịch 10 tay, vị trí={position + 1}"
    elif strategy_id == "knn_subsequence":
        pick, size, matches = _knn(seq)
        confidence, reason = min(.9, .5 + matches * .05), f"KNN k={size}, matches={matches}"
    elif strategy_id == "dual_schedule_hedge":
        position = len(seq) % 10
        pick = (
            seq[-1] if position in (0, 1, 2, 4, 5, 6, 8)
            else _opp(seq[-1]) if position in (3, 7)
            else _ai_stat(seq)[0]
        )
        confidence, reason = .5, f"Lịch hai lớp, vị trí={position + 1}"
    elif strategy_id == "online_ngram":
        pick, confidence, size, support = _ngram(seq)
        reason = f"N-gram k={size}, support={support}"
    elif strategy_id == "top10_pattern":
        pick, pattern, count = _top10(seq)
        confidence, reason = min(.9, .5 + count * .03), f"Top10='{pattern or '-'}', count={count}"
    elif strategy_id == "parity_hotback":
        pick, pattern, count = _hotback(seq)
        confidence, reason = min(.9, .5 + count * .03), f"Hot-back='{pattern or '-'}', count={count}"
        metadata["deterministic_tie_break"] = True
    else:
        raise KeyError(strategy_id)
    return StrategyDecision.bet(
        strategy_id=strategy_id, strategy_name=spec.label,
        side=BetSide.BANKER if pick == "B" else BetSide.PLAYER,
        reason=reason, confidence=max(0.0, min(1.0, confidence)),
        history_size=len(history), signal_id=strategy_id, metadata=metadata,
    )
