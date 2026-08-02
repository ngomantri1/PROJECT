from __future__ import annotations

from dataclasses import dataclass

from src.models import BetSide, SIDE_LABEL


@dataclass
class BlockPattern:
    """Mau khoi xen ke (vd 1-1 = 2 van xen ke)."""

    id: str
    name: str
    blocks: tuple[int, ...]
    min_build_length: int | None = None

    @property
    def length(self) -> int:
        return sum(self.blocks)


@dataclass
class PatternAnalysis:
    pattern_id: str
    pattern_name: str
    status: str  # matched | building
    bet_side: BetSide | None
    progress: str
    sequence_text: str
    reason: str


PATTERN_LENGTH_CHOICES = (2, 3, 4)
DEFAULT_PATTERN_LENGTHS: dict[str, int] = {
    "mau_1_1": 2,
    "mau_bet_2": 2,
}

# Catalog ids (do dai thay doi luc runtime)
CASE1_ID = "mau_1_1"
CASE2_ID = "mau_bet_2"
CASE1_PATTERNS: list[BlockPattern] = [
    BlockPattern("mau_1_1", "1-1", (1, 1)),
]
CASE2_NAME = "Bet×2"
CASE2_MIN_STREAK = 2  # mac dinh; runtime dung pattern_lengths


def clamp_pattern_length(value: int | None, default: int = 2) -> int:
    try:
        n = int(value) if value is not None else default
    except (TypeError, ValueError):
        n = default
    if n not in PATTERN_LENGTH_CHOICES:
        return default
    return n


def normalize_pattern_lengths(raw: dict[str, int] | None = None) -> dict[str, int]:
    out = dict(DEFAULT_PATTERN_LENGTHS)
    if not raw:
        return out
    for pid, default in DEFAULT_PATTERN_LENGTHS.items():
        if pid in raw:
            out[pid] = clamp_pattern_length(raw[pid], default)
    return out


def _lengths(raw: dict[str, int] | None) -> dict[str, int]:
    return normalize_pattern_lengths(raw)


def _case1_pattern(lengths: dict[str, int] | None = None) -> BlockPattern:
    n = _lengths(lengths)[CASE1_ID]
    name = "1-1" if n == 2 else f"1-1×{n}"
    return BlockPattern(CASE1_ID, name, tuple(1 for _ in range(n)))


def _case2_name(n: int) -> str:
    return "Bet×2" if n == 2 else f"Bet×{n}"


def _case1_patterns_by_priority(
    lengths: dict[str, int] | None = None,
) -> list[BlockPattern]:
    return [_case1_pattern(lengths)]


def _disabled_set(disabled_patterns: set[str] | frozenset[str] | None) -> frozenset[str]:
    if not disabled_patterns:
        return frozenset()
    return frozenset(disabled_patterns)


def pattern_priority_hint(
    *,
    disabled_patterns: set[str] | frozenset[str] | None = None,
    pattern_lengths: dict[str, int] | None = None,
) -> str:
    disabled = _disabled_set(disabled_patterns)
    lengths = _lengths(pattern_lengths)
    names: list[str] = []
    if CASE1_ID not in disabled:
        names.append(_case1_pattern(lengths).name)
    if CASE2_ID not in disabled:
        names.append(_case2_name(lengths[CASE2_ID]))
    return " > ".join(names) if names else "(tat ca mau da tat)"


def pattern_catalog(
    pattern_lengths: dict[str, int] | None = None,
) -> list[dict[str, str | int]]:
    lengths = _lengths(pattern_lengths)
    items: list[dict[str, str | int]] = []
    pat = _case1_pattern(lengths)
    items.append(
        {
            "id": pat.id,
            "name": pat.name,
            "rule": f"Xen ke {pat.name} — {pat.length} van (bo qua hoa)",
            "length": lengths[CASE1_ID],
            "length_choices": list(PATTERN_LENGTH_CHOICES),
        }
    )
    n2 = lengths[CASE2_ID]
    items.append(
        {
            "id": CASE2_ID,
            "name": _case2_name(n2),
            "rule": f"{n2} van lien tiep cung mau",
            "length": n2,
            "length_choices": list(PATTERN_LENGTH_CHOICES),
        }
    )
    return items


def filter_history(history: list[BetSide], skip_tie: bool = True) -> list[BetSide]:
    if skip_tie:
        return [s for s in history if s != BetSide.TIE]
    return list(history)


def _seq_text(seq: list[BetSide]) -> str:
    return " - ".join(SIDE_LABEL.get(s, s.value) for s in seq)


