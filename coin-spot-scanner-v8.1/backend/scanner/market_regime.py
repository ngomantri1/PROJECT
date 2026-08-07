from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
import json
from typing import Any, Iterable


GROUP_KEYS = (
    "btc_d1", "btc_4h", "eth_d1_4h", "btc_dominance", "eth_btc",
    "total3_proxy", "breadth_ma20", "alt_volume_7d", "macro_event_risk",
)
CORE_GROUP_KEYS = GROUP_KEYS[:8]

DEFAULT_THRESHOLDS = {
    "trend_slope_pct": 0.15,
    "breadth_min_coverage_pct": 60.0,
    "volume_min_coverage_pct": 60.0,
    "freshness_seconds": {"kline": 60 * 60 * 6, "global": 60 * 60 * 24},
    "batch_concurrency": 4,
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_time(value: datetime | None = None) -> str:
    return (value or utc_now()).astimezone(timezone.utc).isoformat()


def evidence(label: str, *, value: Any = None, signal: str = "UNKNOWN", status: str = "UNKNOWN",
             provider: str | None = None, endpoint: str | None = None, symbols: list[str] | None = None,
             observed_at: str | None = None, fetched_at: str | None = None,
             freshness_seconds: int | None = None, error: str | None = None,
             notes: list[str] | None = None) -> dict:
    return {
        "label": label,
        "value": value,
        "signal": signal,
        "status": status,
        "source": {"provider": provider, "endpoint": endpoint, "symbols": symbols or []},
        "observed_at": observed_at,
        "fetched_at": fetched_at,
        "freshness_seconds": freshness_seconds,
        "error": error,
        "notes": notes or [],
    }


def parse_closed_klines(rows: Any, *, now: datetime | None = None) -> list[dict]:
    """Validate Binance kline rows and exclude the currently open candle."""
    if not isinstance(rows, list):
        raise ValueError("Kline payload is not a list")
    now_ms = int((now or utc_now()).timestamp() * 1000)
    parsed = []
    for row in rows:
        if not isinstance(row, (list, tuple)) or len(row) < 7:
            continue
        try:
            open_time = int(row[0])
            close_time = int(row[6])
            values = {"open": float(row[1]), "high": float(row[2]), "low": float(row[3]), "close": float(row[4]), "volume": float(row[5])}
        except (TypeError, ValueError):
            continue
        if close_time > now_ms or values["close"] <= 0 or values["high"] <= 0:
            continue
        parsed.append({"open_time": open_time, "close_time": close_time, **values})
    return parsed


def _sma(values: list[float], period: int) -> float | None:
    return sum(values[-period:]) / period if len(values) >= period else None


def _signal_from_series(values: list[float], *, slope_threshold_pct: float = 0.15) -> tuple[str, dict]:
    if len(values) < 50:
        return "UNKNOWN", {"reason": "INSUFFICIENT_CLOSED_KLINES", "count": len(values)}
    last = values[-1]
    ma20, ma50 = _sma(values, 20), _sma(values, 50)
    previous = values[-min(20, len(values))]
    slope_pct = ((last - previous) / abs(previous) * 100) if previous else None
    if ma20 is None or ma50 is None or slope_pct is None:
        return "UNKNOWN", {"reason": "INSUFFICIENT_INDICATORS"}
    if last > ma20 >= ma50 and slope_pct >= slope_threshold_pct:
        signal = "BULLISH"
    elif last < ma20 <= ma50 and slope_pct <= -slope_threshold_pct:
        signal = "BEARISH"
    else:
        signal = "NEUTRAL"
    return signal, {"last": last, "ma20": ma20, "ma50": ma50, "slope_pct": slope_pct, "count": len(values)}


def analyze_kline_group(label: str, rows: Any, *, provider: str, endpoint: str, symbol: str,
                        fetched_at: datetime | None = None, freshness_limit: int = 21600) -> dict:
    fetched = fetched_at or utc_now()
    try:
        candles = parse_closed_klines(rows, now=fetched)
    except ValueError as exc:
        return evidence(label, provider=provider, endpoint=endpoint, symbols=[symbol], fetched_at=iso_time(fetched), error=str(exc))
    values = [row["close"] for row in candles]
    signal, value = _signal_from_series(values)
    observed = candles[-1]["close_time"] / 1000 if candles else None
    freshness = int(fetched.timestamp() - observed) if observed else None
    status = "UNKNOWN" if signal == "UNKNOWN" else "PASS" if freshness is not None and freshness <= freshness_limit else "STALE" if freshness is not None else "UNKNOWN"
    return evidence(label, value={"analysis": value, "closed_candles": len(candles)}, signal=signal, status=status,
                    provider=provider, endpoint=endpoint, symbols=[symbol], observed_at=iso_time(datetime.fromtimestamp(observed, timezone.utc)) if observed else None,
                    fetched_at=iso_time(fetched), freshness_seconds=freshness,
                    notes=[] if status == "PASS" else ["Chỉ dùng nến đã đóng", "Thiếu hoặc stale dữ liệu"])


def analyze_eth_btc(d1_rows: Any, h4_rows: Any, *, fetched_at: datetime | None = None) -> dict:
    fetched = fetched_at or utc_now()
    results = [analyze_kline_group("ETH/BTC D1", d1_rows, provider="Binance", endpoint="/api/v3/klines", symbol="ETHBTC", fetched_at=fetched),
               analyze_kline_group("ETH/BTC 4H", h4_rows, provider="Binance", endpoint="/api/v3/klines", symbol="ETHBTC", fetched_at=fetched)]
    signals = {item["signal"] for item in results if item["status"] == "PASS"}
    if len(signals) > 1 and {"BULLISH", "BEARISH"}.issubset(signals):
        signal, status = "CONFLICT", "CONFLICT"
    elif not signals:
        signal, status = "UNKNOWN", "UNKNOWN"
    else:
        signal, status = next(iter(signals)), "PASS" if all(item["status"] == "PASS" for item in results) else "UNKNOWN"
    return evidence("ETH/BTC trend", value={"d1": results[0], "4h": results[1]}, signal=signal, status=status,
                    provider="Binance", endpoint="/api/v3/klines", symbols=["ETHBTC"], fetched_at=iso_time(fetched),
                    notes=["D1 và 4H được đánh giá riêng"])


def analyze_global(data: Any, *, fetched_at: datetime | None = None) -> tuple[dict, dict]:
    fetched = fetched_at or utc_now()
    if not isinstance(data, dict):
        unknown = evidence("BTC Dominance", provider="CoinGecko", endpoint="/global", fetched_at=iso_time(fetched), error="Global payload is not an object")
        return unknown, unknown.copy()
    dominance = data.get("market_cap_percentage", {})
    total_cap = data.get("total_market_cap", {}).get("usd") if isinstance(data.get("total_market_cap"), dict) else None
    btc = dominance.get("btc") if isinstance(dominance, dict) else None
    eth = dominance.get("eth") if isinstance(dominance, dict) else None
    try:
        btc, eth, total_cap = float(btc), float(eth), float(total_cap)
        if not (0 <= btc <= 100 and 0 <= eth <= 100 and btc + eth <= 100 and total_cap > 0):
            raise ValueError("Invalid dominance or total market cap")
    except (TypeError, ValueError):
        error = evidence("BTC Dominance", provider="CoinGecko", endpoint="/global", fetched_at=iso_time(fetched), error="Invalid dominance/market cap schema")
        return error, error.copy()
    dominance_evidence = evidence("BTC Dominance", value={"btc_pct": btc, "eth_pct": eth}, signal="UNKNOWN", status="UNKNOWN",
                                   provider="CoinGecko", endpoint="/global", symbols=[], fetched_at=iso_time(fetched),
                                   notes=["Chỉ có snapshot; chưa có history để xác định trend"])
    total3 = total_cap * (1 - (btc + eth) / 100)
    total3_evidence = evidence("TOTAL3 proxy", value={"total_market_cap_usd": total_cap, "btc_dominance_pct": btc, "eth_dominance_pct": eth,
                                                       "total3_proxy_usd": total3, "formula": "total_market_cap_usd × (1 - BTC.D - ETH.D)"},
                                signal="UNKNOWN", status="UNKNOWN", provider="CoinGecko", endpoint="/global", fetched_at=iso_time(fetched),
                                notes=["TOTAL3_PROXY là snapshot; chưa có historical trend"])
    return dominance_evidence, total3_evidence


def analyze_breadth_and_volume(dataset: dict[str, list], *, fetched_at: datetime | None = None,
                               min_coverage_pct: float = 60.0) -> tuple[dict, dict]:
    fetched = fetched_at or utc_now()
    valid, above, volumes = 0, 0, []
    errors = []
    for symbol, rows in dataset.items():
        try:
            candles = parse_closed_klines(rows, now=fetched)
        except ValueError as exc:
            errors.append({"symbol": symbol, "error": str(exc)})
            continue
        closes = [row["close"] for row in candles]
        if len(closes) >= 20:
            valid += 1
            if closes[-1] > _sma(closes, 20):
                above += 1
        if len(candles) >= 8:
            daily = [row["volume"] for row in candles[-8:]]
            volumes.append({"symbol": symbol, "latest_closed": daily[-1], "previous_7_avg": sum(daily[:-1]) / 7})
    coverage = (valid / len(dataset) * 100) if dataset else 0
    breadth_pct = (above / valid * 100) if valid else None
    breadth_status = "PASS" if valid and coverage >= min_coverage_pct else "UNKNOWN"
    breadth_signal = "BULLISH" if breadth_pct is not None and breadth_pct >= 60 else "BEARISH" if breadth_pct is not None and breadth_pct < 40 else "NEUTRAL" if breadth_pct is not None else "UNKNOWN"
    breadth = evidence("Breadth MA20", value={"above_ma20": above, "valid": valid, "eligible": len(dataset), "breadth_pct": breadth_pct, "coverage_pct": coverage},
                        signal=breadth_signal, status=breadth_status, provider="Binance", endpoint="/api/v3/klines", symbols=list(dataset), fetched_at=iso_time(fetched),
                        notes=errors[:20] + (["Coverage dưới ngưỡng"] if breadth_status != "PASS" else []))
    ratios = [(row["latest_closed"] / row["previous_7_avg"]) for row in volumes if row["previous_7_avg"] > 0]
    ratio = sum(ratios) / len(ratios) if ratios else None
    volume_signal = "BULLISH" if ratio is not None and ratio >= 1.1 else "BEARISH" if ratio is not None and ratio <= 0.9 else "NEUTRAL" if ratio is not None else "UNKNOWN"
    volume_status = "PASS" if ratios and len(ratios) / len(dataset or {"_": []}) * 100 >= min_coverage_pct else "UNKNOWN"
    volume = evidence("Alt Volume 7D", value={"sample_count": len(ratios), "eligible": len(dataset), "coverage_pct": (len(ratios) / len(dataset) * 100 if dataset else 0), "latest_vs_previous_7d_ratio": ratio},
                       signal=volume_signal, status=volume_status, provider="Binance", endpoint="/api/v3/klines", symbols=list(dataset), fetched_at=iso_time(fetched), notes=errors[:20])
    return breadth, volume


def compute_completeness(groups: dict[str, dict]) -> dict:
    pass_count = sum(group.get("status") == "PASS" for group in groups.values())
    missing = [key for key, group in groups.items() if group.get("status") == "UNKNOWN"]
    stale = [key for key, group in groups.items() if group.get("status") == "STALE"]
    conflict = [key for key, group in groups.items() if group.get("status") == "CONFLICT"]
    core_missing = [key for key in CORE_GROUP_KEYS if groups.get(key, {}).get("status") != "PASS"]
    if not core_missing and all(groups.get(key, {}).get("status") == "PASS" for key in GROUP_KEYS):
        status, confidence = "FINAL", "HIGH"
    elif not core_missing and groups.get("macro_event_risk", {}).get("status") == "UNKNOWN":
        status, confidence = "FINAL", "MEDIUM"
    elif len(core_missing) >= 3:
        status, confidence = "PROVISIONAL", "LOW"
    else:
        status, confidence = "PROVISIONAL", "MEDIUM"
    return {"pass_count": pass_count, "total_count": len(GROUP_KEYS), "percentage": round(pass_count / len(GROUP_KEYS) * 100, 2),
            "missing": missing, "stale": stale, "conflict": conflict, "core_missing": core_missing, "status": status, "confidence": confidence}


def classify_regime(groups: dict[str, dict], completeness: dict) -> tuple[str, list[str]]:
    signals = [groups[key].get("signal") for key in CORE_GROUP_KEYS]
    reasons = []
    if groups.get("btc_d1", {}).get("signal") == "BEARISH" and groups.get("btc_4h", {}).get("signal") == "BEARISH":
        return "XẤU", ["BTC D1 và 4H cùng bearish"]
    if groups.get("btc_dominance", {}).get("signal") == "BEARISH" and groups.get("eth_btc", {}).get("signal") == "BEARISH":
        return "XẤU", ["BTC.D và ETH/BTC cùng bất lợi"]
    bullish = signals.count("BULLISH")
    bearish = signals.count("BEARISH")
    if completeness["core_missing"] or groups.get("total3_proxy", {}).get("status") != "PASS":
        reasons.append("Thiếu hoặc chưa xác minh đủ nhóm core")
    if bearish > bullish or bullish < 4:
        return "TRUNG TÍNH", reasons + [f"Tín hiệu bullish/bearish: {bullish}/{bearish}"]
    return "THUẬN LỢI", reasons + [f"Tín hiệu bullish/bearish: {bullish}/{bearish}"]


def universe_hash(symbols: Iterable[str]) -> str:
    return sha256(json.dumps(sorted(set(symbols)), separators=(",", ":")).encode()).hexdigest()[:16]
