from __future__ import annotations
from dataclasses import dataclass
from decimal import Decimal
from hashlib import sha256
from pathlib import Path
from typing import Any
from datetime import datetime, timezone
import json
import math
import random
import statistics
import time
import httpx
from django.conf import settings

STABLE_SYMBOLS = {"USDT","USDC","DAI","FDUSD","TUSD","USDE","USDS","FRAX","PYUSD","USD1","BUSD","GUSD","LUSD","EURC","RLUSD"}
STABLE_WORDS = ("stablecoin", "usd coin", "tether", "dai", "first digital usd", "paypal usd")
TOKENIZED_STOCK_WORDS = ("tokenized stock", "tokenised stock", "bstocks", "xstocks")
BRIDGED_WORDS = ("bridged", "wormhole", "multichain")
LST_WORDS = ("liquid staking", "staked ether", "staked eth")

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
        self.request_stats = {"attempts": 0, "retries": 0, "errors": 0, "hosts": {}, "fallbacks": 0}
        self._client = httpx.Client(timeout=httpx.Timeout(self.timeout), headers=self.headers, follow_redirects=True, limits=httpx.Limits(max_connections=12, max_keepalive_connections=8))

    def close(self):
        self._client.close()

    def __enter__(self): return self
    def __exit__(self, *_args): self.close()

    def _get(self, url: str, params: dict | None = None, *, max_attempts: int | None = None) -> Any:
        max_attempts = max_attempts or max(1, settings.HTTP_MAX_RETRIES)
        for attempt in range(max_attempts):
            self.request_stats["attempts"] += 1
            try:
                response = self._client.get(url, params=params)
                response.raise_for_status()
                payload = response.json()
                if payload is None: raise ValueError("Empty JSON payload")
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

    def _binance_get(self, path: str, params: dict | None = None) -> Any:
        """One bounded retry budget across hosts: no retry storm per fallback host."""
        hosts = settings.BINANCE_MARKET_DATA_BASE_URLS
        attempts = max(1, settings.HTTP_MAX_RETRIES)
        last_error = None
        for index, host in enumerate(hosts[:attempts]):
            try:
                payload = self._get(f"{host}{path}", params, max_attempts=1)
                self.request_stats["hosts"][host] = self.request_stats["hosts"].get(host, 0) + 1
                if index: self.request_stats["fallbacks"] += 1
                return payload
            except DataSourceError as exc:
                last_error = exc
        raise DataSourceError(f"All Binance market-data hosts failed for {path}: {last_error}")

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
        return self._binance_get("/api/v3/exchangeInfo")

    def binance_klines(self, symbol: str, interval: str, limit: int = 220) -> list:
        return self._binance_get("/api/v3/klines", {"symbol":symbol,"interval":interval,"limit":limit})

    def binance_depth(self, symbol: str, limit: int = 1000) -> dict:
        return self._binance_get("/api/v3/depth", {"symbol":symbol,"limit":limit})

    def binance_24h_tickers(self) -> list[dict]:
        payload = self._binance_get("/api/v3/ticker/24hr")
        return payload if isinstance(payload, list) else []

    def defillama_protocols(self) -> list[dict]:
        payload = self._get(f"{settings.DEFILLAMA_BASE_URL}/protocols")
        return payload if isinstance(payload, list) else []

    def defillama_chains(self) -> list[dict]:
        payload = self._get(f"{settings.DEFILLAMA_BASE_URL}/v2/chains")
        return payload if isinstance(payload, list) else []

    def defillama_fees_overview(self, *, data_type: str | None = None) -> dict:
        params = {
            "excludeTotalDataChart": "true",
            "excludeTotalDataChartBreakdown": "true",
        }
        if data_type:
            params["dataType"] = data_type
        payload = self._get(f"{settings.DEFILLAMA_BASE_URL}/overview/fees", params)
        return payload if isinstance(payload, dict) else {}

    def defillama_dex_overview(self) -> dict:
        payload = self._get(
            f"{settings.DEFILLAMA_BASE_URL}/overview/dexs",
            {"excludeTotalDataChart": "true", "excludeTotalDataChartBreakdown": "true"},
        )
        return payload if isinstance(payload, dict) else {}

    def coinpaprika_global(self) -> dict:
        return self._get(f"{settings.COINPAPRIKA_BASE_URL}/global")

    def cmc_global_history(self, count: int) -> list[dict] | None:
        if not settings.CMC_HISTORICAL_ENABLED or not settings.CMC_API_KEY: return None
        try:
            payload = self._get(f"{settings.CMC_BASE_URL}/v1/global-metrics/quotes/historical", {"count": count, "interval": "daily"})
        except DataSourceError as exc:
            # Missing entitlement, plan restrictions and transient source failures are
            # evidence gaps, never a reason to fabricate or fail the whole step.
            self.request_stats["cmc_history"] = "NOT_ENTITLED_OR_UNAVAILABLE" if ("401" in str(exc) or "403" in str(exc)) else "UNAVAILABLE"
            return None
        return payload.get("data", []) if isinstance(payload, dict) else None


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
    if exclusions.get("tokenized_stock") and any(word in name for word in TOKENIZED_STOCK_WORDS):
        return True, "TOKENIZED_STOCK"
    if exclusions.get("bridged") and any(word in name for word in BRIDGED_WORDS):
        return True, "BRIDGED"
    if exclusions.get("lst") and any(word in name for word in LST_WORDS):
        return True, "LST"
    if exclusions.get("index") and "index" in name:
        return True, "INDEX"
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


