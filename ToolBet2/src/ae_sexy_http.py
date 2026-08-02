"""Doc lich su tu HTTP query AE SEXY (queryInitTableInfo / queryInitWebGameHall)."""

from __future__ import annotations

import json
import logging
from typing import Any

from src.ae_sexy_ws import decode_big_road_item, decode_marker_item, decode_marker_road, decode_road, table_name_to_ids
from src.models import BetSide

logger = logging.getLogger(__name__)

SSOT_SOURCE = "marker-roads"
SSOT_ENDPOINT = "queryInitTableInfo"
HTTP_ROAD_ENDPOINTS = (
    "queryInitTableInfo",
    "queryInitWebGameHall",
)


def is_http_logout_relay(text: str) -> bool:
    """HTTP tra HTML Auto Logout Relay — session API het han."""
    t = (text or "").lower()
    return "auto logout relay" in t or "<title>auto logout relay</title>" in t


def parse_http_json_text(text: str) -> dict[str, Any] | None:
    """Parse JSON tu response HTTP — bo BOM/whitespace, bo qua HTML."""
    if not text:
        return None
    if is_http_logout_relay(text):
        return None
    raw = text.strip().lstrip("\ufeff")
    if not raw.startswith("{"):
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    if data.get("status") not in (None, "200", 200):
        return None
    return data


def parse_win_counts(raw: list | None) -> dict[str, int]:
    if not raw or len(raw) < 3:
        return {}
    return {"banker": int(raw[0]), "player": int(raw[1]), "tie": int(raw[2])}


def side_counts(history: list[BetSide]) -> dict[str, int]:
    return {
        "banker": sum(1 for s in history if s == BetSide.BANKER),
        "player": sum(1 for s in history if s == BetSide.PLAYER),
        "tie": sum(1 for s in history if s == BetSide.TIE),
    }


def stats_total(stats: dict[str, int] | None) -> int:
    if not stats:
        return 0
    return int(stats.get("banker", 0) + stats.get("player", 0) + stats.get("tie", 0))


def best_stats(*candidates: dict[str, int] | None) -> dict[str, int]:
    """Chon bo stats co tong van lon nhat — tranh DOM cu ghi de WS moi."""
    best: dict[str, int] = {}
    best_total = -1
    for stats in candidates:
        if not stats:
            continue
        total = stats_total(stats)
        if total > best_total:
            best_total = total
            best = {
                "banker": int(stats.get("banker", 0)),
                "player": int(stats.get("player", 0)),
                "tie": int(stats.get("tie", 0)),
            }
    return best


def stats_mismatch_severity(history: list[BetSide], stats: dict[str, int] | None) -> int:
    """Tong lech B/P/T giua lich su va stats DOM/WS."""
    if not history or not stats:
        return 0
    counts = side_counts(history)
    return (
        abs(counts["banker"] - int(stats.get("banker", 0)))
        + abs(counts["player"] - int(stats.get("player", 0)))
        + abs(counts["tie"] - int(stats.get("tie", 0)))
    )


def history_mismatches_display(history: list[BetSide], display_stats: dict[str, int] | None) -> bool:
    """True neu lich su tool lech voi B/P/T/Total tren man hinh ban."""
    if not display_stats or stats_total(display_stats) < 1:
        return False
    if not history:
        return True
    return not is_trusted_history(history, display_stats)


def history_matches_stats(
    history: list[BetSide],
    stats: dict[str, int] | None,
    *,
    max_count_err: int = 1,
) -> bool:
    """Lich su phai khop winCounts [B,P,T] va tong so van."""
    if not history:
        return False
    if not stats:
        return len(history) >= 3
    expected = stats.get("banker", 0) + stats.get("player", 0) + stats.get("tie", 0)
    if expected <= 0:
        return len(history) >= 3
    if abs(len(history) - expected) > max(1, max_count_err):
        return False
    counts = side_counts(history)
    b_err = abs(counts["banker"] - stats.get("banker", 0))
    p_err = abs(counts["player"] - stats.get("player", 0))
    t_err = abs(counts["tie"] - stats.get("tie", 0))
    return b_err + p_err + t_err <= max_count_err


