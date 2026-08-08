from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
import json
from typing import Any, Iterable

GROUP_KEYS = ("btc_d1", "btc_4h", "eth_d1_4h", "btc_dominance", "eth_btc", "total3_proxy", "breadth_ma20", "alt_volume_7d", "macro_event_risk")
CORE_GROUP_KEYS = GROUP_KEYS[:8]
DEFAULT_THRESHOLDS = {"trend_slope_pct": 0.15, "breadth_min_coverage_pct": 60.0, "volume_min_coverage_pct": 60.0, "freshness_seconds": {"4h": 21600, "1d": 108000, "global_daily": 129600}, "history_min_points": 50, "history_request_points": 90, "batch_concurrency": 4}

def utc_now() -> datetime: return datetime.now(timezone.utc)
def iso_time(value: datetime | None = None) -> str: return (value or utc_now()).astimezone(timezone.utc).isoformat()

def freshness_limit(config: dict, timeframe: str) -> int:
    """Read v2 freshness while keeping legacy scalar snapshots safe for daily candles."""
    value = config.get("freshness_seconds", DEFAULT_THRESHOLDS["freshness_seconds"])
    if isinstance(value, dict):
        aliases = {"1d": ("1d", "daily", "kline"), "4h": ("4h", "kline"), "global_daily": ("global_daily", "global")}
        for key in aliases.get(timeframe, (timeframe,)):
            if value.get(key) is not None: return int(value[key])
    # A legacy 6h scalar was only appropriate for intraday data.
    return int(DEFAULT_THRESHOLDS["freshness_seconds"].get(timeframe, value if isinstance(value, (int, float)) else 21600))

def evidence(label: str, *, value: Any = None, signal: str = "UNKNOWN", status: str = "UNKNOWN", provider: str | None = None, endpoint: str | None = None, symbols: list[str] | None = None, observed_at: str | None = None, fetched_at: str | None = None, freshness_seconds: int | None = None, error: str | None = None, notes: list[Any] | None = None) -> dict:
    return {"label": label, "value": value, "signal": signal, "status": status, "source": {"provider": provider, "endpoint": endpoint, "symbols": symbols or []}, "observed_at": observed_at, "fetched_at": fetched_at, "freshness_seconds": freshness_seconds, "error": error, "notes": notes or []}

def parse_closed_klines(rows: Any, *, now: datetime | None = None) -> list[dict]:
    if not isinstance(rows, list): raise ValueError("Kline payload is not a list")
    now_ms, parsed = int((now or utc_now()).timestamp() * 1000), []
    for row in rows:
        if not isinstance(row, (list, tuple)) or len(row) < 8: continue
        try:
            values = {"open": float(row[1]), "high": float(row[2]), "low": float(row[3]), "close": float(row[4]), "base_volume": float(row[5]), "quote_volume": float(row[7])}
            open_time, close_time = int(row[0]), int(row[6])
        except (TypeError, ValueError): continue
        if close_time <= now_ms and values["close"] > 0 and values["high"] > 0:
            parsed.append({"open_time": open_time, "close_time": close_time, **values})
    return parsed

def _sma(values: list[float], period: int) -> float | None: return sum(values[-period:]) / period if len(values) >= period else None

def _signal_from_series(values: list[float], *, slope_threshold_pct: float = 0.15) -> tuple[str, dict]:
    if len(values) < 50: return "UNKNOWN", {"reason": "INSUFFICIENT_HISTORY", "count": len(values)}
    last, ma20, ma50, previous = values[-1], _sma(values, 20), _sma(values, 50), values[-20]
    slope_pct = ((last - previous) / abs(previous) * 100) if previous else None
    if ma20 is None or ma50 is None or slope_pct is None: return "UNKNOWN", {"reason": "INSUFFICIENT_INDICATORS"}
    signal = "BULLISH" if last > ma20 >= ma50 and slope_pct >= slope_threshold_pct else "BEARISH" if last < ma20 <= ma50 and slope_pct <= -slope_threshold_pct else "NEUTRAL"
    return signal, {"last": last, "ma20": ma20, "ma50": ma50, "slope_pct": slope_pct, "count": len(values)}

def analyze_kline_group(label: str, rows: Any, *, provider: str, endpoint: str, symbol: str, fetched_at: datetime | None = None, freshness_limit: int = 21600) -> dict:
    fetched = fetched_at or utc_now()
    try: candles = parse_closed_klines(rows, now=fetched)
    except ValueError as exc: return evidence(label, provider=provider, endpoint=endpoint, symbols=[symbol], fetched_at=iso_time(fetched), error=str(exc))
    signal, value = _signal_from_series([x["close"] for x in candles])
    observed = candles[-1]["close_time"] / 1000 if candles else None
    age = int(fetched.timestamp() - observed) if observed else None
    status = "UNKNOWN" if signal == "UNKNOWN" else "PASS" if age is not None and age <= freshness_limit else "STALE"
    return evidence(label, value={"analysis": value, "closed_candles": len(candles)}, signal=signal, status=status, provider=provider, endpoint=endpoint, symbols=[symbol], observed_at=iso_time(datetime.fromtimestamp(observed, timezone.utc)) if observed else None, fetched_at=iso_time(fetched), freshness_seconds=age, notes=[] if status == "PASS" else ["Chỉ dùng nến đã đóng", "Thiếu hoặc stale dữ liệu"])

