"""Simulation-only strategy tabs for the overlay.

This module deliberately has no dependency on Playwright, AutoBettor, or the
database.  It replays known history to make a strategy preview useful without
creating a pending bet or gaining any authority to place a real one.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

import yaml
from pydantic import BaseModel, Field

from src.capital_managers import (
    MONEY_MANAGER_IDS,
    MONEY_MANAGER_OPTIONS,
    create_money_manager,
)
from src.models import BetSide, SIDE_LABEL
from src.progression import PROGRESSION_MODE_LOSS_UP_WIN_RESET, PROGRESSION_MODES
from src.risk_decision import RiskContext, RiskManager
from src.strategy_decision import StrategyDecision
from src.statistical_strategies import (
    SCHEDULE_STRATEGY_IDS,
    STATEFUL_STRATEGY_IDS,
    STATISTICAL_STRATEGIES,
    SPEC_BY_ID,
    advance_statistical_runtime,
    create_statistical_runtime,
    evaluate_statistical_strategy,
)


SIMULATION_STRATEGIES = (
    {"id": "follow_last", "label": "Bám kết quả trước"},
    {"id": "reverse_last", "label": "Đảo kết quả trước"},
    {"id": "smart_prev", "label": "Theo cầu trước thông minh"},
    {"id": "smart_prev_advanced", "label": "Bám cầu trước nâng cao"},
    *(
        {
            "id": spec.id,
            "label": spec.label,
            "reference_id": spec.reference_id,
            "live_eligible": spec.live_eligible,
            "unavailable_reason": spec.unavailable_reason,
        }
        for spec in STATISTICAL_STRATEGIES
    ),
)
_STRATEGY_IDS = frozenset(item["id"] for item in SIMULATION_STRATEGIES)
TAB_MODES = ("simulation", "live")
TabMode = Literal["simulation", "live"]


class SimulationTabConfig(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex)
    name: str = "Chiến lược 1"
    enabled: bool = True
    strategy_id: str = "follow_last"
    stakes: list[int] = Field(default_factory=lambda: [0, 100, 110, 120, 130])
    progression_mode: str = PROGRESSION_MODE_LOSS_UP_WIN_RESET
    money_manager_id: str = "IncreaseWhenLose"
    stake_chains: list[list[int]] = Field(default_factory=list)
    stop_loss: float = 0.0
    take_profit: float = 0.0
    auto_reset_on_nonnegative_pnl: bool = False
    bet_when_remaining_seconds: int = 10
    strategy_input: str = ""
    mode: TabMode = "simulation"

    def normalized(self) -> "SimulationTabConfig":
        values = self.model_dump()
        values["id"] = str(values["id"]).strip() or uuid4().hex
        # Start/Stop is the only execution switch. Old per-tab disabled values
        # are upgraded to enabled so a hidden legacy checkbox cannot block bets.
        values["enabled"] = True
        values["name"] = str(values["name"]).strip()[:40] or "Chiến lược"
        values["strategy_id"] = (
            values["strategy_id"]
            if values["strategy_id"] in _STRATEGY_IDS
            else "follow_last"
        )
        stakes = [int(value) for value in values["stakes"] if int(value) >= 0]
        values["stakes"] = stakes or [0, 100, 110, 120, 130]
        values["progression_mode"] = (
            values["progression_mode"]
            if values["progression_mode"] in PROGRESSION_MODES
            else PROGRESSION_MODE_LOSS_UP_WIN_RESET
        )
        if values.get("money_manager_id") not in MONEY_MANAGER_IDS:
            values["money_manager_id"] = "IncreaseWhenLose"
        chains: list[list[int]] = []
        for chain in (values.get("stake_chains") or [])[:10]:
            normalized_chain = [
                int(value) for value in chain if int(value) >= 0
            ][:100]
            if normalized_chain:
                chains.append(normalized_chain)
        values["stake_chains"] = chains
        if values["money_manager_id"] == "MultiChain" and not chains:
            values["stake_chains"] = [list(values["stakes"])]
        values["stop_loss"] = max(0.0, float(values["stop_loss"]))
        values["take_profit"] = max(0.0, float(values["take_profit"]))
        values["auto_reset_on_nonnegative_pnl"] = bool(
            values.get("auto_reset_on_nonnegative_pnl", False)
        )
        try:
            bet_when_remaining_seconds = int(
                values.get("bet_when_remaining_seconds", 10)
            )
        except (TypeError, ValueError):
            bet_when_remaining_seconds = 10
        values["bet_when_remaining_seconds"] = max(
            3, bet_when_remaining_seconds
        )
        values["strategy_input"] = str(values.get("strategy_input") or "")[:500]
        if values.get("mode") not in TAB_MODES:
            values["mode"] = "simulation"
        return SimulationTabConfig.model_validate(values)


class StrategyTabsConfig(BaseModel):
    selected_tab_id: str = ""
    tabs: list[SimulationTabConfig] = Field(
        default_factory=lambda: [SimulationTabConfig()]
    )

    def normalized(self) -> "StrategyTabsConfig":
        seen: set[str] = set()
        tabs: list[SimulationTabConfig] = []
        for item in self.tabs[:5]:
            tab = item.normalized()
            if tab.id in seen:
                tab = tab.model_copy(update={"id": uuid4().hex})
            seen.add(tab.id)
            tabs.append(tab)
        if not tabs:
            tabs = [SimulationTabConfig()]
        selected = self.selected_tab_id if self.selected_tab_id in seen else tabs[0].id
        return StrategyTabsConfig(selected_tab_id=selected, tabs=tabs)


def normalize_strategy_tabs(data: Any) -> StrategyTabsConfig:
    """Validate bridge/YAML input and always return at least one safe tab."""

    raw = dict(data) if isinstance(data, dict) else {}
    tabs = raw.get("tabs")
    if isinstance(tabs, list):
        mode_map = {
            "loss_up_win_reset": "IncreaseWhenLose",
            "win_up_loss_reset": "IncreaseWhenWin",
            "both_up": "IncreaseEveryRound",
            "win_up_loss_hold": "WinUpLoseKeep",
        }
        normalized_tabs = []
        for item in tabs:
            next_item = dict(item) if isinstance(item, dict) else item
            if isinstance(next_item, dict) and not next_item.get("money_manager_id"):
                next_item["money_manager_id"] = mode_map.get(
                    str(next_item.get("progression_mode") or ""),
                    "IncreaseWhenLose",
                )
            normalized_tabs.append(next_item)
        raw["tabs"] = normalized_tabs
    try:
        return StrategyTabsConfig.model_validate(raw).normalized()
    except (TypeError, ValueError):
        return StrategyTabsConfig().normalized()


def save_strategy_tabs_to_config(data: Any, config_path: str | Path) -> StrategyTabsConfig:
    """Persist only after an explicit click in the simulation manager."""

    cfg = normalize_strategy_tabs(data)
    path = Path(config_path)
    if not path.exists():
        path = Path("config.example.yaml")
    with path.open(encoding="utf-8") as handle:
        raw = yaml.safe_load(handle) or {}
    if not isinstance(raw, dict):
        raw = {}
    raw["strategy_tabs"] = cfg.model_dump()
    with path.open("w", encoding="utf-8") as handle:
        yaml.safe_dump(raw, handle, allow_unicode=True, default_flow_style=False, sort_keys=False)
    return cfg


def _opposite(side: BetSide) -> BetSide:
    return BetSide.BANKER if side == BetSide.PLAYER else BetSide.PLAYER


def _banker_player_history(history: list[BetSide]) -> list[BetSide]:
    """These strategies have no Tie prediction; ties do not advance their rule."""

    return [side for side in history if side in (BetSide.BANKER, BetSide.PLAYER)]


def _last_three_runs(history: list[BetSide]) -> tuple[int, int, int]:
    """Return the three latest alternating run lengths, oldest to newest."""

    if not history:
        return (0, 0, 0)
    index = len(history) - 1
    last = history[index]
    newest = 0
    while index >= 0 and history[index] == last:
        newest += 1
        index -= 1
    middle = 0
    while index >= 0 and history[index] != last:
        middle += 1
        index -= 1
    oldest = 0
    while index >= 0 and history[index] == last:
        oldest += 1
        index -= 1
    return (oldest, middle, newest)


def _heuristic_decision(
    *,
    strategy_id: str,
    strategy_name: str,
    history: list[BetSide],
) -> StrategyDecision:
    usable = _banker_player_history(history)
    if not usable:
        return StrategyDecision.skip(
            strategy_id=strategy_id,
            strategy_name=strategy_name,
            reason="Chưa đủ kết quả Banker/Player",
            history_size=len(history),
        )
    last = usable[-1]
    if strategy_id == "follow-last":
        side = last
        reason = f"Bám {SIDE_LABEL[last]} của ván trước"
        confidence = 0.5
    elif strategy_id == "reverse-last":
        side = _opposite(last)
        reason = f"Đảo {SIDE_LABEL[last]} của ván trước"
        confidence = 0.5
    else:
        previous_run, _middle_run, newest_run = _last_three_runs(usable)
        if strategy_id == "smart-prev":
            # Faithful port of SmartPrevTask: equal outer runs => reverse.
            follow_last = previous_run != newest_run
            confidence = 0.55
        else:
            # Faithful port of SmartPrevAdvancedTask.
            follow_last = newest_run > 1 or previous_run > 1
            confidence = 0.56
        side = last if follow_last else _opposite(last)
        action = "Bám" if follow_last else "Đảo"
        reason = (
            f"{action} {SIDE_LABEL[last]} (đoạn trước={previous_run}, "
            f"đoạn mới={newest_run})"
        )
    return StrategyDecision.bet(
        strategy_id=strategy_id,
        strategy_name=strategy_name,
        side=side,
        reason=reason,
        confidence=confidence,
        history_size=len(history),
        signal_id=strategy_id.replace("-", "_"),
        metadata={"last_side": last.value},
    )


def decision_for_strategy_tab(
    tab: SimulationTabConfig,
    history: list[BetSide],
    *,
    skip_tie: bool,
    disabled_patterns: frozenset[str] = frozenset(),
    pattern_lengths: dict[str, int] | None = None,
    table_name: str = "",
    source: str = "",
    schedule_round_index: int = 0,
    statistical_runtime=None,
) -> StrategyDecision:
    """Evaluate one tab without granting it execution authority."""

    if tab.strategy_id == "follow_last":
        return _heuristic_decision(
            strategy_id="follow-last", strategy_name="Bám kết quả trước", history=history,
        )
    if tab.strategy_id == "reverse_last":
        return _heuristic_decision(
            strategy_id="reverse-last", strategy_name="Đảo kết quả trước", history=history,
        )
    if tab.strategy_id == "smart_prev":
        return _heuristic_decision(
            strategy_id="smart-prev", strategy_name="Theo cầu trước thông minh", history=history,
        )
    if tab.strategy_id == "smart_prev_advanced":
        return _heuristic_decision(
            strategy_id="smart-prev-advanced", strategy_name="Bám cầu trước nâng cao", history=history,
        )
    if tab.strategy_id in SPEC_BY_ID:
        return evaluate_statistical_strategy(
            tab.strategy_id,
            history,
            schedule_round_index=schedule_round_index,
            runtime_state=statistical_runtime,
            strategy_input=tab.strategy_input,
        )
    return StrategyDecision.skip(
        strategy_id=tab.strategy_id,
        strategy_name=tab.strategy_id,
        reason="Chiến lược không còn khả dụng; hãy chọn chiến lược khác",
        history_size=len(history),
    )


def simulate_strategy_tab(
    tab: SimulationTabConfig,
    history: list[BetSide],
    *,
    skip_tie: bool,
    disabled_patterns: frozenset[str] = frozenset(),
    pattern_lengths: dict[str, int] | None = None,
) -> dict[str, Any]:
    """Replay completed rounds for one tab; this function cannot place a bet."""

    tab = tab.normalized()
    lengths = dict(pattern_lengths or {})
    manager = create_money_manager(
        tab.money_manager_id,
        tab.stakes,
        stake_chains=tab.stake_chains,
        stop_loss=tab.stop_loss,
        take_profit=tab.take_profit,
    )
    risk_manager = RiskManager()
    pnl = 0.0
    wins = losses = pushes = accepted = signals = 0
    result_outcomes: list[str] = []
    schedule_round_index = 0
    statistical_runtime = create_statistical_runtime(
        tab.strategy_id, history[:1], seed=tab.id, strategy_input=tab.strategy_input
    )

    # Each evaluation at index i is a virtual bet whose known result is history[i].
    for index in range(1, len(history)):
        decision = decision_for_strategy_tab(
            tab,
            history[:index],
            skip_tie=skip_tie,
            disabled_patterns=disabled_patterns,
            pattern_lengths=lengths,
            schedule_round_index=schedule_round_index,
            statistical_runtime=statistical_runtime,
        )
        if decision.wants_bet:
            signals += 1
        quote = manager.quote()
        risk = risk_manager.evaluate(RiskContext(
            strategy=decision, money=quote, auto_bet=tab.enabled,
            daily_profit=pnl, stop_loss=tab.stop_loss, take_profit=tab.take_profit,
            limit_hit=manager.limit_hit,
        ))
        if not (decision.wants_bet and risk.allowed and decision.side):
            continue
        accepted += 1
        update = manager.apply_result(decision.side, history[index])
        pnl += update.profit
        if update.outcome.value == "win":
            wins += 1
        elif update.outcome.value == "loss":
            losses += 1
        else:
            pushes += 1
        result_outcomes.append(update.outcome.value)
        if tab.strategy_id in SCHEDULE_STRATEGY_IDS:
            schedule_round_index = (schedule_round_index + 1) % 10
        if tab.strategy_id in STATEFUL_STRATEGY_IDS and statistical_runtime is not None:
            won = None if history[index] == BetSide.TIE else decision.side == history[index]
            advance_statistical_runtime(
                tab.strategy_id,
                statistical_runtime,
                history[:index + 1],
                won=won,
            )

    current = decision_for_strategy_tab(
        tab,
        history,
        skip_tie=skip_tie,
        disabled_patterns=disabled_patterns,
        pattern_lengths=lengths,
        schedule_round_index=schedule_round_index,
        statistical_runtime=statistical_runtime,
    )
    quote = manager.quote()
    risk = risk_manager.evaluate(RiskContext(
        strategy=current, money=quote, auto_bet=tab.enabled,
        daily_profit=pnl, stop_loss=tab.stop_loss, take_profit=tab.take_profit,
        limit_hit=manager.limit_hit,
    ))
    max_win_streak = max_loss_streak = 0
    current_win_streak = current_loss_streak = 0
    for outcome in result_outcomes:
        if outcome == "win":
            current_win_streak += 1
            current_loss_streak = 0
        elif outcome == "loss":
            current_loss_streak += 1
            current_win_streak = 0
        # A tie/push is not a valid bet, so it does not break either streak.
        max_win_streak = max(max_win_streak, current_win_streak)
        max_loss_streak = max(max_loss_streak, current_loss_streak)

    return {
        "id": tab.id,
        "name": tab.name,
        "enabled": tab.enabled,
        "strategy_id": tab.strategy_id,
        "money_manager_id": tab.money_manager_id,
        "signals": signals,
        "virtual_bets": accepted,
        "wins": wins,
        "losses": losses,
        "pushes": pushes,
        "valid_bets": wins + losses,
        "max_win_streak": max_win_streak,
        "max_loss_streak": max_loss_streak,
        "result_outcomes": result_outcomes,
        "pnl": round(pnl, 2),
        "current": {
            "action": current.action.value,
            "side": current.side.value if current.side else None,
            "reason": current.reason,
            "stake": quote.stake,
            "level": quote.level_index + 1,
            "total_levels": quote.total_levels,
            "risk": risk.to_dict(),
        },
        "history_size": len(history),
    }


def strategy_tabs_to_overlay(
    config: StrategyTabsConfig,
    history: list[BetSide],
    *,
    skip_tie: bool,
    disabled_patterns: frozenset[str] = frozenset(),
    pattern_lengths: dict[str, int] | None = None,
) -> dict[str, Any]:
    cfg = config.normalized()
    return {
        "mode": "managed",
        "message": (
            "Simulation/shadow không click chip; chỉ tab live đã xác nhận "
            "mới được cấp quyết định cho AutoBettor."
        ),
        "selected_tab_id": cfg.selected_tab_id,
        "strategies": list(SIMULATION_STRATEGIES),
        "money_managers": list(MONEY_MANAGER_OPTIONS),
        "tabs": [
            {**tab.model_dump(), "status": simulate_strategy_tab(
                tab, history, skip_tie=skip_tie,
                disabled_patterns=disabled_patterns, pattern_lengths=pattern_lengths,
            )}
            for tab in cfg.tabs
        ],
    }
