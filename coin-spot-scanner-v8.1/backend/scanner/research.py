from __future__ import annotations

from dataclasses import dataclass
from statistics import median
from typing import Any
import re


def _number(value: Any) -> float | None:
    try:
        if value in (None, ""):
            return None
        number = float(value)
        if number != number:  # NaN
            return None
        return number
    except (TypeError, ValueError):
        return None


def _norm(value: Any) -> str:
    text = str(value or "").strip().lower()
    return re.sub(r"[^a-z0-9]+", "", text)


def _first_number(row: dict, keys: tuple[str, ...]) -> float | None:
    for key in keys:
        value = _number(row.get(key))
        if value is not None:
            return value
    return None


def _rows(payload: Any) -> list[dict]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("protocols", "data", "rows"):
        value = payload.get(key)
        if isinstance(value, list):
            return [row for row in value if isinstance(row, dict)]
    return []


def _unique_index(rows: list[dict], key_builder) -> dict[str, dict]:
    grouped: dict[str, list[dict]] = {}
    for row in rows:
        key = key_builder(row)
        if key:
            grouped.setdefault(key, []).append(row)
    return {key: values[0] for key, values in grouped.items() if len(values) == 1}


@dataclass(frozen=True)
class DefiLlamaIndexes:
    protocols_by_gecko: dict[str, dict]
    protocols_by_symbol_name: dict[str, dict]
    chains_by_gecko: dict[str, dict]
    chains_by_symbol_name: dict[str, dict]
    fees_by_name: dict[str, dict]
    revenue_by_name: dict[str, dict]
    dex_by_name: dict[str, dict]
    protocols: list[dict]


def build_defillama_indexes(
    protocols_payload: Any,
    chains_payload: Any,
    fees_payload: Any,
    revenue_payload: Any,
    dex_payload: Any,
) -> DefiLlamaIndexes:
    protocols = _rows(protocols_payload)
    chains = _rows(chains_payload)
    fees = _rows(fees_payload)
    revenue = _rows(revenue_payload)
    dexs = _rows(dex_payload)

    def gecko_key(row: dict) -> str:
        return str(row.get("gecko_id") or row.get("geckoId") or "").strip().lower()

    def symbol_name_key(row: dict) -> str:
        symbol = _norm(row.get("symbol") or row.get("tokenSymbol"))
        name = _norm(row.get("name") or row.get("displayName"))
        return f"{symbol}:{name}" if symbol and name else ""

    def dimension_key(row: dict) -> str:
        for key in ("slug", "module", "name", "displayName", "protocol"):
            value = _norm(row.get(key))
            if value:
                return value
        return ""

    return DefiLlamaIndexes(
        protocols_by_gecko=_unique_index(protocols, gecko_key),
        protocols_by_symbol_name=_unique_index(protocols, symbol_name_key),
        chains_by_gecko=_unique_index(chains, gecko_key),
        chains_by_symbol_name=_unique_index(chains, symbol_name_key),
        fees_by_name=_unique_index(fees, dimension_key),
        revenue_by_name=_unique_index(revenue, dimension_key),
        dex_by_name=_unique_index(dexs, dimension_key),
        protocols=protocols,
    )


def _candidate_symbol_name(candidate) -> str:
    return f"{_norm(candidate.symbol)}:{_norm(candidate.name)}"


def _protocol_aliases(row: dict) -> list[str]:
    aliases: list[str] = []
    for key in ("slug", "module", "name", "displayName"):
        value = _norm(row.get(key))
        if value and value not in aliases:
            aliases.append(value)
    return aliases


def match_defillama(candidate, indexes: DefiLlamaIndexes) -> dict:
    gecko_id = str(candidate.coingecko_id or "").strip().lower()
    symbol_name = _candidate_symbol_name(candidate)

    protocol = indexes.protocols_by_gecko.get(gecko_id) if gecko_id else None
    protocol_method = "GECKO_ID" if protocol else None
    if protocol is None:
        protocol = indexes.protocols_by_symbol_name.get(symbol_name)
        protocol_method = "UNIQUE_SYMBOL_NAME" if protocol else None

    chain = indexes.chains_by_gecko.get(gecko_id) if gecko_id else None
    chain_method = "GECKO_ID" if chain else None
    if chain is None:
        chain = indexes.chains_by_symbol_name.get(symbol_name)
        chain_method = "UNIQUE_SYMBOL_NAME" if chain else None

    fee_row = revenue_row = dex_row = None
    if protocol:
        for alias in _protocol_aliases(protocol):
            fee_row = fee_row or indexes.fees_by_name.get(alias)
            revenue_row = revenue_row or indexes.revenue_by_name.get(alias)
            dex_row = dex_row or indexes.dex_by_name.get(alias)

    return {
        "protocol": protocol,
        "protocol_match_method": protocol_method,
        "chain": chain,
        "chain_match_method": chain_method,
        "fees": fee_row,
        "revenue": revenue_row,
        "dex": dex_row,
    }