def _blocks_to_colors(history: list[BetSide], block_sizes: tuple[int, ...]) -> list[BetSide] | None:
    total = sum(block_sizes)
    if len(history) < total:
        return None
    tail = history[-total:]
    colors: list[BetSide] = []
    idx = 0
    for size in block_sizes:
        chunk = tail[idx : idx + size]
        if len(set(chunk)) != 1:
            return None
        colors.append(chunk[0])
        idx += size
    for i in range(1, len(colors)):
        if colors[i] == colors[i - 1]:
            return None
    return colors


def _is_valid_block_prefix(tail: list[BetSide], block_sizes: tuple[int, ...]) -> bool:
    if not tail:
        return False
    block_i = 0
    pos_in_block = 0
    current_color: BetSide | None = None
    prev_block_color: BetSide | None = None

    for side in tail:
        if block_i >= len(block_sizes):
            return False
        target = block_sizes[block_i]
        if pos_in_block == 0:
            if prev_block_color is not None and side == prev_block_color:
                return False
            current_color = side
        elif side != current_color:
            return False
        pos_in_block += 1
        if pos_in_block >= target:
            prev_block_color = current_color
            block_i += 1
            pos_in_block = 0
    return True


def _opposite(side: BetSide) -> BetSide:
    return BetSide.PLAYER if side == BetSide.BANKER else BetSide.BANKER


def _match_block_pattern(history: list[BetSide], pat: BlockPattern) -> BetSide | None:
    colors = _blocks_to_colors(history, pat.blocks)
    if colors is None:
        return None
    return _opposite(colors[-1])


def _match_streak_n(history: list[BetSide], n: int) -> BetSide | None:
    if n < 2 or len(history) < n:
        return None
    tail = history[-n:]
    if len(set(tail)) == 1:
        return tail[0]
    return None


def _match_streak_2(history: list[BetSide]) -> BetSide | None:
    """Tuong thich cu — streak 2."""
    return _match_streak_n(history, CASE2_MIN_STREAK)


def _building_block_pattern(history: list[BetSide], pat: BlockPattern) -> PatternAnalysis | None:
    total = pat.length
    min_len = pat.min_build_length if pat.min_build_length is not None else 1
    for use_len in range(total - 1, min_len - 1, -1):
        if len(history) < use_len:
            continue
        tail = history[-use_len:]
        if _is_valid_block_prefix(tail, pat.blocks):
            return PatternAnalysis(
                pattern_id=pat.id,
                pattern_name=pat.name,
                status="building",
                bet_side=None,
                progress=f"{use_len}/{total}",
                sequence_text=_seq_text(tail),
                reason=f"Dang hinh thanh {pat.name}: {_seq_text(tail)} | can them {total - use_len} van",
            )
    return None


def analyze_patterns(
    history: list[BetSide],
    skip_tie: bool = True,
    *,
    disabled_patterns: set[str] | frozenset[str] | None = None,
    pattern_lengths: dict[str, int] | None = None,
) -> list[PatternAnalysis]:
    h = filter_history(history, skip_tie)
    if not h:
        return []

    disabled = _disabled_set(disabled_patterns)
    lengths = _lengths(pattern_lengths)
    results: list[PatternAnalysis] = []

    for pat in _case1_patterns_by_priority(lengths):
        if pat.id in disabled:
            continue
        bet = _match_block_pattern(h, pat)
        if bet is None:
            continue
        bet_label = SIDE_LABEL[bet]
        tail = h[-pat.length :]
        results.append(
            PatternAnalysis(
                pattern_id=pat.id,
                pattern_name=pat.name,
                status="matched",
                bet_side=bet,
                progress=f"{pat.length}/{pat.length}",
                sequence_text=_seq_text(tail),
                reason=f"Khop {pat.name} ({_seq_text(tail)}) -> cuoc tiep: {bet_label} (tiep xen ke)",
            )
        )
        return results

    streak_n = lengths[CASE2_ID]
    streak_bet = None if CASE2_ID in disabled else _match_streak_n(h, streak_n)
    if streak_bet is not None:
        tail = h[-streak_n:]
        bet_label = SIDE_LABEL[streak_bet]
        c2_name = _case2_name(streak_n)
        results.append(
            PatternAnalysis(
                pattern_id=CASE2_ID,
                pattern_name=c2_name,
                status="matched",
                bet_side=streak_bet,
                progress=f"{streak_n}/{streak_n}",
                sequence_text=_seq_text(tail),
                reason=f"Khop {c2_name} ({_seq_text(tail)}) -> cuoc tiep: {bet_label}",
            )
        )
        return results

    building: list[PatternAnalysis] = []
    for pat in _case1_patterns_by_priority(lengths):
        if pat.id in disabled:
            continue
        b = _building_block_pattern(h, pat)
        if b:
            building.append(b)
    building.sort(
        key=lambda x: (
            _case1_pattern(lengths).length if x.pattern_id == CASE1_ID else 0,
            int(x.progress.split("/")[0]),
        ),
        reverse=True,
    )
    seen: set[str] = set()
    for b in building:
        if b.pattern_id not in seen:
            results.append(b)
            seen.add(b.pattern_id)
    return results