def combine_timeframe_evidence(label: str, d1: dict, h4: dict, *, provider: str = "Binance", symbol: str = "") -> dict:
    if d1["status"] != "PASS" or h4["status"] != "PASS": signal, status = "UNKNOWN", "UNKNOWN"
    else:
        pair = (d1["signal"], h4["signal"])
        if pair == ("BULLISH", "BULLISH"): signal, status = "BULLISH", "PASS"
        elif pair == ("BEARISH", "BEARISH"): signal, status = "BEARISH", "PASS"
        elif pair == ("NEUTRAL", "NEUTRAL"): signal, status = "NEUTRAL", "PASS"
        elif "NEUTRAL" in pair: signal, status = "NEUTRAL", "PASS"
        else: signal, status = "CONFLICT", "CONFLICT"
    return evidence(label, value={"d1": d1, "4h": h4}, signal=signal, status=status, provider=provider, endpoint="/api/v3/klines", symbols=[symbol] if symbol else [], fetched_at=d1.get("fetched_at"), notes=["D1 và 4H được đánh giá theo ma trận deterministic"])

def analyze_eth_btc(d1_rows: Any, h4_rows: Any, *, fetched_at: datetime | None = None, d1_freshness: int = 108000, h4_freshness: int = 21600) -> dict:
    fetched = fetched_at or utc_now()
    d1 = analyze_kline_group("ETH/BTC D1", d1_rows, provider="Binance", endpoint="/api/v3/klines", symbol="ETHBTC", fetched_at=fetched, freshness_limit=d1_freshness)
    h4 = analyze_kline_group("ETH/BTC 4H", h4_rows, provider="Binance", endpoint="/api/v3/klines", symbol="ETHBTC", fetched_at=fetched, freshness_limit=h4_freshness)
    return combine_timeframe_evidence("ETH/BTC trend", d1, h4, symbol="ETHBTC")

def total3_proxy(total_cap: float, btc: float, eth: float) -> float: return total_cap * (1 - btc / 100 - eth / 100)

def parse_cmc_history(rows: Any) -> list[dict]:
    """Strictly parse CMC points; no entitlement or schema is treated as history."""
    if not isinstance(rows, list): return []
    points = []
    for row in rows:
        try:
            quote = row["quote"]["USD"]
            observed = datetime.fromisoformat(str(row["timestamp"]).replace("Z", "+00:00"))
            btc, eth, total = float(row["btc_dominance"]), float(row["eth_dominance"]), float(quote["total_market_cap"])
            if not (0 <= btc <= 100 and 0 <= eth <= 100 and btc + eth <= 100 and total > 0): raise ValueError()
            points.append({"provider": "CoinMarketCap", "observed_at": observed.astimezone(timezone.utc), "btc_dominance_pct": btc, "eth_dominance_pct": eth, "total_market_cap_usd": total, "total3_proxy_usd": total3_proxy(total, btc, eth), "source_endpoint": "/v1/global-metrics/quotes/historical"})
        except (KeyError, TypeError, ValueError):
            continue
    return points

def analyze_global(data: Any, *, fetched_at: datetime | None = None, provider: str = "CoinGecko", endpoint: str = "/global") -> tuple[dict, dict, dict | None]:
    fetched = fetched_at or utc_now()
    try:
        dominance, cap = data["market_cap_percentage"], data["total_market_cap"]["usd"]
        btc, eth, cap = float(dominance["btc"]), float(dominance["eth"]), float(cap)
        observed = datetime.fromtimestamp(float(data.get("updated_at")), timezone.utc) if data.get("updated_at") else fetched
        if not 0 <= btc <= 100 or not 0 <= eth <= 100 or btc + eth > 100 or cap <= 0: raise ValueError()
    except (KeyError, TypeError, ValueError):
        unknown = evidence("BTC Dominance", provider=provider, endpoint=endpoint, fetched_at=iso_time(fetched), error="Invalid global snapshot schema")
        return unknown, evidence("TOTAL3 proxy", provider=provider, endpoint=endpoint, fetched_at=iso_time(fetched), error="Invalid global snapshot schema"), None
    point = {"provider": provider, "observed_at": observed, "btc_dominance_pct": btc, "eth_dominance_pct": eth, "total_market_cap_usd": cap, "total3_proxy_usd": total3_proxy(cap, btc, eth), "source_endpoint": endpoint}
    common = {"provider": provider, "endpoint": endpoint, "fetched_at": iso_time(fetched), "observed_at": iso_time(observed)}
    return evidence("BTC Dominance", value={"btc_pct": btc, "eth_pct": eth}, signal="UNKNOWN", **common, notes=["Snapshot đã lưu; trend yêu cầu lịch sử cùng provider"]), evidence("TOTAL3_PROXY", value={**point, "formula": "total_market_cap_usd × (1 - BTC.D - ETH.D)"}, signal="UNKNOWN", **common, notes=["TOTAL3_PROXY, không phải TradingView TOTAL3"]), point

