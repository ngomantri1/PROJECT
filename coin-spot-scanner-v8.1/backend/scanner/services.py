from __future__ import annotations
from dataclasses import dataclass
from decimal import Decimal
from hashlib import sha256
from pathlib import Path
from typing import Any
import json
import math
import random
import statistics
import time
import httpx
from django.conf import settings

STABLE_SYMBOLS = {"USDT","USDC","DAI","FDUSD","TUSD","USDE","USDS","FRAX","PYUSD","USD1","BUSD","GUSD","LUSD","EURC","RLUSD"}
STABLE_WORDS = ("stablecoin", "usd coin", "tether", "dai", "first digital usd", "paypal usd")

STEP_DEFINITIONS = [
    (1, "UNIVERSE_SCAN", "Universe Scan"),
    (2, "MARKET_REGIME", "Market Regime"),
    (3, "RESEARCH_SHORTLIST", "Research Shortlist"),
    (4, "EXECUTION_VERIFICATION", "Execution Verification"),
    (5, "SCORING_VALIDATION", "Scoring & Validation"),
    (6, "INVESTMENT_RESULTS", "Kết quả đầu tư"),
]

class DataSourceError(RuntimeError):
    pass

class PublicMarketClient:
    def __init__(self):
        self.headers = {"User-Agent": settings.USER_AGENT, "Accept": "application/json"}
        self.timeout = settings.HTTP_TIMEOUT_SECONDS
        self.request_stats = {"attempts": 0, "retries": 0, "errors": 0}

    def _get(self, url: str, params: dict | None = None) -> Any:
        max_attempts = max(1, settings.HTTP_MAX_RETRIES)
        for attempt in range(max_attempts):
            self.request_stats["attempts"] += 1
            try:
                with httpx.Client(timeout=self.timeout, headers=self.headers, follow_redirects=True) as client:
                    response = client.get(url, params=params)
                    response.raise_for_status()
                    payload = response.json()
                    if payload is None:
                        raise ValueError("Empty JSON payload")
                    return payload
            except (httpx.HTTPError, ValueError) as exc:
                status_code = getattr(getattr(exc, "response", None), "status_code", None)
                retryable = isinstance(exc, (httpx.TimeoutException, httpx.NetworkError, httpx.RemoteProtocolError, ValueError)) or status_code in {408, 418, 429} or (status_code is not None and status_code >= 500)
                if not retryable or attempt >= max_attempts - 1:
                    self.request_stats["errors"] += 1
                    raise DataSourceError(f"Data source request failed for {url}: {exc}") from exc
                self.request_stats["retries"] += 1
                retry_after = getattr(getattr(exc, "response", None), "headers", {}).get("Retry-After")
                try:
                    delay = float(retry_after) if retry_after is not None else 0.25 * (2 ** attempt) + random.uniform(0, 0.1)
                except (TypeError, ValueError):
                    delay = 0.25 * (2 ** attempt) + random.uniform(0, 0.1)
                time.sleep(min(delay, settings.HTTP_MAX_RETRY_DELAY_SECONDS))

    def coingecko_markets(self, top_count: int) -> list[dict]:
        rows: list[dict] = []
        page = 1
        while len(rows) < top_count:
            remaining = top_count - len(rows)
            per_page = min(250, remaining)
            batch = self._get(
                f"{settings.COINGECKO_BASE_URL}/coins/markets",
                {"vs_currency":"usd","order":"market_cap_desc","per_page":per_page,"page":page,"sparkline":"false","price_change_percentage":"24h,7d"},
            )
            if not isinstance(batch, list) or not batch:
                break
            rows.extend(batch)
            page += 1
        return rows[:top_count]

    def coingecko_global(self) -> dict:
        data = self._get(f"{settings.COINGECKO_BASE_URL}/global")
        return data.get("data", {}) if isinstance(data, dict) else {}

    def binance_exchange_info(self) -> dict:
        return self._get(f"{settings.BINANCE_BASE_URL}/api/v3/exchangeInfo")

    def binance_klines(self, symbol: str, interval: str, limit: int = 220) -> list:
        return self._get(f"{settings.BINANCE_BASE_URL}/api/v3/klines", {"symbol":symbol,"interval":interval,"limit":limit})

    def binance_depth(self, symbol: str, limit: int = 1000) -> dict:
        return self._get(f"{settings.BINANCE_BASE_URL}/api/v3/depth", {"symbol":symbol,"limit":limit})


def default_config() -> dict:
    path = Path(settings.BASE_DIR) / "rules" / "v8_1" / "defaults.json"
    return json.loads(path.read_text(encoding="utf-8"))


def checksum_json(data: dict) -> str:
    raw = json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return sha256(raw).hexdigest()


def valid_binance_usdt_symbols(exchange_info: dict) -> dict[str, dict]:
    result = {}
    for row in exchange_info.get("symbols", []):
        if row.get("quoteAsset") != "USDT" or row.get("status") != "TRADING":
            continue
        permissions = set(row.get("permissions") or [])
        permission_sets = row.get("permissionSets") or []
        flattened = {item for subset in permission_sets for item in subset} if permission_sets else set()
        if permissions and "SPOT" not in permissions and "SPOT" not in flattened:
            continue
        result[str(row.get("baseAsset", "")).upper()] = row
    return result


