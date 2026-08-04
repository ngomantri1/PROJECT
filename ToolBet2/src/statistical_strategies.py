"""Deterministic B/P statistical strategies ported from BaccaratChromeAgent2."""

from __future__ import annotations

from collections import Counter, deque
from dataclasses import dataclass, field
from math import exp
from random import Random

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
    StrategySpec("sequence_follow", "Chuỗi B/P tự nhập", "seq-parity"),
    StrategySpec("pattern_follow", "Thế cầu B/P tự nhập", "pattern-cl"),
    StrategySpec("random_side", "Cửa B/P ngẫu nhiên", "random-cl"),
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
SCHEDULE_STRATEGY_IDS = frozenset({"time_sliced_hedge", "dual_schedule_hedge"})
STATEFUL_STRATEGY_IDS = frozenset({
    "sequence_follow", "pattern_follow", "random_side",
    "ensemble_majority", "online_ngram", "expert_panel",
    "top10_pattern", "parity_hotback",
})


@dataclass(slots=True)
class Top10PatternRuntime:
    counts: dict[str, tuple[int, int]] = field(default_factory=dict)
    tick: int = 0
    last_seen_cl50: str = ""
    pattern: str = ""
    pattern_count: int = 0
    pattern_index: int = 0


@dataclass(slots=True)
class ParityHotbackRuntime:
    candidates: dict[str, int] | None = None
    pattern: str = ""
    pattern_index: int = 0
    random: Random = field(default_factory=Random)


@dataclass(slots=True)
class EnsembleExpertRuntime:
    name: str
    base_weight: float
    recent: deque[int] = field(default_factory=deque)

    @property
    def score(self) -> int:
        return sum(self.recent)


@dataclass(slots=True)
class EnsembleRuntime:
    experts: list[EnsembleExpertRuntime] = field(default_factory=list)
    last_picks: dict[str, str] = field(default_factory=dict)


@dataclass(slots=True)
class OnlineNgramRuntime:
    tables: list[dict[int, tuple[float, float]]] = field(
        default_factory=lambda: [{} for _ in range(7)]
    )
    random: Random = field(default_factory=Random)
    last_pre_seq: str = ""
    last_undecidable: bool = False
    loss_streak: int = 0
    safety_escalations: int = 0
    in_episode: bool = False
    did_escalate_s5: bool = False
    did_escalate_s8: bool = False
    safety_hold_left: int = 0
    safe_rounds: int = 0
    safe_cooldown_left: int = 0
    undecidable_window: deque[bool] = field(default_factory=deque)


@dataclass(slots=True)
class ExpertPanelRuntime:
    random: Random = field(default_factory=Random)
    win_streak: int = 0
    loss_streak: int = 0
    max_loss_streak: int = 0
    ewma: float = .5
    loss_guard_on: bool = False
    hard_guard_on: bool = False
    hard_guard_age: int = 0
    hard_guard_consecutive_wins: int = 0
    beauty_cooldown: int = 0
    last_panel_pick: str = ""


@dataclass(slots=True)
class SequenceFollowRuntime:
    sequence: str
    index: int = 0


@dataclass(slots=True)
class PatternFollowRuntime:
    patterns: list[tuple[str, str]]
    planned: deque[str] = field(default_factory=deque)


@dataclass(slots=True)
class RandomSideRuntime:
    random: Random = field(default_factory=Random)
    planned: str = ""


def _seq(history: list[BetSide]) -> str:
    return "".join(
        "B" if item == BetSide.BANKER else "P"
        for item in history if item in (BetSide.BANKER, BetSide.PLAYER)
    )


def _opp(value: str) -> str:
    return "P" if value == "B" else "B"


def _bp_chars(value: str) -> str:
    return "".join(char for char in str(value or "").upper() if char in "BP")


def _pattern_pairs(value: str) -> list[tuple[str, str]]:
    normalized = (
        str(value or "").replace("->", "-").replace("→", "-")
        .replace("–", "-").replace("—", "-").upper().replace(" ", "")
    )
    pairs: list[tuple[str, str]] = []
    for part in normalized.replace("\r", "\n").replace(";", "\n").replace("|", "\n").replace(",", "\n").split("\n"):
        fields = [field for field in part.split("-") if field]
        if len(fields) != 2:
            continue
        lhs, rhs = _bp_chars(fields[0]), _bp_chars(fields[1])
        if lhs and rhs:
            pairs.append((lhs, rhs))
    return sorted(pairs, key=lambda item: len(item[0]), reverse=True)


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