def kline_summary(klines: list, *, now: datetime | None = None, freshness_seconds: int | None = None) -> dict:
    """Execution uses only closed candles and reports timestamp/freshness explicitly."""
    fetched = now or datetime.now(timezone.utc)
    now_ms = int(fetched.timestamp() * 1000)
    closed = []
    if not isinstance(klines, list):
        return {"status": "UNKNOWN", "reason": "INVALID_KLINE_PAYLOAD", "fetched_at": fetched.isoformat()}
    for row in klines:
        if not isinstance(row, (list, tuple)) or len(row) < 7:
            continue
        try:
            close_time = int(row[6])
            if close_time <= now_ms:
                closed.append(row)
        except (TypeError, ValueError):
            continue
    if not closed:
        return {"status": "UNKNOWN", "reason": "NO_CLOSED_CANDLES", "closed_candles": 0, "fetched_at": fetched.isoformat()}
    closes = [float(x[4]) for x in closed]
    last = closes[-1] if closes else None
    observed_at = datetime.fromtimestamp(int(closed[-1][6]) / 1000, timezone.utc)
    age = int((fetched - observed_at).total_seconds())
    status = "PASS" if freshness_seconds is None or age <= freshness_seconds else "STALE"
    return {
        "status": status,
        "reason": None if status == "PASS" else "STALE_CLOSED_CANDLE",
        "closed_candles": len(closed),
        "observed_at": observed_at.isoformat(),
        "fetched_at": fetched.isoformat(),
        "freshness_seconds": age,
        "last": last,
        "sma20": sma(closes, 20),
        "sma50": sma(closes, 50),
        "sma200": sma(closes, 200),
        "atr14": atr_from_klines(closed, 14),
        "above_sma20": bool(last and sma(closes, 20) and last > sma(closes, 20)),
        "above_sma50": bool(last and sma(closes, 50) and last > sma(closes, 50)),
    }