def reconcile_history_to_stats(
    history: list[BetSide],
    stats: dict[str, int] | None,
    *,
    max_count_err: int = 1,
) -> list[BetSide]:
    """Chinh lich su DOM scrape cho khop thanh B/P/T tren man hinh."""
    if not history or not stats:
        return list(history or [])
    if history_matches_stats(history, stats, max_count_err=0):
        return list(history)

    counts = side_counts(history)
    b_tgt = int(stats.get("banker", 0))
    p_tgt = int(stats.get("player", 0))
    t_tgt = int(stats.get("tie", 0))
    expected = b_tgt + p_tgt + t_tgt

    # B/P dung, thua hoa ao (thuong do doc nham big road) -> bo bot hoa
    if counts["banker"] == b_tgt and counts["player"] == p_tgt and counts["tie"] > t_tgt:
        need = counts["tie"] - t_tgt
        trimmed: list[BetSide] = []
        removed = 0
        for side in history:
            if side == BetSide.TIE and removed < need:
                removed += 1
                continue
            trimmed.append(side)
        if history_matches_stats(trimmed, stats, max_count_err=max_count_err):
            return trimmed

    # Chi cat duoi khi thua van — KHONG dung de sua thu tu chuoi
    return list(history)


def should_keep_http_entry(entry: dict[str, Any], dom_stats: dict[str, int]) -> bool:
    """Giu cache HTTP chi khi khop tuyet doi stats tren man hinh."""
    hist = entry.get("history") or []
    if not hist or not dom_stats:
        return False
    return is_trusted_history(hist, dom_stats)


def invalidate_stale_http(
    cache: dict[int, dict[str, Any]],
    table_name: str,
    dom_stats: dict[str, int],
) -> None:
    """Xoa cache HTTP/WS khi khong khop stats tren man hinh."""
    for tid in table_name_to_ids(table_name):
        entry = cache.get(tid)
        if not entry:
            continue
        hist = entry.get("history") or []
        if not hist:
            continue
        if should_keep_http_entry(entry, dom_stats):
            continue
        logger.warning(
            "Xoa cache HTTP table %s (%s, %d van) — khong khop man hinh B=%s P=%s T=%s (%d van)",
            tid,
            entry.get("source", "?"),
            len(hist),
            dom_stats.get("banker"),
            dom_stats.get("player"),
            dom_stats.get("tie"),
            stats_total(dom_stats),
        )
        del cache[tid]


def history_score(history: list[BetSide], stats: dict[str, int] | None) -> int:
    if not history or not stats:
        return -1
    if not is_trusted_history(history, stats):
        return -1
    return 5000 + len(history) * 10


def _marker_sort_key(item: dict[str, Any]) -> tuple[int, int, int]:
    """Thu tu van = stampTime (chronological). showX/Y chi la vi tri hien thi."""
    return (
        int(item.get("stampTime") or 0),
        int(item.get("showX") or 0),
        int(item.get("showY") or 0),
    )


def _marker_grid_sort_key(item: dict[str, Any]) -> tuple[int, int]:
    """Thu tu hien thi tren bead plate: cot (showX) trai->phai, hang (showY) tren->duoi."""
    return (int(item.get("showX") or 0), int(item.get("showY") or 0))


def format_marker_roads_preview(markers: list[dict[str, Any]], max_cells: int = 24) -> str:
    """Chuoi B/P/T theo thu tu grid bead plate (24 o, 6 hang/cot)."""
    if not markers:
        return "(rong)"
    grid_sorted = sorted(markers, key=_marker_grid_sort_key)
    tail = grid_sorted[-max_cells:] if len(grid_sorted) > max_cells else grid_sorted
    labels: list[str] = []
    for item in tail:
        side = decode_marker_item(item)
        if side == BetSide.BANKER:
            labels.append("B")
        elif side == BetSide.PLAYER:
            labels.append("P")
        elif side == BetSide.TIE:
            labels.append("T")
        else:
            labels.append("?")
    return " ".join(labels)