def _dual_schedule_ai_stat_mini(seq: str) -> str:
    """Match DualScheduleHedgeTask.AiStatMini, including its tie-break."""

    if len(seq) <= 1:
        return seq[-1] if seq else "B"
    for size in range(min(6, len(seq) - 1), 0, -1):
        tail = seq[-size:]
        after = [
            seq[pos + size]
            for pos in range(len(seq) - size)
            if seq[pos:pos + size] == tail
        ]
        if not after:
            continue
        counts = Counter(after)
        if counts["B"] > counts["P"]:
            return "B"
        if counts["P"] > counts["B"]:
            return "P"
        return _opp(seq[-1])
    return seq[-1]


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


def _ensemble_regime(seq: str) -> tuple[str, float]:
    recent = seq[-10:]
    if len(recent) < 4:
        return "NEUTRAL", .5
    flip_rate = sum(a != b for a, b in zip(recent, recent[1:])) / (len(recent) - 1)
    if flip_rate >= .67:
        return "CHOP", flip_rate
    if flip_rate <= .33:
        return "TREND", flip_rate
    return "NEUTRAL", flip_rate


def _ensemble_predict(name: str, seq: str) -> str:
    if name == "ExactMatch":
        for size in range(min(6, len(seq) - 1), 0, -1):
            tail = seq[-size:]
            following = [
                seq[index + size] for index in range(len(seq) - size)
                if seq[index:index + size] == tail
            ]
            if len(following) < 3:
                continue
            banker, player = following.count("B"), following.count("P")
            if banker > player:
                return "B"
            if player > banker:
                return "P"
            return _opp(seq[-1])
        return seq[-1] if seq else "B"
    if name == "Transition":
        return _transition(seq)[0]
    if name == "RunLength":
        return _run(seq)[0]
    if name == "FollowLast":
        return seq[-1] if seq else "B"
    return _opp(seq[-1]) if seq else "P"


def _ensemble_regime_weight(regime: str, name: str) -> float:
    if regime == "TREND":
        return {"RunLength": 1.25, "FollowLast": 1.25, "Transition": .85, "OppLast": .75}.get(name, 1.0)
    if regime == "CHOP":
        return {"Transition": 1.25, "OppLast": 1.25, "RunLength": .8, "FollowLast": .75}.get(name, 1.0)
    return 1.0


def _ensemble_decision(runtime: EnsembleRuntime, seq: str) -> tuple[str, float, str]:
    regime, flip_rate = _ensemble_regime(seq)
    vote_b = vote_p = 0.0
    decisions: list[tuple[EnsembleExpertRuntime, str, float]] = []
    for expert in runtime.experts:
        pick = _ensemble_predict(expert.name, seq)
        count = len(expert.recent)
        perf = 1.0 if count < 5 else min(1.9, max(.4, 1 + (expert.score - count / 2) * .18))
        weight = expert.base_weight * perf * _ensemble_regime_weight(regime, expert.name)
        decisions.append((expert, pick, weight))
        if pick == "B":
            vote_b += weight
        else:
            vote_p += weight
    tie_break = abs(vote_b - vote_p) < .20
    if tie_break:
        exact = next((pick for expert, pick, _weight in decisions if expert.name == "ExactMatch"), None)
        pick = exact or (seq[-1] if seq else "B")
    else:
        pick = "B" if vote_b > vote_p else "P"
    runtime.last_picks = {expert.name: expert_pick for expert, expert_pick, _ in decisions}
    reason = f"{regime}; flip={flip_rate:.2f}; B={vote_b:.2f}; P={vote_p:.2f}"
    if tie_break:
        reason += "; tie-break=ExactMatch"
    return pick, abs(vote_b - vote_p) / max(.001, vote_b + vote_p), reason


def _ngram_key(seq: str, size: int) -> int:
    key = 0
    for value in seq[-size:]:
        key = (key << 1) | (value == "P")
    return key