def depth_metrics(depth: dict, order_sizes_vnd: list[int], vnd_per_usd: float, *, spread_max_pct: float | None = None, slippage_max_pct: float | None = None, fetched_at: datetime | None = None) -> dict:
    fetched = fetched_at or datetime.now(timezone.utc)
    if not isinstance(depth, dict):
        return {"status":"UNKNOWN", "reason":"INVALID_DEPTH_PAYLOAD", "fetched_at": fetched.isoformat()}
    bids = [(float(p), float(q)) for p, q in depth.get("bids", [])]
    asks = [(float(p), float(q)) for p, q in depth.get("asks", [])]
    if not bids or not asks:
        return {"status":"UNKNOWN", "reason":"MISSING_BIDS_OR_ASKS", "fetched_at": fetched.isoformat()}
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

    slippage = {str(vnd): (None if (s:=slippage_buy(vnd/vnd_per_usd)) is None else round(s,5)) for vnd in order_sizes_vnd}
    blockers = []
    if spread_max_pct is not None and spread_pct > spread_max_pct:
        blockers.append("SPREAD_ABOVE_LIMIT")
    if slippage_max_pct is not None:
        for size, value in slippage.items():
            if value is None: blockers.append(f"INSUFFICIENT_ASK_DEPTH_{size}")
            elif value > slippage_max_pct: blockers.append(f"SLIPPAGE_ABOVE_LIMIT_{size}")
    return {
        "status":"FAIL" if blockers else "PASS",
        "reason": None if not blockers else ",".join(blockers),
        "observed_at": fetched.isoformat(),
        "fetched_at": fetched.isoformat(),
        "best_bid":best_bid,
        "best_ask":best_ask,
        "mid":mid,
        "spread_pct":round(spread_pct, 5),
        "depth_bid_0_5_usd":round(notional_within(bids, 0.5, "bid"), 2),
        "depth_ask_0_5_usd":round(notional_within(asks, 0.5, "ask"), 2),
        "depth_bid_1_usd":round(notional_within(bids, 1.0, "bid"), 2),
        "depth_ask_1_usd":round(notional_within(asks, 1.0, "ask"), 2),
        "slippage_buy_pct": slippage,
        "blockers": blockers,
    }