def log_marker_roads_ssot(
    tid: int,
    markers: list[dict[str, Any]],
    stats: dict[str, int] | None,
    hist: list[BetSide],
    *,
    via: str = "HTTP",
) -> None:
    """Log SSOT — markerRoads[] chinh la du lieu grid bead plate."""
    preview = format_marker_roads_preview(markers)
    logger.debug(
        "[SSOT %s] %s table=%s | markerRoads=%d van | decode=%d | winCounts B=%s P=%s T=%s | grid: %s",
        via,
        SSOT_ENDPOINT,
        tid,
        len(markers),
        len(hist),
        (stats or {}).get("banker", "?"),
        (stats or {}).get("player", "?"),
        (stats or {}).get("tie", "?"),
        preview,
    )


def is_trusted_history(
    history: list[BetSide],
    stats: dict[str, int] | None,
    *,
    max_count_err: int = 0,
) -> bool:
    """Lich su tin cay — tong van va B/P/T phai khop stats."""
    if not history or not stats:
        return False
    total = stats_total(stats)
    if total <= 0 or len(history) != total:
        return False
    return history_matches_stats(history, stats, max_count_err=max_count_err)


def align_history_to_win_counts(
    history: list[BetSide],
    stats: dict[str, int],
    *,
    flip_priority: list[int] | None = None,
) -> list[BetSide] | None:
    """
    Chinh lech B/P nho de khop winCounts — giu thu tu van.
    flip_priority: chi so van uu tien doi (vd. van co ma pair road lac).
    """
    if not history or not stats or len(history) != stats_total(stats):
        return None
    if history_matches_stats(history, stats, max_count_err=0):
        return list(history)

    hist = list(history)
    counts = side_counts(hist)
    b_tgt = int(stats.get("banker", 0))
    p_tgt = int(stats.get("player", 0))
    t_tgt = int(stats.get("tie", 0))

    def iter_indices():
        seen: set[int] = set()
        for idx in flip_priority or []:
            if 0 <= idx < len(hist) and idx not in seen:
                seen.add(idx)
                yield idx
        for idx in range(len(hist) - 1, -1, -1):
            if idx not in seen:
                yield idx

    # Chuyen P/B <-> T (mot so ma road pair/hoa bi decode nham)
    for _ in range(len(hist) + 1):
        counts = side_counts(hist)
        if history_matches_stats(hist, stats, max_count_err=0):
            return hist
        if counts["tie"] < t_tgt:
            changed = False
            for idx in iter_indices():
                if counts["tie"] >= t_tgt:
                    break
                if hist[idx] == BetSide.PLAYER and counts["player"] > p_tgt:
                    hist[idx] = BetSide.TIE
                    changed = True
                    break
                if hist[idx] == BetSide.BANKER and counts["banker"] > b_tgt:
                    hist[idx] = BetSide.TIE
                    changed = True
                    break
            if not changed:
                break
            continue
        if counts["tie"] > t_tgt:
            changed = False
            for idx in iter_indices():
                if counts["tie"] <= t_tgt:
                    break
                if hist[idx] != BetSide.TIE:
                    continue
                if counts["player"] < p_tgt:
                    hist[idx] = BetSide.PLAYER
                elif counts["banker"] < b_tgt:
                    hist[idx] = BetSide.BANKER
                else:
                    hist[idx] = BetSide.PLAYER
                changed = True
                break
            if not changed:
                break
            continue
        break

    counts = side_counts(hist)
    if history_matches_stats(hist, stats, max_count_err=0):
        return hist

    def flip_at(idx: int, to_player: bool) -> bool:
        if to_player and hist[idx] == BetSide.BANKER:
            hist[idx] = BetSide.PLAYER
            return True
        if not to_player and hist[idx] == BetSide.PLAYER:
            hist[idx] = BetSide.BANKER
            return True
        return False

    def iter_flip_indices(to_player: bool):
        seen: set[int] = set()
        for idx in flip_priority or []:
            if 0 <= idx < len(hist) and idx not in seen:
                seen.add(idx)
                yield idx
        for idx in range(len(hist) - 1, -1, -1):
            if idx not in seen:
                yield idx

    counts = side_counts(hist)
    while counts["banker"] > b_tgt and counts["player"] < p_tgt:
        if not any(flip_at(i, True) for i in iter_flip_indices(True)):
            return None
        counts = side_counts(hist)
    while counts["player"] > p_tgt and counts["banker"] < b_tgt:
        if not any(flip_at(i, False) for i in iter_flip_indices(False)):
            return None
        counts = side_counts(hist)

    if history_matches_stats(hist, stats, max_count_err=0):
        return hist
    return None