def excluded_token(row: dict, config: dict) -> tuple[bool, str]:
    symbol = str(row.get("symbol", "")).upper()
    name = str(row.get("name", "")).lower()
    exclusions = config.get("exclude", {})
    if exclusions.get("stablecoin") and (symbol in STABLE_SYMBOLS or any(w in name for w in STABLE_WORDS)):
        return True, "STABLECOIN"
    if exclusions.get("wrapped") and (symbol.startswith("W") and name.startswith("wrapped")):
        return True, "WRAPPED"
    if exclusions.get("leveraged") and symbol.endswith(("UP", "DOWN", "BULL", "BEAR")):
        return True, "LEVERAGED"
    return False, ""


def sma(values: list[float], period: int) -> float | None:
    if len(values) < period:
        return None
    return sum(values[-period:]) / period


def true_range(high: float, low: float, previous_close: float) -> float:
    return max(high - low, abs(high - previous_close), abs(low - previous_close))


def atr_from_klines(klines: list, period: int = 14) -> float | None:
    if len(klines) < period + 1:
        return None
    trs = []
    for i in range(1, len(klines)):
        high, low, prev_close = float(klines[i][2]), float(klines[i][3]), float(klines[i-1][4])
        trs.append(true_range(high, low, prev_close))
    return sum(trs[-period:]) / period


def kline_summary(klines: list) -> dict:
    closes = [float(x[4]) for x in klines]
    last = closes[-1] if closes else None
    return {
        "last": last,
        "sma20": sma(closes, 20),
        "sma50": sma(closes, 50),
        "sma200": sma(closes, 200),
        "atr14": atr_from_klines(klines, 14),
        "above_sma20": bool(last and sma(closes, 20) and last > sma(closes, 20)),
        "above_sma50": bool(last and sma(closes, 50) and last > sma(closes, 50)),
    }


def depth_metrics(depth: dict, order_sizes_vnd: list[int], vnd_per_usd: float) -> dict:
    bids = [(float(p), float(q)) for p, q in depth.get("bids", [])]
    asks = [(float(p), float(q)) for p, q in depth.get("asks", [])]
    if not bids or not asks:
        return {"status":"UNKNOWN"}
    best_bid, best_ask = bids[0][0], asks[0][0]
    mid = (best_bid + best_ask) / 2
    spread_pct = ((best_ask - best_bid) / mid) * 100

    def notional_within(rows, pct, side):
        total = 0.0
        for price, qty in rows:
            distance = (mid - price) / mid * 100 if side == "bid" else (price - mid) / mid * 100
            if distance <= pct:
                total += price * qty
        return total

    def slippage_buy(usd_amount):
        remaining, spent, acquired = usd_amount, 0.0, 0.0
        for price, qty in asks:
            level_value = price * qty
            take = min(remaining, level_value)
            acquired += take / price
            spent += take
            remaining -= take
            if remaining <= 1e-9:
                break
        if remaining > 0 or acquired <= 0:
            return None
        avg = spent / acquired
        return (avg - best_ask) / best_ask * 100

    return {
        "status":"PASS",
        "best_bid":best_bid,
        "best_ask":best_ask,
        "mid":mid,
        "spread_pct":round(spread_pct, 5),
        "depth_bid_0_5_usd":round(notional_within(bids, 0.5, "bid"), 2),
        "depth_ask_0_5_usd":round(notional_within(asks, 0.5, "ask"), 2),
        "depth_bid_1_usd":round(notional_within(bids, 1.0, "bid"), 2),
        "depth_ask_1_usd":round(notional_within(asks, 1.0, "ask"), 2),
        "slippage_buy_pct": {str(vnd): (None if (s:=slippage_buy(vnd/vnd_per_usd)) is None else round(s,5)) for vnd in order_sizes_vnd},
    }


def provisional_quality(row: dict, config: dict) -> tuple[float, float, dict]:
    mc = float(row.get("market_cap") or 0)
    vol = float(row.get("total_volume") or 0)
    fdv = float(row.get("fully_diluted_valuation") or 0)
    cap_min = config["market_cap_min_usd"]
    preferred_max = config["market_cap_preferred_max_usd"]
    volume_basic = config.get("volume_basic_usd", 20_000_000)

    market_fit = 8 if cap_min <= mc <= preferred_max else 6
    liquidity = 8 if vol >= volume_basic * 2 else 7 if vol >= volume_basic else 5
    fdv_ratio = fdv / mc if mc and fdv else None
    tokenomics = 8 if fdv_ratio and fdv_ratio <= 1.5 else 6 if fdv_ratio and fdv_ratio <= 2.5 else 4 if fdv_ratio else 5
    base = (market_fit * 0.30 + liquidity * 0.35 + tokenomics * 0.35) * 10
    low = max(35, base - 14)
    high = min(82, base + 3)
    evidence = {"market_cap_fit":market_fit,"liquidity_proxy":liquidity,"fdv_mc_proxy":tokenomics,"fdv_mc":fdv_ratio,"missing":["product_metrics","unlock_7d_30d_90d","token_value_capture","holder_treasury"]}
    return round(low,1), round(high,1), evidence