def research_prefilter(row: dict, config: dict) -> dict:
    """Cheap, deterministic pre-research screening.

    This function is intentionally *not* a V8.1 Quality Score.  It only uses
    fields available from the CoinGecko market snapshot and the configured
    universe/tokenomics/liquidity thresholds to decide which assets deserve
    deeper research next.  Missing Product/Value-Capture/Unlock evidence must
    never be converted into a synthetic Quality range.
    """
    mc = float(row.get("market_cap") or 0)
    vol = float(row.get("total_volume") or 0)
    fdv = float(row.get("fully_diluted_valuation") or 0)
    circulating = float(row.get("circulating_supply") or 0)
    total_supply = float(row.get("total_supply") or row.get("max_supply") or 0)

    preferred_min = float(config.get("market_cap_preferred_min_usd", config.get("market_cap_min_usd", 0)))
    preferred_max = float(config.get("market_cap_preferred_max_usd", config.get("market_cap_max_usd", 0)))
    market_max = float(config.get("market_cap_max_usd", 0))
    volume_basic = float(config.get("volume_basic_usd", 20_000_000))
    fdv_good = float(config.get("fdv_mc_good_max", 1.5))
    fdv_risk_high = float(config.get("fdv_mc_risk_high", 4.0))
    fdv_exclude = float(config.get("fdv_mc_exclude", 5.0))
    circulating_block = float(config.get("circulating_block_pct", 15))
    circulating_warn = float(config.get("circulating_warn_pct", 25))

    fdv_mc = fdv / mc if mc > 0 and fdv > 0 else None
    circulating_pct = circulating / total_supply * 100 if circulating > 0 and total_supply > 0 else None
    volume_mc_pct = vol / mc * 100 if mc > 0 else None

    if preferred_min <= mc <= preferred_max:
        market_cap_priority = "PRIORITY_A"
        market_cap_rank = 0
    elif mc <= min(900_000_000, market_max):
        market_cap_priority = "SUPPLEMENTARY"
        market_cap_rank = 1
    else:
        market_cap_priority = "PRIORITY_B"
        market_cap_rank = 2

    if fdv_mc is None:
        fdv_band, fdv_rank = "UNKNOWN", 2
    elif fdv_mc <= fdv_good:
        fdv_band, fdv_rank = "GOOD", 0
    elif fdv_mc <= 2.5:
        fdv_band, fdv_rank = "ACCEPTABLE", 1
    elif fdv_mc <= fdv_risk_high:
        fdv_band, fdv_rank = "RISK_HIGH", 3
    elif fdv_mc <= fdv_exclude:
        fdv_band, fdv_rank = "VERY_HIGH", 4
    else:
        fdv_band, fdv_rank = "EXCLUDE", 5

    if circulating_pct is None:
        circulating_band, circulating_rank = "UNKNOWN", 2
    elif circulating_pct < circulating_block:
        circulating_band, circulating_rank = "BLOCKED", 5
    elif circulating_pct < circulating_warn:
        circulating_band, circulating_rank = "WATCH_RISK", 3
    elif circulating_pct >= 60:
        circulating_band, circulating_rank = "GOOD", 0
    else:
        circulating_band, circulating_rank = "ACCEPTABLE", 1

    if vol >= max(volume_basic * 2, 50_000_000):
        liquidity_band, liquidity_rank = "STRONG", 0
    elif vol >= volume_basic:
        liquidity_band, liquidity_rank = "GOOD", 1
    else:
        liquidity_band, liquidity_rank = "BASIC", 2

    if volume_mc_pct is None:
        volume_mc_band, volume_mc_rank = "UNKNOWN", 2
    elif 3 <= volume_mc_pct <= 15:
        volume_mc_band, volume_mc_rank = "PREFERRED", 0
    elif 1 <= volume_mc_pct <= 30:
        volume_mc_band, volume_mc_rank = "ACCEPTABLE", 1
    else:
        volume_mc_band, volume_mc_rank = "OUTSIDE_PREFERRED", 2

    decision = "ELIGIBLE"
    risk_codes: list[str] = []
    reasons: list[str] = []

    # FDV/MC > 5 only becomes TOK-08/EXCLUDE when unlock is also verified as
    # unclear. Universe prefilter has not consulted the unlock evidence engine
    # yet, so it must not manufacture that second condition. Deprioritize and
    # carry TOK-07 for later execution verification instead.
    if fdv_mc is not None and fdv_mc > fdv_exclude:
        risk_codes.append("TOK-07")
        reasons.append("FDV/MC > 5; cần xác minh unlock trước khi áp TOK-08")
    elif fdv_mc is not None and fdv_mc > fdv_risk_high:
        risk_codes.append("TOK-07")
        reasons.append("FDV/MC > 4")

    # V8.1 Hard Rule: circulating < 15% is BLOCKED (unless an explicitly
    # verified exception exists; there is no such exception in this snapshot).
    if circulating_pct is not None and circulating_pct < circulating_block and decision != "EXCLUDE":
        decision = "BLOCKED"
        risk_codes.append("TOK-05")
        reasons.append("Circulating < 15%")
    elif circulating_pct is not None and circulating_pct < circulating_warn:
        risk_codes.append("TOK-06")
        reasons.append("Circulating 15–25%")

    # The sort tuple follows V8.1 intent without inventing a Quality score:
    # hard state / dilution / circulating safety outrank the preferred MC bucket;
    # Market Cap is a preference, not a substitute for tokenomics/liquidity.
    decision_rank = {"ELIGIBLE": 0, "BLOCKED": 1, "EXCLUDE": 2}[decision]
    sort_key = [
        decision_rank,
        fdv_rank,
        circulating_rank,
        market_cap_rank,
        liquidity_rank,
        volume_mc_rank,
        -vol,
    ]

    return {
        "decision": decision,
        "risk_codes": risk_codes,
        "reasons": reasons,
        "market_cap_priority": market_cap_priority,
        "fdv_mc": round(fdv_mc, 4) if fdv_mc is not None else None,
        "fdv_band": fdv_band,
        "circulating_pct": round(circulating_pct, 4) if circulating_pct is not None else None,
        "circulating_band": circulating_band,
        "liquidity_band": liquidity_band,
        "volume_mc_pct": round(volume_mc_pct, 4) if volume_mc_pct is not None else None,
        "volume_mc_band": volume_mc_band,
        "sort_key": sort_key,
        "missing": [
            "product_metrics",
            "unlock_7d_30d_90d",
            "token_value_capture",
            "holder_treasury",
            "valuation_peers",
            "moat",
            "team_security",
            "verified_catalysts",
        ],
        "note": "Research prefilter only; not a V8.1 Quality Score.",
    }


def provisional_quality(row: dict, config: dict) -> tuple[None, None, dict]:
    """Backward-compatible wrapper kept for callers outside the orchestrator.

    V8.1 Evidence Integrity forbids creating a numeric Quality range from only
    MC/volume/FDV when critical Product/Unlock/Value-Capture evidence is E0.
    """
    return None, None, research_prefilter(row, config)