def _ngram_update(runtime: OnlineNgramRuntime, pre_seq: str, actual: str) -> None:
    for size in range(1, min(6, len(pre_seq)) + 1):
        key = _ngram_key(pre_seq, size)
        banker, player = runtime.tables[size].get(key, (0.0, 0.0))
        if actual == "B":
            banker += 1.0
        else:
            player += 1.0
        if banker + player >= 600:
            banker *= .5
            player *= .5
        runtime.tables[size][key] = banker, player


def _ngram_warm(runtime: OnlineNgramRuntime, seq: str) -> None:
    for index in range(max(1, len(seq) - 50), len(seq)):
        _ngram_update(runtime, seq[:index], seq[index])


def _ngram_effective(runtime: OnlineNgramRuntime) -> tuple[float, float, int, int]:
    use_s8 = runtime.did_escalate_s8 or runtime.loss_streak >= 8
    use_s5 = not use_s8 and (runtime.did_escalate_s5 or runtime.loss_streak >= 4)
    if not (use_s5 or use_s8):
        return .02, .58, 3, 6
    escalation = runtime.safety_escalations
    cap_tie, cap_conf, min_support, k_cap = (
        (.10, .72, 5, 4) if use_s8 else (.05, .62, 4, 5)
    )
    factor = 1 - exp(-escalation / 4)
    return (
        .02 + (cap_tie - .02) * factor,
        .58 + (cap_conf - .58) * factor,
        min_support,
        max(k_cap, round(6 - (6 - k_cap) * factor)),
    )


def _online_ngram_decision(runtime: OnlineNgramRuntime, seq: str) -> tuple[str, float, int, int, bool]:
    tie_band, min_confidence, min_support, max_k = _ngram_effective(runtime)
    score = confidence = 0.0
    used_k = support = 0
    for size in range(min(max_k, len(seq), 6), 0, -1):
        banker, player = runtime.tables[size].get(_ngram_key(seq, size), (0.0, 0.0))
        candidate_support = int(banker + player)
        if candidate_support >= min_support:
            used_k, support = size, candidate_support
            score = (banker + 1) / (support + 2) - .5
            confidence = min(1.0, abs(score) * 2) * (1 - exp(-support / 12))
            break
    undecidable = (
        used_k == 0 or support < min_support or abs(score) < tie_band
        or confidence < min_confidence
    )
    runtime.last_pre_seq = seq
    runtime.last_undecidable = undecidable
    pick = runtime.random.choice(("B", "P")) if undecidable else ("B" if score >= 0 else "P")
    return pick, confidence, used_k, support, undecidable


def _expert_panel_regime(seq: str, runtime: ExpertPanelRuntime) -> str:
    recent12 = seq[-12:]
    majority_diff = abs(recent12.count("B") - recent12.count("P")) / max(1, len(recent12))
    recent8 = seq[-8:]
    zigzag = len(recent8) >= 6 and sum(a != b for a, b in zip(recent8, recent8[1:])) >= len(recent8) - 2
    if majority_diff <= .10 and zigzag:
        return "ZIGZAG"
    if runtime.win_streak >= 3 or runtime.loss_streak >= 3 or majority_diff >= .40:
        return "STREAK"
    if majority_diff >= .20:
        return "DRIFT"
    return "CHAOTIC"


def _expert_panel_votes(seq: str, runtime: ExpertPanelRuntime, regime: str) -> list[tuple[str, str, float, str]]:
    last = seq[-1] if seq else "B"
    majority = "P" if seq.count("P") >= seq.count("B") else "B"
    run_pick = last if runtime.win_streak >= runtime.loss_streak else _opp(last)
    zig_conf = {"ZIGZAG": (.66, .67, .68)}.get(regime, (.57, .57, .57))
    return [
        ("Maj", majority, .60, "Majority"),
        ("EWMA", "P" if runtime.ewma >= .5 else "B", .60 + abs(runtime.ewma - .5), "FollowTrend"),
        ("Run", run_pick, .58 + .02 * max(runtime.win_streak, runtime.loss_streak), "FollowRun"),
        ("Prev", last, .56, "FollowPrev"),
        ("Flip", _opp(last), .54, "FlipPrev"),
        ("Zig16", _opp(last), zig_conf[0], "ZigFollow16"),
        ("Zig20", _opp(last), zig_conf[1], "ZigFollow20"),
        ("Zig24", _opp(last), zig_conf[2], "ZigFollow24"),
        ("AntiMaj", _opp(majority), .53, "AntiMajority"),
        ("Noise", "P" if (9 + (last == "P")) % 2 else "B", .50, "Noise"),
    ]