def format_full_history(history: list[BetSide], skip_tie: bool = True) -> str:
    h = filter_history(history, skip_tie)
    if not h:
        return "(trong)"
    return " -> ".join(SIDE_LABEL.get(s, s.value) for s in h)


def get_active_signal(
    history: list[BetSide],
    skip_tie: bool = True,
    *,
    disabled_patterns: set[str] | frozenset[str] | None = None,
    pattern_lengths: dict[str, int] | None = None,
) -> PatternAnalysis | None:
    matched = [
        a
        for a in analyze_patterns(
            history,
            skip_tie,
            disabled_patterns=disabled_patterns,
            pattern_lengths=pattern_lengths,
        )
        if a.status == "matched"
    ]
    return matched[0] if matched else None


def log_analysis(
    logger,
    history: list[BetSide],
    skip_tie: bool = True,
    *,
    disabled_patterns: set[str] | frozenset[str] | None = None,
    pattern_lengths: dict[str, int] | None = None,
):
    h = filter_history(history, skip_tie)
    logger.info("=" * 60)
    logger.info("LICH SU DAY DU (%d van, bo qua hoa):", len(h))
    logger.info("%s", format_full_history(history, skip_tie))

    analyses = analyze_patterns(
        history,
        skip_tie,
        disabled_patterns=disabled_patterns,
        pattern_lengths=pattern_lengths,
    )
    if not analyses:
        logger.info("PHAN TICH: Chua co mau nao khop hoac dang hinh thanh")
        logger.info("=" * 60)
        return

    matched = [a for a in analyses if a.status == "matched"]
    building = [a for a in analyses if a.status == "building"]

    if matched:
        logger.info("--- MAU KHOP (co tin hieu cuoc) ---")
        for a in matched:
            logger.info("[%s] %s", a.pattern_name, a.reason)
            logger.info("  -> CUOC TIEP THEO: %s", SIDE_LABEL[a.bet_side])

    if building:
        logger.info("--- DANG HINH THANH ---")
        for a in building[:5]:
            logger.info("[%s] %s (%s)", a.pattern_name, a.reason, a.progress)

    if not matched:
        logger.info("CHUA CO MAU KHOP -> chua co tin hieu cuoc")

    logger.info("=" * 60)


def log_signal_update(
    logger,
    history: list[BetSide],
    *,
    skip_tie: bool = True,
    last_result: str = "",
    disabled_patterns: set[str] | frozenset[str] | None = None,
    pattern_lengths: dict[str, int] | None = None,
):
    h = filter_history(history, skip_tie)
    signal = get_active_signal(
        history,
        skip_tie,
        disabled_patterns=disabled_patterns,
        pattern_lengths=pattern_lengths,
    )
    tail = " -> ".join(SIDE_LABEL.get(s, s.value) for s in h[-8:]) if h else "(trong)"

    if last_result:
        logger.info("Van moi: %s | 8 van cuoi: %s", last_result, tail)
    else:
        logger.info("Cap nhat lich su (%d van) | 8 van cuoi: %s", len(h), tail)

    if signal and signal.bet_side:
        logger.info(
            ">>> CUOC TIEP THEO: %s  (%s)",
            SIDE_LABEL[signal.bet_side].upper(),
            signal.pattern_name,
        )
    else:
        building = [
            a
            for a in analyze_patterns(
                history,
                skip_tie,
                disabled_patterns=disabled_patterns,
                pattern_lengths=pattern_lengths,
            )
            if a.status == "building"
        ]
        if building:
            logger.info(
                "Chua co tin hieu | dang hinh thanh: %s (%s)",
                building[0].pattern_name,
                building[0].progress,
            )
        else:
            logger.info("Chua co tin hieu cuoc")