def binance_ticker_map(payload: Any) -> dict[str, dict]:
    rows = payload if isinstance(payload, list) else []
    result: dict[str, dict] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        symbol = str(row.get("symbol") or "").upper()
        if symbol:
            result[symbol] = row
    return result


def _dimension_metric(row: dict | None, window: str) -> float | None:
    if not row:
        return None
    keysets = {
        "24h": ("total24h", "total24H", "daily", "dailyFees", "dailyRevenue"),
        "7d": ("total7d", "total7D", "weekly", "weeklyFees", "weeklyRevenue"),
        "30d": ("total30d", "total30D", "monthly", "monthlyFees", "monthlyRevenue"),
    }
    return _first_number(row, keysets[window])


def _peer_context(protocol: dict | None, all_protocols: list[dict], market_cap: float) -> dict:
    if not protocol:
        return {"status": "UNKNOWN", "evidence_level": "E0", "reason": "NO_DEFILLAMA_PROTOCOL_MATCH"}
    tvl = _number(protocol.get("tvl"))
    category = str(protocol.get("category") or "").strip()
    if not tvl or tvl <= 0 or market_cap <= 0 or not category:
        return {"status": "UNKNOWN", "evidence_level": "E1", "reason": "INSUFFICIENT_MCAP_TVL_PEER_DATA"}

    ratios: list[float] = []
    for peer in all_protocols:
        if str(peer.get("category") or "").strip() != category:
            continue
        peer_tvl = _number(peer.get("tvl"))
        peer_mcap = _number(peer.get("mcap"))
        if peer_tvl and peer_tvl > 0 and peer_mcap and peer_mcap > 0:
            ratios.append(peer_mcap / peer_tvl)
    if len(ratios) < 3:
        return {
            "status": "UNKNOWN",
            "evidence_level": "E1",
            "category": category,
            "mcap_tvl": round(market_cap / tvl, 4),
            "peer_count": len(ratios),
            "reason": "INSUFFICIENT_PEERS",
        }

    current = market_cap / tvl
    peer_median = median(ratios)
    return {
        "status": "PASS",
        "evidence_level": "E2",
        "category": category,
        "mcap_tvl": round(current, 4),
        "peer_median_mcap_tvl": round(peer_median, 4),
        "peer_count": len(ratios),
        "relative_to_peer_median": round(current / peer_median, 4) if peer_median > 0 else None,
        "note": "Valuation proxy only; not full V8.1 X2/X3 feasibility.",
    }