def _expert_panel_blocks(seq: str) -> tuple[int, str, int, str, int, str]:
    if not seq:
        return 0, "", 0, "", 0, ""
    blocks: list[tuple[int, str]] = []
    index = len(seq) - 1
    while index >= 0 and len(blocks) < 3:
        side, length = seq[index], 0
        while index >= 0 and seq[index] == side:
            length += 1
            index -= 1
        blocks.append((length, side))
    blocks.extend([(0, "")] * (3 - len(blocks)))
    current, previous, previous2 = blocks[0], blocks[1], blocks[2]
    return current[0], current[1], previous[0], previous[1], previous2[0], previous2[1]


def _expert_panel_fallback(seq: str, regime: str, runtime: ExpertPanelRuntime) -> str:
    last = seq[-1] if seq else runtime.random.choice(("B", "P"))
    return _opp(last) if regime == "ZIGZAG" else last


def _expert_panel_decision(runtime: ExpertPanelRuntime, seq: str) -> tuple[str, float, str]:
    regime = _expert_panel_regime(seq, runtime)
    votes = _expert_panel_votes(seq, runtime, regime)
    banker_votes = sum(pick == "B" for _name, pick, _confidence, _plan in votes)
    player_votes = len(votes) - banker_votes
    margin = abs(banker_votes - player_votes)
    average_confidence = sum(confidence for _name, _pick, confidence, _plan in votes) / len(votes)
    majority_diff = abs(seq[-12:].count("B") - seq[-12:].count("P")) / max(1, len(seq[-12:]))
    dynamic_trigger = 3 if majority_diff <= .05 else 4
    if runtime.loss_streak + 1 >= dynamic_trigger:
        runtime.loss_guard_on = True
    if runtime.loss_streak == 0 and runtime.win_streak >= 2:
        runtime.loss_guard_on = False
    if not runtime.hard_guard_on and runtime.loss_streak >= 4:
        runtime.hard_guard_on = True
        runtime.hard_guard_age = runtime.hard_guard_consecutive_wins = 0
    current_len, current_side, previous_len, previous_side, older_len, _older_side = _expert_panel_blocks(seq)
    candidate = ""
    candidate_side = ""
    if all(1 <= value <= 4 for value in (older_len, previous_len, current_len)) and older_len == current_len:
        candidate, candidate_side = "PAT", previous_side
    elif current_len >= 3:
        candidate, candidate_side = "STREAK", current_side
    guarded = runtime.hard_guard_on or runtime.loss_guard_on
    if candidate and runtime.beauty_cooldown == 0 and ((not guarded and margin <= 3)):
        panel_pick, reason = candidate_side, f"{regime}; beauty={candidate}"
        runtime.beauty_cooldown = 3
    elif runtime.hard_guard_on:
        if margin >= 4 and average_confidence >= .65:
            panel_pick, reason = ("B" if banker_votes > player_votes else "P"), f"{regime}; hard-guard majority"
        else:
            panel_pick, reason = _expert_panel_fallback(seq, regime, runtime), f"{regime}; hard-guard fallback"
    elif runtime.loss_guard_on:
        if margin >= 3 and average_confidence >= .62:
            panel_pick, reason = ("B" if banker_votes > player_votes else "P"), f"{regime}; loss-guard majority"
        else:
            panel_pick, reason = _expert_panel_fallback(seq, regime, runtime), f"{regime}; loss-guard fallback"
    elif (banker_votes >= 6 or player_votes >= 6) and average_confidence >= .62:
        panel_pick, reason = ("B" if banker_votes > player_votes else "P"), f"{regime}; majority"
    elif banker_votes == player_votes:
        panel_pick, reason = runtime.random.choice(("B", "P")), f"{regime}; random tie"
    else:
        panel_pick, reason = _expert_panel_fallback(seq, regime, runtime), f"{regime}; fallback"
    runtime.last_panel_pick = panel_pick
    # The reference task is contrarian by default: place the opposite panel pick.
    return _opp(panel_pick), abs(banker_votes - player_votes) / len(votes), reason


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