def build_marker_history(
    markers: list[dict[str, Any]],
    stats: dict[str, int] | None = None,
) -> list[BetSide]:
    """Giai ma markerRoads — uu tien khop winCounts [B,P,T]."""
    if not markers:
        return []
    ordered = sorted(markers, key=_marker_sort_key)
    pair_road_codes = {3, 4, 5, 6, 7, 9}
    flip_priority: list[int] = []
    hist: list[BetSide] = []
    for idx, item in enumerate(ordered):
        road = int(item.get("road", -1))
        side = decode_marker_item(item)
        if side:
            hist.append(side)
            if road in pair_road_codes:
                flip_priority.append(idx)
    if not stats or history_matches_stats(hist, stats, max_count_err=0):
        return hist
    aligned = align_history_to_win_counts(hist, stats, flip_priority=flip_priority)
    if aligned:
        if stats_mismatch_severity(hist, stats) > 0:
            logger.debug(
                "markerRoads align winCounts: %s -> %s",
                side_counts(hist),
                side_counts(aligned),
            )
        return aligned
    # Thu decode_road truc tiep (mot so ma pair)
    alt: list[BetSide] = []
    for item in ordered:
        side = decode_road(int(item.get("road", -1)))
        if side:
            alt.append(side)
    if history_matches_stats(alt, stats, max_count_err=0):
        return alt
    # markerRoads co the nhieu hon hist neu ma road lac — thu decode_road cho tat ca
    if len(alt) > len(hist) and history_matches_stats(alt, stats, max_count_err=1):
        return alt
    aligned = reconcile_history_to_stats(hist, stats, max_count_err=1)
    if history_matches_stats(aligned, stats, max_count_err=0):
        return aligned
    aligned_alt = reconcile_history_to_stats(alt, stats, max_count_err=1)
    if history_matches_stats(aligned_alt, stats, max_count_err=0):
        return aligned_alt
    if stats and len(hist) == stats_total(stats) and stats_mismatch_severity(hist, stats) <= 6:
        aligned_loose = align_history_to_win_counts(hist, stats, flip_priority=flip_priority)
        if aligned_loose:
            return aligned_loose
        logger.warning(
            "markerRoads %d van — dung SSOT thu tu van, lech winCounts %s vs %s",
            len(hist),
            side_counts(hist),
            stats,
        )
        return hist
    expected = stats_total(stats) if stats else 0
    logger.debug(
        "markerRoads %d van khong khop winCounts tong %d — bo qua",
        len(hist),
        expected,
    )
    return []


def history_from_road_info(road_info: dict[str, Any] | None) -> tuple[list[BetSide], bool]:
    """Tra ve (lich su, co_markerRoads). Uu tien markerRoads (thu tu chuan)."""
    if not road_info:
        return [], False

    stats = parse_win_counts(road_info.get("winCounts"))
    markers = road_info.get("markerRoads")
    if markers is not None:
        if not markers and stats and stats_total(stats) == 0:
            return [], True
        if markers:
            marker_hist = build_marker_history(markers, stats)
            if marker_hist:
                return marker_hist, True
        # marker decode fail — thu bigRoads + align (bigRoads thieu hoa nhung du B/P)
        big = road_info.get("bigRoads") or []
        if big and stats:
            ordered = sorted(big, key=lambda m: int(m.get("stampTime") or 0))
            big_hist = [s for item in ordered if (s := decode_big_road_item(item))]
            aligned = align_history_to_win_counts(big_hist, stats) if big_hist else None
            if aligned:
                logger.debug(
                    "markerRoads fail — dung bigRoads align winCounts (%d van)",
                    len(aligned),
                )
                return aligned, False
        expected = stats_total(stats)
        logger.debug(
            "markerRoads %d muc khong khop winCounts tong %d — bo qua",
            len(markers),
            expected,
        )
        return [], True

    big = road_info.get("bigRoads") or []
    if big:
        ordered = sorted(big, key=lambda m: int(m.get("stampTime") or 0))
        hist = []
        for item in ordered:
            side = decode_big_road_item(item)
            if side:
                hist.append(side)
        if hist:
            return hist, False

    return [], False