def build_research_evidence(candidate, prefilter: dict, ticker: dict | None, match: dict, indexes: DefiLlamaIndexes, fetched_at: str) -> dict:
    market_cap = float(candidate.market_cap_usd or 0)
    protocol = match.get("protocol")
    chain = match.get("chain")

    protocol_tvl = _number((protocol or {}).get("tvl"))
    chain_tvl = _number((chain or {}).get("tvl"))
    fees_24h = _dimension_metric(match.get("fees"), "24h")
    fees_7d = _dimension_metric(match.get("fees"), "7d")
    fees_30d = _dimension_metric(match.get("fees"), "30d")
    revenue_24h = _dimension_metric(match.get("revenue"), "24h")
    revenue_7d = _dimension_metric(match.get("revenue"), "7d")
    revenue_30d = _dimension_metric(match.get("revenue"), "30d")
    dex_volume_24h = _dimension_metric(match.get("dex"), "24h")
    dex_volume_7d = _dimension_metric(match.get("dex"), "7d")
    dex_volume_30d = _dimension_metric(match.get("dex"), "30d")

    quantitative = [
        value for value in (
            protocol_tvl, chain_tvl, fees_24h, fees_7d, fees_30d,
            revenue_24h, revenue_7d, revenue_30d,
            dex_volume_24h, dex_volume_7d, dex_volume_30d,
        ) if value is not None and value > 0
    ]
    matched = bool(protocol or chain)
    product_status = "PASS" if matched and quantitative else "UNKNOWN"
    product_level = "E2" if product_status == "PASS" else ("E1" if matched else "E0")

    quote_volume = _number((ticker or {}).get("quoteVolume"))
    if quote_volume is None:
        liquidity_band = "UNKNOWN"
        liquidity_rank = 4
        liquidity_status = "UNKNOWN"
    elif quote_volume >= 50_000_000:
        liquidity_band, liquidity_rank, liquidity_status = "STRONG", 0, "PASS"
    elif quote_volume >= 20_000_000:
        liquidity_band, liquidity_rank, liquidity_status = "GOOD", 1, "PASS"
    elif quote_volume >= 10_000_000:
        liquidity_band, liquidity_rank, liquidity_status = "BASIC", 2, "PASS"
    else:
        liquidity_band, liquidity_rank, liquidity_status = "THIN", 3, "PASS"

    valuation = _peer_context(protocol, indexes.protocols, market_cap)

    has_economic_activity = any(
        value is not None and value > 0
        for value in (fees_30d, revenue_30d, dex_volume_30d)
    )
    if product_status == "PASS" and has_economic_activity and liquidity_status == "PASS":
        priority_tier = "EVIDENCE_A"
        tier_rank = 0
    elif product_status == "PASS" or valuation.get("status") == "PASS":
        priority_tier = "EVIDENCE_B"
        tier_rank = 1
    else:
        priority_tier = "PREFILTER_C"
        tier_rank = 2

    prefilter_key = list(prefilter.get("sort_key") or [9, 9, 9, 9, 9, 9, 0])
    while len(prefilter_key) < 7:
        prefilter_key.append(9)

    # Research ordering is explicitly not a Quality Score. Hard state and
    # severe dilution/watch-risk remain first. Among otherwise executable
    # candidates, auditable Product evidence outranks a merely cleaner MC/FDV
    # proxy because V8.1 gives Product the largest Quality weight and forbids
    # using small cap/cheap dilution metrics as a substitute for real usage.
    severe_tokenomics_rank = 1 if prefilter_key[1] >= 3 or prefilter_key[2] >= 3 else 0
    research_sort_key = [
        prefilter_key[0],  # hard state
        severe_tokenomics_rank,
        tier_rank,
        0 if product_status == "PASS" else 1,
        0 if has_economic_activity else 1,
        liquidity_rank,
        prefilter_key[1],  # FDV/dilution within the same evidence tier
        prefilter_key[2],  # circulating safety within the same evidence tier
        0 if valuation.get("status") == "PASS" else 1,
        prefilter_key[3],  # MC preference only after evidence/safety
        -float(quote_volume or 0),
        -float(candidate.volume_24h_usd or 0),
    ]

    sources = []
    if protocol:
        sources.append({
            "provider": "DefiLlama",
            "dataset": "/protocols",
            "match_method": match.get("protocol_match_method"),
            "source_type": "SECONDARY_QUANTITATIVE",
            "fetched_at": fetched_at,
        })
    if chain:
        sources.append({
            "provider": "DefiLlama",
            "dataset": "/v2/chains",
            "match_method": match.get("chain_match_method"),
            "source_type": "SECONDARY_QUANTITATIVE",
            "fetched_at": fetched_at,
        })
    if match.get("fees"):
        sources.append({"provider": "DefiLlama", "dataset": "/overview/fees", "source_type": "SECONDARY_QUANTITATIVE", "fetched_at": fetched_at})
    if match.get("revenue"):
        sources.append({"provider": "DefiLlama", "dataset": "/overview/fees?dataType=dailyRevenue", "source_type": "SECONDARY_QUANTITATIVE", "fetched_at": fetched_at})
    if match.get("dex"):
        sources.append({"provider": "DefiLlama", "dataset": "/overview/dexs", "source_type": "SECONDARY_QUANTITATIVE", "fetched_at": fetched_at})
    if ticker:
        sources.append({"provider": "Binance", "dataset": "/api/v3/ticker/24hr", "source_type": "PRIMARY_MARKET", "fetched_at": fetched_at})

    return {
        "schema_version": "research.evidence.v1",
        "selection_role": "RESEARCH_PRIORITY_ONLY",
        "priority_tier": priority_tier,
        "sort_key": research_sort_key,
        "product": {
            "status": product_status,
            "evidence_level": product_level,
            "confidence": "MEDIUM" if product_status == "PASS" else "LOW",
            "protocol": (protocol or {}).get("name"),
            "category": (protocol or {}).get("category") or (chain or {}).get("name"),
            "protocol_tvl_usd": protocol_tvl,
            "chain_tvl_usd": chain_tvl,
            "fees_24h_usd": fees_24h,
            "fees_7d_usd": fees_7d,
            "fees_30d_usd": fees_30d,
            "protocol_revenue_24h_usd": revenue_24h,
            "protocol_revenue_7d_usd": revenue_7d,
            "protocol_revenue_30d_usd": revenue_30d,
            "dex_volume_24h_usd": dex_volume_24h,
            "dex_volume_7d_usd": dex_volume_7d,
            "dex_volume_30d_usd": dex_volume_30d,
            "note": "Protocol/chain activity evidence only; never reused as Token Value Capture.",
        },
        "structural_liquidity": {
            "status": liquidity_status,
            "evidence_level": "E3" if liquidity_status == "PASS" else "E0",
            "binance_quote_volume_24h_usd": quote_volume,
            "binance_trade_count_24h": _number((ticker or {}).get("count")),
            "band": liquidity_band,
        },
        "valuation_proxy": valuation,
        "token_value_capture": {
            "status": "UNKNOWN",
            "evidence_level": "E0",
            "reason": "PROTOCOL_ACTIVITY_IS_NOT_TOKEN_VALUE_CAPTURE",
        },
        "quality_status": "NOT_SCORED",
        "sources": sources,
        "fetched_at": fetched_at,
        "note": "Research evidence priority is not a V8.1 Quality Score or Investment Grade.",
    }