def _top10_add(runtime: Top10PatternRuntime, pattern: str) -> None:
    count, _last_tick = runtime.counts.get(pattern, (0, 0))
    runtime.tick += 1
    runtime.counts[pattern] = (count + 1, runtime.tick)


def _top10_best(runtime: Top10PatternRuntime) -> tuple[str, int]:
    if not runtime.counts:
        return "", 0
    pattern, (count, _tick) = max(
        runtime.counts.items(), key=lambda item: (item[1][0], item[1][1])
    )
    return pattern, count


def _build_top10_runtime(seq: str) -> Top10PatternRuntime:
    runtime = Top10PatternRuntime()
    cl50 = seq[-50:]
    # The C# task counts newest windows first, including its short-history
    # fallback used before the collector has a complete 50-result frame.
    for start in range(len(cl50) - 10, -1, -1):
        _top10_add(runtime, cl50[start:start + 10])
    runtime.last_seen_cl50 = cl50
    runtime.pattern, runtime.pattern_count = _top10_best(runtime)
    return runtime


def _all_hotback_patterns() -> dict[str, int]:
    return {
        format(value, "05b").translate(str.maketrans("01", "BP")): 0
        for value in range(32)
    }


def _flip(pattern: str) -> str:
    return "".join(_opp(value) for value in pattern)


def _hotback_candidates(seq: str) -> dict[str, int]:
    candidates = _all_hotback_patterns()
    recent = seq[-52:]
    # C# walks newest-to-oldest after reversing, which yields this equivalent
    # chronological window set while retaining the same counts/removals.
    for start in range(len(recent) - 5, -1, -1):
        pattern = recent[start:start + 5]
        if pattern in candidates:
            candidates[pattern] += 1
        candidates.pop(_flip(pattern), None)
    return candidates


def _latest_hotback_window(seq: str) -> tuple[str, str] | None:
    recent = seq[-52:]
    if len(recent) < 5:
        return None
    pattern = recent[-5:]
    return pattern, _flip(pattern)


def create_statistical_runtime(
    strategy_id: str, history: list[BetSide], *, seed: str = "", strategy_input: str = ""
) -> SequenceFollowRuntime | PatternFollowRuntime | RandomSideRuntime | EnsembleRuntime | OnlineNgramRuntime | ExpertPanelRuntime | Top10PatternRuntime | ParityHotbackRuntime | None:
    """Create the state a C# task keeps for one live strategy-tab instance."""

    seq = _seq(history)
    if strategy_id == "sequence_follow":
        return SequenceFollowRuntime(sequence=_bp_chars(strategy_input))
    if strategy_id == "pattern_follow":
        return PatternFollowRuntime(patterns=_pattern_pairs(strategy_input))
    if strategy_id == "random_side":
        return RandomSideRuntime(random=Random(seed))
    if strategy_id == "ensemble_majority":
        return EnsembleRuntime(experts=[
            EnsembleExpertRuntime("ExactMatch", 1.30),
            EnsembleExpertRuntime("Transition", 1.05),
            EnsembleExpertRuntime("RunLength", 1.00),
            EnsembleExpertRuntime("FollowLast", .90),
            EnsembleExpertRuntime("OppLast", .90),
        ])
    if strategy_id == "online_ngram":
        runtime = OnlineNgramRuntime(random=Random(seed))
        _ngram_warm(runtime, seq)
        return runtime
    if strategy_id == "expert_panel":
        return ExpertPanelRuntime(random=Random(seed))
    if strategy_id == "top10_pattern":
        return _build_top10_runtime(seq)
    if strategy_id == "parity_hotback":
        return ParityHotbackRuntime(random=Random(seed))
    return None


def _top10_runtime_decision(runtime: Top10PatternRuntime, seq: str) -> tuple[str, str, int]:
    if not runtime.pattern:
        runtime.pattern, runtime.pattern_count = _top10_best(runtime)
        runtime.pattern_index = 0
    if not runtime.pattern:
        return (seq[-1] if seq else "B"), "", 0
    return runtime.pattern[runtime.pattern_index], runtime.pattern, runtime.pattern_count