def _make_entry(
    road: dict,
    hist: list[BetSide],
    has_markers: bool,
    source: str,
    *,
    raw_markers: list[dict] | None = None,
) -> dict[str, Any]:
    stats = parse_win_counts(road.get("winCounts"))
    entry: dict[str, Any] = {
        "history": hist,
        "stats": stats,
        "source": source,
        "has_markers": has_markers,
        "game_shoe": int(road.get("gameShoe") or 0),
        "game_round": int(road.get("gameRound") or 0),
    }
    if raw_markers is not None:
        entry["raw_markers"] = list(raw_markers)
    return entry


def ingest_http_json(data: dict[str, Any]) -> dict[int, dict[str, Any]]:
    out: dict[int, dict[str, Any]] = {}

    table_item = data.get("tableItem") or {}
    road = table_item.get("roadInfo")
    if road:
        tid = int(road.get("tableID") or table_item.get("tableInfo", {}).get("tableID") or 0)
        hist, has_markers = history_from_road_info(road)
        markers = road.get("markerRoads") or []
        if tid and hist and has_markers:
            stats = parse_win_counts(road.get("winCounts"))
            log_marker_roads_ssot(tid, markers, stats, hist, via="HTTP-init-table")
        stats = parse_win_counts(road.get("winCounts"))
        if tid and has_markers and not hist and stats and stats_total(stats) == 0:
            out[tid] = _make_entry(road, [], True, SSOT_SOURCE, raw_markers=markers)
        elif tid and hist:
            mk = _make_entry(
                road,
                hist,
                has_markers,
                SSOT_SOURCE if has_markers else "http-init-table",
                raw_markers=markers if has_markers else None,
            )
            if stats and len(hist) == stats_total(stats):
                out[tid] = mk
            elif history_matches_stats(hist, stats, max_count_err=0):
                out[tid] = mk
            elif (
                has_markers
                and stats
                and len(hist) == stats_total(stats)
                and stats_mismatch_severity(hist, stats) <= 6
            ):
                logger.warning(
                    "markerRoads table %s: chap nhan %d van (lech nhe winCounts %s vs %s)",
                    tid,
                    len(hist),
                    side_counts(hist),
                    stats,
                )
                out[tid] = _make_entry(
                    road, hist, has_markers, SSOT_SOURCE, raw_markers=markers
                )
            else:
                logger.debug(
                    "Bo qua init-table %s: decode %d van khong khop winCounts tong %d (B=%s P=%s T=%s)",
                    tid,
                    len(hist),
                    stats_total(stats),
                    stats.get("banker", "?"),
                    stats.get("player", "?"),
                    stats.get("tie", "?"),
                )

    for item in data.get("tableItems") or []:
        road = item.get("roadInfo")
        if not road:
            continue
        tid = int(road.get("tableID") or 0)
        hist, has_markers = history_from_road_info(road)
        if not tid or not hist:
            continue
        entry = _make_entry(road, hist, has_markers, "http-init-hall")
        # Sanh chi co bigRoads — chi chap nhan neu khop winCounts
        if not has_markers and not history_matches_stats(hist, entry["stats"]):
            logger.debug(
                "Bo qua hall table %s: bigRoads=%d khong khop stats %s",
                tid,
                len(hist),
                entry["stats"],
            )
            continue
        prev = out.get(tid)
        if not prev or len(hist) > len(prev.get("history") or []):
            out[tid] = entry

    return out