def analyze_coinpaprika_global(data: Any, *, fetched_at: datetime | None = None) -> tuple[dict, dict, dict | None]:
    fetched = fetched_at or utc_now()
    try:
        btc, cap = float(data["bitcoin_dominance_percentage"]), float(data["market_cap_usd"])
        observed = datetime.fromisoformat(str(data["last_updated"]).replace("Z", "+00:00")).astimezone(timezone.utc)
        if not 0 <= btc <= 100 or cap <= 0: raise ValueError()
    except (KeyError, TypeError, ValueError):
        unknown = evidence("BTC Dominance", provider="CoinPaprika", endpoint="/global", fetched_at=iso_time(fetched), error="Invalid CoinPaprika global schema")
        return unknown, evidence("TOTAL3_PROXY", provider="CoinPaprika", endpoint="/global", fetched_at=iso_time(fetched), error="ETH dominance unavailable"), None
    point = {"provider": "CoinPaprika", "observed_at": observed, "btc_dominance_pct": btc, "eth_dominance_pct": None, "total_market_cap_usd": cap, "total3_proxy_usd": None, "source_endpoint": "/global"}
    return evidence("BTC Dominance", value={"btc_pct": btc}, signal="UNKNOWN", provider="CoinPaprika", endpoint="/global", observed_at=iso_time(observed), fetched_at=iso_time(fetched), notes=["CoinPaprika không cung cấp ETH.D; chỉ dùng BTC.D"]), evidence("TOTAL3_PROXY", provider="CoinPaprika", endpoint="/global", observed_at=iso_time(observed), fetched_at=iso_time(fetched), error="Không có ETH dominance để tính TOTAL3_PROXY"), point

def analyze_history(label: str, points: list[dict], field: str, *, provider: str, freshness: int, min_points: int = 50, fetched_at: datetime | None = None, alt_perspective: bool = False) -> dict:
    """Resample to one deterministic UTC point per provider day before analysis."""
    fetched = fetched_at or utc_now()
    daily = {}
    for point in sorted(points, key=lambda item: item["observed_at"]):
        observed = point["observed_at"].astimezone(timezone.utc)
        if point.get(field) is not None:
            daily[observed.date()] = {**point, "observed_at": observed}
    ordered = [daily[key] for key in sorted(daily)]
    values = [float(point[field]) for point in ordered]
    if len(values) < min_points:
        signal, value = "UNKNOWN", {"reason": "INSUFFICIENT_DAILY_HISTORY", "count": len(values), "min_points": min_points}
    else:
        signal, value = _signal_from_series(values)
    latest = ordered[-1]["observed_at"] if ordered else None
    age = int((fetched - latest).total_seconds()) if latest else None
    status = "UNKNOWN" if signal == "UNKNOWN" else "PASS" if age is not None and age <= freshness else "STALE"
    raw = {"BULLISH": "RISING", "BEARISH": "FALLING", "NEUTRAL": "FLAT", "UNKNOWN": "UNKNOWN"}[signal]
    normalized = {"RISING": "BEARISH", "FALLING": "BULLISH", "FLAT": "NEUTRAL", "UNKNOWN": "UNKNOWN"}[raw] if alt_perspective else signal
    value.update({"trend": raw if alt_perspective else signal, "history_points": len(values)})
    if alt_perspective: value["signal_perspective"] = "ALTCOIN"
    return evidence(label, value=value, signal=normalized, status=status, provider=provider, endpoint="local-history", observed_at=iso_time(latest) if latest else None, fetched_at=iso_time(fetched), freshness_seconds=age, notes=["Chỉ dùng lịch sử cùng provider"])