def _hotback_runtime_decision(runtime: ParityHotbackRuntime, seq: str) -> tuple[str, str, int]:
    if runtime.pattern and runtime.pattern_index < 5:
        return runtime.pattern[runtime.pattern_index], runtime.pattern, (
            (runtime.candidates or {}).get(runtime.pattern, 0)
        )
    if runtime.candidates is None:
        runtime.candidates = _hotback_candidates(seq)
    if not runtime.candidates:
        runtime.candidates = _all_hotback_patterns()
    highest = max(runtime.candidates.values())
    options = [
        pattern for pattern, count in runtime.candidates.items() if count == highest
    ]
    runtime.pattern = runtime.random.choice(options)
    runtime.pattern_index = 0
    return runtime.pattern[0], runtime.pattern, highest


def advance_statistical_runtime(
    strategy_id: str,
    runtime: SequenceFollowRuntime | PatternFollowRuntime | RandomSideRuntime | EnsembleRuntime | OnlineNgramRuntime | ExpertPanelRuntime | Top10PatternRuntime | ParityHotbackRuntime,
    history: list[BetSide],
    *,
    won: bool | None,
) -> None:
    """Apply exactly one settled task result to a per-tab runtime state."""

    seq = _seq(history)
    if strategy_id == "sequence_follow" and isinstance(runtime, SequenceFollowRuntime):
        if runtime.sequence:
            runtime.index = (runtime.index + 1) % len(runtime.sequence)
        return
    if strategy_id == "pattern_follow" and isinstance(runtime, PatternFollowRuntime):
        if runtime.planned:
            runtime.planned.popleft()
        return
    if strategy_id == "random_side" and isinstance(runtime, RandomSideRuntime):
        runtime.planned = ""
        return
    if strategy_id == "ensemble_majority" and isinstance(runtime, EnsembleRuntime):
        if won is not None and seq:
            actual = seq[-1]
            for expert in runtime.experts:
                if expert.name in runtime.last_picks:
                    expert.recent.append(int(runtime.last_picks[expert.name] == actual))
                    while len(expert.recent) > 10:
                        expert.recent.popleft()
        return
    if strategy_id == "online_ngram" and isinstance(runtime, OnlineNgramRuntime):
        undecidable = runtime.last_undecidable
        if won is not None and len(seq) >= len(runtime.last_pre_seq) + 1:
            _ngram_update(runtime, runtime.last_pre_seq, seq[-1])
        runtime.undecidable_window.append(undecidable)
        while len(runtime.undecidable_window) > 50:
            runtime.undecidable_window.popleft()
        # The C# task records the undecidable bit for a Tie/Push, then leaves
        # loss streak, safety hold and auto-decay state unchanged.
        if won is None:
            return
        if won is True:
            runtime.loss_streak = 0
            if runtime.safety_hold_left > 0:
                runtime.safety_hold_left -= 1
                if runtime.safety_hold_left == 0:
                    runtime.in_episode = runtime.did_escalate_s5 = runtime.did_escalate_s8 = False
        elif won is False:
            runtime.loss_streak += 1
            if runtime.loss_streak >= 4:
                if not runtime.in_episode:
                    runtime.in_episode = True
                    runtime.did_escalate_s5 = runtime.did_escalate_s8 = False
                if not runtime.did_escalate_s5:
                    runtime.safety_escalations += 1
                    runtime.did_escalate_s5 = True
                    runtime.safety_hold_left = max(runtime.safety_hold_left, 3)
                if runtime.loss_streak >= 8 and not runtime.did_escalate_s8:
                    runtime.safety_escalations += 1
                    runtime.did_escalate_s8 = True
                    runtime.safety_hold_left = max(runtime.safety_hold_left, 4)
        if not runtime.in_episode and runtime.loss_streak <= 1:
            if runtime.safe_cooldown_left:
                runtime.safe_cooldown_left -= 1
            else:
                runtime.safe_rounds += 1
        else:
            runtime.safe_rounds = 0
        if (
            runtime.safe_rounds >= 30 and runtime.safety_escalations > 0
            and sum(runtime.undecidable_window) / max(1, len(runtime.undecidable_window)) <= .30
        ):
            runtime.safety_escalations -= 1
            runtime.safe_rounds = 0
            runtime.safe_cooldown_left = 10
        return
    if strategy_id == "expert_panel" and isinstance(runtime, ExpertPanelRuntime):
        if won is None:
            return
        actual = seq[-1] if seq else ""
        training_win = runtime.last_panel_pick == actual
        if training_win:
            runtime.win_streak += 1
            runtime.loss_streak = 0
            if runtime.hard_guard_on:
                runtime.hard_guard_consecutive_wins += 1
        else:
            runtime.loss_streak += 1
            runtime.max_loss_streak = max(runtime.max_loss_streak, runtime.loss_streak)
            runtime.win_streak = runtime.hard_guard_consecutive_wins = 0
        runtime.ewma = .30 * float(training_win) + .70 * runtime.ewma
        if runtime.beauty_cooldown:
            runtime.beauty_cooldown -= 1
        win_rate20 = max(seq[-20:].count("B"), seq[-20:].count("P")) / max(1, len(seq[-20:]))
        if runtime.hard_guard_on:
            runtime.hard_guard_age += 1
            if runtime.hard_guard_consecutive_wins >= 3 or win_rate20 > .58:
                runtime.hard_guard_on = False
                runtime.hard_guard_age = runtime.hard_guard_consecutive_wins = 0
        return
    if strategy_id == "top10_pattern" and isinstance(runtime, Top10PatternRuntime):
        cl50 = seq[-50:]
        if cl50 != runtime.last_seen_cl50 and len(cl50) >= 50:
            _top10_add(runtime, cl50[-10:])
            runtime.last_seen_cl50 = cl50
        if won:
            best, count = _top10_best(runtime)
            if count >= runtime.pattern_count and best != runtime.pattern:
                runtime.pattern = best
                runtime.pattern_count = count
                runtime.pattern_index = 0
                return
        if runtime.pattern:
            runtime.pattern_index = (runtime.pattern_index + 1) % 10
        return
    if strategy_id == "parity_hotback" and isinstance(runtime, ParityHotbackRuntime):
        window = _latest_hotback_window(seq)
        if runtime.candidates and window is not None:
            pattern, opposite = window
            if pattern in runtime.candidates:
                runtime.candidates[pattern] += 1
            runtime.candidates.pop(opposite, None)
        if won is False:
            runtime.pattern = ""
            runtime.pattern_index = 0
            return
        if runtime.pattern:
            runtime.pattern_index += 1
            if runtime.pattern_index >= 5:
                runtime.pattern = ""
                runtime.pattern_index = 0


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