def _merge_entry(prev: dict | None, entry: dict) -> dict:
    entry_hist = entry.get("history") or []
    entry_stats = entry.get("stats")
    if entry_hist and entry_stats and not history_matches_stats(entry_hist, entry_stats, max_count_err=0):
        return prev or entry
    if not prev:
        return entry
    prev_shoe = int(prev.get("game_shoe") or 0)
    new_shoe = int(entry.get("game_shoe") or 0)
    if new_shoe and prev_shoe and new_shoe != prev_shoe:
        return entry
    if entry.get("source") == "http-init-table":
        return entry
    if entry.get("has_markers") and not prev.get("has_markers"):
        return entry
    prev_len = len(prev.get("history") or [])
    new_len = len(entry.get("history") or [])
    if history_matches_stats(entry.get("history") or [], entry.get("stats")) and not history_matches_stats(
        prev.get("history") or [], prev.get("stats")
    ):
        return entry
    if new_len > prev_len and history_matches_stats(entry.get("history") or [], entry.get("stats")):
        return entry
    return prev


def history_for_table_name(
    cache: dict[int, dict[str, Any]],
    table_name: str,
    dom_stats: dict[str, int] | None = None,
) -> tuple[list[BetSide], str, dict[str, int]]:
    """Chon lich su khop stats nhat — uu tien init-table + markerRoads."""
    best: dict[str, Any] | None = None
    best_score = -1

    ref_stats = dom_stats or {}
    for tid in table_name_to_ids(table_name):
        entry = cache.get(tid)
        if not entry or not entry.get("history"):
            continue
        stats = dict(entry.get("stats") or {})
        stats["_has_markers"] = entry.get("has_markers")
        stats["_source"] = entry.get("source")
        if dom_stats:
            if not is_trusted_history(entry["history"], dom_stats):
                continue
            score = history_score(entry["history"], dom_stats)
        else:
            if not history_matches_stats(entry["history"], stats, max_count_err=0):
                if not (
                    stats
                    and len(entry["history"]) == stats_total(stats)
                    and stats_mismatch_severity(entry["history"], stats) <= 4
                ):
                    continue
            score = history_score(entry["history"], stats)
            if score < 0 and stats and len(entry["history"]) == stats_total(stats):
                score = 4000 + len(entry["history"]) * 10 - stats_mismatch_severity(entry["history"], stats) * 50
        # SSOT: markerRoads[] tu queryInitTableInfo — uu tien tuyet doi
        if entry.get("has_markers"):
            score += 50_000
        if entry.get("source") in (SSOT_SOURCE, "http-init-table"):
            score += 10_000
        elif entry.get("source") == "http-init-hall":
            score -= 20_000
        if score > best_score:
            best_score = score
            best = entry

    if best and best_score >= 0:
        return list(best["history"]), str(best.get("source", "http")), dict(best.get("stats") or {})
    return [], "", {}


_FETCH_INIT_TABLE_JS = """async (tableId) => {
  const targets = [];
  const seen = new Set();
  const add = (src, win) => {
    const m = (src || '').match(/^(https?:\\/\\/[^/]+\\/player\\/)/);
    if (!m) return;
    const jsid = ((src || '').match(/jsessionid=([^?;&]+)/) || [])[1] || '';
    const key = m[1] + '|' + jsid;
    if (seen.has(key)) return;
    seen.add(key);
  const low = (src || '').toLowerCase();
  const pri = low.includes('singlebactable') || low.includes('bactable') ? 0
    : low.includes('gamehall') ? 1 : 2;
    targets.push({ base: m[1], jsid, win: win || window, pri });
  };
  add(location.href, window);
  for (const f of document.querySelectorAll('iframe')) {
    const s = f.src || '';
    let win = null;
    try { win = f.contentDocument?.defaultView || null; } catch (_) {}
    add(s, win);
  }
  targets.sort((a, b) => a.pri - b.pri);
  let last = null;
  for (const t of targets) {
    const url = t.base + 'query/queryInitTableInfo' + (t.jsid ? ';jsessionid=' + t.jsid : '');
    try {
      const resp = await t.win.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'tableID=' + tableId,
        credentials: 'include',
      });
      const text = await resp.text();
      last = text;
      if ((text || '').trim().replace(/^\\ufeff+/, '').startsWith('{')) return text;
    } catch (_) {}
  }
  return last;
}"""