def analyze_breadth_and_volume(dataset: dict[str, list], *, eligible_symbols: Iterable[str] | None = None, fetched_at: datetime | None = None, breadth_min_coverage_pct: float = 60.0, volume_min_coverage_pct: float = 60.0) -> tuple[dict, dict]:
    fetched, requested = fetched_at or utc_now(), list(dict.fromkeys(eligible_symbols or dataset.keys()))
    valid_breadth = above = valid_volume = 0; ratios = []; errors = []
    for symbol in requested:
        try: candles = parse_closed_klines(dataset.get(symbol, []), now=fetched)
        except ValueError as exc: errors.append({"symbol": symbol, "error": str(exc)}); continue
        closes = [x["close"] for x in candles]
        if len(closes) >= 20:
            valid_breadth += 1; above += closes[-1] > _sma(closes, 20)
        if len(candles) >= 8:
            quote = [x["quote_volume"] for x in candles[-8:]]
            if sum(quote[:-1]) > 0: valid_volume += 1; ratios.append(quote[-1] / (sum(quote[:-1]) / 7))
    count, fetched_count = len(requested), len(dataset)
    def coverage(n): return n / count * 100 if count else 0
    breadth_pct = above / valid_breadth * 100 if valid_breadth else None
    breadth = evidence("Breadth MA20", value={"requested": count, "fetched": fetched_count, "valid": valid_breadth, "failed": max(0, count - valid_breadth), "eligible": count, "above_ma20": above, "breadth_pct": breadth_pct, "coverage_pct": coverage(valid_breadth)}, signal="BULLISH" if breadth_pct is not None and breadth_pct >= 60 else "BEARISH" if breadth_pct is not None and breadth_pct < 40 else "NEUTRAL" if breadth_pct is not None else "UNKNOWN", status="PASS" if valid_breadth and coverage(valid_breadth) >= breadth_min_coverage_pct else "UNKNOWN", provider="Binance", endpoint="/api/v3/klines", symbols=requested, fetched_at=iso_time(fetched), notes=errors[:20])
    ratio = sum(ratios) / len(ratios) if ratios else None
    volume = evidence("Alt Volume 7D", value={"requested": count, "fetched": fetched_count, "valid": valid_volume, "sample_count": len(ratios), "failed": max(0, count - valid_volume), "eligible": count, "coverage_pct": coverage(valid_volume), "latest_vs_previous_7d_ratio": ratio, "volume_unit": "USDT_QUOTE_NOTIONAL"}, signal="BULLISH" if ratio is not None and ratio >= 1.1 else "BEARISH" if ratio is not None and ratio <= .9 else "NEUTRAL" if ratio is not None else "UNKNOWN", status="PASS" if ratios and coverage(valid_volume) >= volume_min_coverage_pct else "UNKNOWN", provider="Binance", endpoint="/api/v3/klines", symbols=requested, fetched_at=iso_time(fetched), notes=errors[:20])
    return breadth, volume

def compute_completeness(groups: dict[str, dict]) -> dict:
    passed = sum(x.get("status") == "PASS" for x in groups.values()); missing = [k for k,x in groups.items() if x.get("status") == "UNKNOWN"]; stale = [k for k,x in groups.items() if x.get("status") == "STALE"]; conflict = [k for k,x in groups.items() if x.get("status") == "CONFLICT"]; core = [k for k in CORE_GROUP_KEYS if groups.get(k, {}).get("status") != "PASS"]
    status, confidence = ("FINAL", "HIGH") if not core and not missing else ("FINAL", "MEDIUM") if not core and missing == ["macro_event_risk"] else ("PROVISIONAL", "LOW") if len(core) >= 3 else ("PROVISIONAL", "MEDIUM")
    return {"pass_count": passed, "total_count": len(GROUP_KEYS), "percentage": round(passed / len(GROUP_KEYS) * 100, 2), "missing": missing, "stale": stale, "conflict": conflict, "core_missing": core, "status": status, "confidence": confidence}

def classify_regime(groups: dict[str, dict], completeness: dict) -> tuple[str, list[str]]:
    if groups.get("btc_d1", {}).get("signal") == groups.get("btc_4h", {}).get("signal") == "BEARISH": return "XẤU", ["BTC D1 và 4H cùng bearish"]
    if groups.get("btc_dominance", {}).get("signal") == groups.get("eth_btc", {}).get("signal") == "BEARISH": return "XẤU", ["BTC.D tăng và ETH/BTC giảm bất lợi cho altcoin"]
    signals = [groups[k].get("signal") for k in CORE_GROUP_KEYS]; bullish, bearish = signals.count("BULLISH"), signals.count("BEARISH")
    return ("TRUNG TÍNH" if completeness["core_missing"] or bearish > bullish or bullish < 4 else "THUẬN LỢI", (["Thiếu hoặc chưa xác minh đủ nhóm core"] if completeness["core_missing"] else []) + [f"Tín hiệu bullish/bearish: {bullish}/{bearish}"])

def universe_hash(symbols: Iterable[str]) -> str: return sha256(json.dumps(sorted(set(symbols)), separators=(",", ":")).encode()).hexdigest()[:16]