def evaluate_statistical_strategy(
    strategy_id: str,
    history: list[BetSide],
    *,
    schedule_round_index: int = 0,
    runtime_state: object | None = None,
    strategy_input: str = "",
) -> StrategyDecision:
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
    if strategy_id == "sequence_follow":
        runtime = runtime_state if isinstance(runtime_state, SequenceFollowRuntime) else create_statistical_runtime(
            strategy_id, history, strategy_input=strategy_input
        )
        if not runtime.sequence:
            return StrategyDecision.skip(
                strategy_id=strategy_id, strategy_name=spec.label,
                reason="Chưa nhập chuỗi B/P hợp lệ", history_size=len(history),
            )
        pick = runtime.sequence[runtime.index]
        confidence, reason = .5, f"Chuỗi B/P, vị trí={runtime.index + 1}/{len(runtime.sequence)}"
        metadata["runtime_stateful"] = isinstance(runtime_state, SequenceFollowRuntime)
    elif strategy_id == "pattern_follow":
        runtime = runtime_state if isinstance(runtime_state, PatternFollowRuntime) else create_statistical_runtime(
            strategy_id, history, strategy_input=strategy_input
        )
        if not runtime.patterns:
            return StrategyDecision.skip(
                strategy_id=strategy_id, strategy_name=spec.label,
                reason="Chưa nhập thế cầu B/P hợp lệ (ví dụ BPP-BBP)", history_size=len(history),
            )
        if not runtime.planned:
            for lhs, rhs in runtime.patterns:
                if seq.endswith(lhs):
                    runtime.planned.extend(rhs)
                    break
        if not runtime.planned:
            return StrategyDecision.skip(
                strategy_id=strategy_id, strategy_name=spec.label,
                reason="Chưa khớp thế cầu B/P", history_size=len(history),
            )
        pick = runtime.planned[0]
        confidence, reason = .5, f"Thế cầu, còn {len(runtime.planned)} bước"
        metadata["runtime_stateful"] = isinstance(runtime_state, PatternFollowRuntime)
    elif strategy_id == "random_side":
        runtime = runtime_state if isinstance(runtime_state, RandomSideRuntime) else create_statistical_runtime(
            strategy_id, history
        )
        if not runtime.planned:
            runtime.planned = runtime.random.choice(("B", "P"))
        pick = runtime.planned
        confidence, reason = .5, "Cửa B/P ngẫu nhiên"
        metadata["runtime_stateful"] = isinstance(runtime_state, RandomSideRuntime)
    elif strategy_id == "ai_stat_parity":
        pick, confidence, size, support = _ai_stat(seq)
        reason = f"Khớp hậu tố k={size}, support={support}"
    elif strategy_id == "state_transition":
        pick, confidence = _transition(seq)
        reason = "Đếm same/flip trong 6 chuyển trạng thái gần nhất"
    elif strategy_id == "run_length":
        pick, length = _run(seq)
        confidence, reason = min(.9, .5 + length * .05), f"Độ dài dây={length}; đảo khi >= 3"
    elif strategy_id == "ensemble_majority":
        runtime = runtime_state if isinstance(runtime_state, EnsembleRuntime) else create_statistical_runtime(
            strategy_id, history
        )
        pick, confidence, reason = _ensemble_decision(runtime, seq)
        metadata["runtime_stateful"] = isinstance(runtime_state, EnsembleRuntime)
    elif strategy_id == "time_sliced_hedge":
        position = int(schedule_round_index) % 10
        pick = seq[-1] if position < 5 else _opp(seq[-1])
        confidence, reason = .5, f"Lịch 10 tay, vị trí={position + 1}"
    elif strategy_id == "knn_subsequence":
        pick, size, matches = _knn(seq)
        confidence, reason = min(.9, .5 + matches * .05), f"KNN k={size}, matches={matches}"
    elif strategy_id == "dual_schedule_hedge":
        position = int(schedule_round_index) % 10
        pick = (
            seq[-1] if position in (0, 1, 2, 8)
            else _opp(seq[-1]) if position in (3, 7)
            else _dual_schedule_ai_stat_mini(seq)
        )
        confidence, reason = .5, f"Lịch hai lớp, vị trí={position + 1}"
    elif strategy_id == "online_ngram":
        runtime = runtime_state if isinstance(runtime_state, OnlineNgramRuntime) else create_statistical_runtime(
            strategy_id, history
        )
        pick, confidence, size, support, undecidable = _online_ngram_decision(runtime, seq)
        reason = f"N-gram k={size}, support={support}; {'random' if undecidable else 'model'}"
        metadata["runtime_stateful"] = isinstance(runtime_state, OnlineNgramRuntime)
        metadata["undecidable"] = undecidable
    elif strategy_id == "expert_panel":
        runtime = runtime_state if isinstance(runtime_state, ExpertPanelRuntime) else create_statistical_runtime(
            strategy_id, history
        )
        pick, confidence, reason = _expert_panel_decision(runtime, seq)
        metadata["runtime_stateful"] = isinstance(runtime_state, ExpertPanelRuntime)
        metadata["reference_note"] = "Top10 provider trong bản C# là mock/glue; mặc định đánh đảo panel"
    elif strategy_id == "top10_pattern":
        if isinstance(runtime_state, Top10PatternRuntime):
            pick, pattern, count = _top10_runtime_decision(runtime_state, seq)
            metadata["runtime_stateful"] = True
        else:
            pick, pattern, count = _top10(seq)
        confidence, reason = min(.9, .5 + count * .03), f"Top10='{pattern or '-'}', count={count}"
    elif strategy_id == "parity_hotback":
        if isinstance(runtime_state, ParityHotbackRuntime):
            pick, pattern, count = _hotback_runtime_decision(runtime_state, seq)
            metadata["runtime_stateful"] = True
        else:
            pick, pattern, count = _hotback(seq)
        confidence, reason = min(.9, .5 + count * .03), f"Hot-back='{pattern or '-'}', count={count}"
        metadata["random_tie_break"] = True
    else:
        raise KeyError(strategy_id)
    return StrategyDecision.bet(
        strategy_id=strategy_id, strategy_name=spec.label,
        side=BetSide.BANKER if pick == "B" else BetSide.PLAYER,
        reason=reason, confidence=max(0.0, min(1.0, confidence)),
        history_size=len(history), signal_id=strategy_id, metadata=metadata,
    )