_FETCH_INIT_TABLE_FRAME_JS = """async (tableId) => {
  const m = location.href.match(/^(https?:\\/\\/[^/]+\\/player\\/)/);
  if (!m) return null;
  const jsid = (location.href.match(/jsessionid=([^?;&]+)/) || [])[1] || '';
  const url = m[1] + 'query/queryInitTableInfo' + (jsid ? ';jsessionid=' + jsid : '');
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'tableID=' + tableId,
    credentials: 'include',
  });
  return await resp.text();
}"""


async def _fetch_table_body_from_frames(page, table_id: int) -> tuple[str | None, bool]:
    """Thu fetch queryInitTableInfo tu shell + moi frame /player/. Tra (body, logout_relay)."""
    from src.ae_sexy import _game_shell_frames

    logout_relay = False
    frames: list = []
    seen_ids: set[int] = set()
    for frame in page.frames:
        fid = id(frame)
        if fid in seen_ids:
            continue
        seen_ids.add(fid)
        frames.append(frame)
    for frame in await _game_shell_frames(page):
        fid = id(frame)
        if fid not in seen_ids:
            seen_ids.add(fid)
            frames.append(frame)

    for frame in frames:
        for js, label in ((_FETCH_INIT_TABLE_JS, "shell"), (_FETCH_INIT_TABLE_FRAME_JS, "frame")):
            try:
                body = await frame.evaluate(js, table_id)
            except Exception:
                continue
            if not body:
                continue
            if is_http_logout_relay(body):
                logout_relay = True
                continue
            if parse_http_json_text(body):
                return body, logout_relay
    return None, logout_relay


async def fetch_init_table_info(
    page,
    table_name: str,
    *,
    quiet: bool = False,
) -> tuple[dict[int, dict[str, Any]], bool]:
    """Goi queryInitTableInfo — tra (ket qua, logout_relay)."""
    from src.ae_sexy_ws import table_name_to_ids

    ids = table_name_to_ids(table_name)
    if not ids:
        return {}, False

    logout_relay = False
    for tid in ids:
        body, relay = await _fetch_table_body_from_frames(page, tid)
        if relay:
            logout_relay = True
        if not body:
            continue
        data = parse_http_json_text(body)
        if not data:
            continue
        result = ingest_http_json(data)
        if result:
            for entry_tid, entry in result.items():
                ok = history_matches_stats(entry["history"], entry.get("stats"))
                log_fn = logger.debug if quiet else logger.info
                log_fn(
                    "HTTP fetch table %s: decode %d van | winCounts B=%s P=%s T=%s (tong %s) %s",
                    entry_tid,
                    len(entry["history"]),
                    entry.get("stats", {}).get("banker", "?"),
                    entry.get("stats", {}).get("player", "?"),
                    entry.get("stats", {}).get("tie", "?"),
                    stats_total(entry.get("stats")),
                    "OK" if ok else "MISMATCH",
                )
            return result, logout_relay

    if logout_relay and not quiet:
        logger.warning(
            "[SSOT] HTTP queryInitTableInfo tra Auto Logout Relay — session API het han (%s)",
            table_name,
        )
    return {}, logout_relay


async def try_parse_http_response(url: str, body: str) -> dict[int, dict[str, Any]]:
    if not any(ep in url for ep in HTTP_ROAD_ENDPOINTS):
        return {}
    data = parse_http_json_text(body)
    if not data:
        return {}
    result = ingest_http_json(data)
    if result:
        for tid, entry in result.items():
            ok = history_matches_stats(entry["history"], entry.get("stats"))
            logger.debug(
                "HTTP road table %s: decode %d van (%s%s) | winCounts B=%s P=%s T=%s (tong %s) shoe=%s %s",
                tid,
                len(entry["history"]),
                entry["source"],
                " marker" if entry.get("has_markers") else "",
                entry.get("stats", {}).get("banker", "?"),
                entry.get("stats", {}).get("player", "?"),
                entry.get("stats", {}).get("tie", "?"),
                stats_total(entry.get("stats")),
                entry.get("game_shoe", "?"),
                "OK" if ok else "MISMATCH",
            )
    return result
