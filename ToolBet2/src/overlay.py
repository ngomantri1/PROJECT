from __future__ import annotations

import asyncio
import logging
from typing import Any
from uuid import uuid4

from playwright.async_api import Page

from src.stakes_config import format_stakes
from src.betting_config import format_limit
from src.models import BetSide, SIDE_LABEL
from src.pattern_analyzer import (
    filter_history,
)
from src.ui_contracts import UiCommand, UiCommandResult, UiScreen, UiSnapshot
from src.ui_runtime import BrowserUiRuntime
from src.ui.legacy import INSTALL_SCRIPT, PANELS_DOM_CHECK, UPDATE_SCRIPT

logger = logging.getLogger(__name__)

OVERLAY_ID = "toolbet-overlay"
OVERLAY_LEFT_ID = "toolbet-overlay-left"
OVERLAY_STYLE_ID = "toolbet-overlay-style"

def build_overlay_payload(
    history: list[BetSide],
    table_name: str = "",
    table_id: str = "",
    skip_tie: bool = True,
    recent_dots: int = 24,
    recent_text: int = 14,
    stakes: list[int] | None = None,
    betting: dict[str, Any] | None = None,
    display_stats: dict[str, int] | None = None,
    pattern_enabled: dict[str, bool] | None = None,
    pattern_lengths: dict[str, int] | None = None,
    pattern_win_rates: dict[str, dict[str, Any]] | None = None,
    stats_scope: str = "today",
    stake_steps: list[dict[str, Any]] | None = None,
    stake_steps_label: str = "",
    stake_steps_warn: str = "",
    pnl_today: dict[str, Any] | None = None,
    pnl_7days: dict[str, Any] | None = None,
) -> dict[str, Any]:
    # History remains available to the strategy-tab pipeline.  The two legacy
    # 1-1/Bet×2 models no longer run or publish an overlay signal.
    full = list(history)
    h = filter_history(history, skip_tie)

    dots_full = full[-recent_dots:] if full else []
    text_src = h[-recent_text:] if h else []

    hist_stats = {
        "banker": sum(1 for s in full if s == BetSide.BANKER),
        "player": sum(1 for s in full if s == BetSide.PLAYER),
        "tie": sum(1 for s in full if s == BetSide.TIE),
    }
    stats = hist_stats
    round_count = len(full)

    payload: dict[str, Any] = {
        "table": table_name,
        "table_id": table_id,
        "round_count": round_count,
        "round_count_no_tie": len(h),
        "stats": stats,
        "recent_count": len(text_src),
        "recent_dots_count": len(dots_full),
        "history_dots": [
            {
                "side": s.value,
                "label": SIDE_LABEL.get(s, s.value),
            }
            for s in dots_full
        ],
        "history_text": " → ".join(SIDE_LABEL.get(s, s.value) for s in text_src) if text_src else "(trong)",
        "has_signal": False,
        "signal_side": None,
        "signal_key": None,
        "matched": [],
        "building": [],
        "patterns": [],
        "pattern_priority_hint": "",
        "stakes_display": format_stakes(stakes) if stakes else "",
        "stats_scope": stats_scope,
        "stats_low_confidence": "",
        "stake_steps": stake_steps or [],
        "stake_steps_label": stake_steps_label or "Win% hom nay theo tung buoc",
        "stake_steps_warn": stake_steps_warn or "",
    }
    if betting:
        from src.bet_analytics import PnlSummary, format_pnl_summary_line

        limit_line = betting.get("limit_text") or ""
        last_bet = betting.get("last_bet") or "Chua co cuoc"
        today_sum = PnlSummary(**(pnl_today or {})) if pnl_today else None
        week_sum = PnlSummary(**(pnl_7days or {})) if pnl_7days else None
        pnl_lines = ""
        if today_sum:
            pnl_lines += format_pnl_summary_line(today_sum, label="P&L hom nay")
        if week_sum:
            pnl_lines += format_pnl_summary_line(week_sum, label="P&L 7 ngay")
        payload.update({
            "auto_bet": bool(betting.get("auto_bet")),
            "stop_loss_display": format_limit(float(betting.get("stop_loss", 0))),
            "take_profit_display": format_limit(float(betting.get("take_profit", 0))),
            "group_take_profit_display": format_limit(float(betting.get("group_take_profit", 0))),
            "group_stop_loss_display": format_limit(float(betting.get("group_stop_loss", 0))),
            "progression_mode": betting.get("progression_mode", "loss_up_win_reset"),
            "loss_watch_recover": bool(betting.get("loss_watch_recover")),
            "tie_nurture": betting.get("tie_nurture") or {},
            "current_stake_index": int(betting.get("stake_index", 0)),
            "group_progress": {
                "open": betting.get("current_group_id") is not None,
                "group_id": betting.get("current_group_id"),
                "seq_no": betting.get("current_group_seq"),
                "groups_closed": int(betting.get("groups_closed", 0)),
                "stake_index": int(betting.get("stake_index", 0)),
                "stake_step": int(betting.get("stake_step", int(betting.get("stake_index", 0)) + 1)),
                "stake_total_steps": int(betting.get("stake_total_steps", 0)),
                "current_stake": betting.get("current_stake", 0),
                "next_stake": betting.get("next_stake", 0),
                "next_stake_step": int(betting.get("next_stake_step", 1)),
                "next_stake_on_win": betting.get("next_stake_on_win", 0),
                "next_stake_step_on_win": int(betting.get("next_stake_step_on_win", 1)),
                "progression_mode": betting.get("progression_mode", "loss_up_win_reset"),
                "loss_watch_recover": bool(betting.get("loss_watch_recover")),
                "stakes": list(betting.get("stakes") or stakes or []),
                "group_pnl": float(betting.get("group_pnl", 0)),
                "group_loss_count": int(betting.get("group_loss_count", 0)),
                "group_results": list(betting.get("group_results") or []),
                "group_wins": int(betting.get("group_wins", 0)),
                "group_losses": int(betting.get("group_losses", 0)),
                "group_pushes": int(betting.get("group_pushes", 0)),
                "group_take_profit": betting.get("group_take_profit", 0),
                "group_stop_loss": betting.get("group_stop_loss", 0),
                "pending": bool(betting.get("pending")),
                "last_bet": betting.get("last_bet") or "",
                "auto_bet": bool(betting.get("auto_bet")),
            },
            "bet_stats_html": (
                pnl_lines
                + f'<div>Muc cuoc: <b>{betting.get("current_stake", 0)}</b> '
                f'(buoc {int(betting.get("stake_index", 0)) + 1}) | '
                f'PnL nhom: <b>{betting.get("group_pnl", 0):+.0f}</b> | '
                f'Thua nhom: {int(betting.get("group_loss_count", 0))}</div>'
                f'<div>{last_bet}</div>'
                f'{"<div class=limit-warn>" + limit_line + "</div>" if limit_line else ""}'
            ),
        })
    return payload


def url_should_host_overlay(url: str, site_id: str | None = None) -> bool:
    """URL co the mang panel tool (theo shell_mode), chua check phase room.

    - Tab AE SEXY / webmain → yes
    - Shell casino_iframe (vipbet): bat ky trang host site (game co the mo tren /casino
      hoac trang chu qua #iframe_game fullscreen)
    - Shell provider_tab (live.html, home) → no (game o tab CDN rieng)
    - Shell web khac → no
    """
    from src.ae_sexy import is_ae_sexy_url
    from src.sites import get_active_site, resolve_site

    u = (url or "").strip()
    if not u or u.lower().startswith(("about:", "chrome:", "devtools:", "edge:")):
        return False
    low = u.lower()
    if is_ae_sexy_url(u) or "webmain" in low:
        return True

    try:
        shell = resolve_site(u)
    except ValueError:
        return False

    try:
        active = resolve_site(site_id) if site_id else get_active_site()
    except Exception:
        active = get_active_site()
    if shell.info.id != active.info.id:
        return False

    if shell.info.shell_mode == "casino_iframe":
        # Game overlay (#iframe_game) co the nam tren /casino HOAC trang chu
        return shell.info.matches_url(u)
    return False


async def page_should_host_overlay(page: Page, site_id: str | None = None) -> bool:
    """True khi tab dang la noi hien thi tool (AE tab hoac casino_iframe da mo game)."""
    try:
        url = page.url or ""
    except Exception:
        return False

    from src.ae_sexy import is_ae_sexy_url

    if is_ae_sexy_url(url) or "webmain" in (url or "").lower():
        return True

    if not url_should_host_overlay(url, site_id=site_id):
        return False

    # casino_iframe: gan khi da mo AE (room/lobby/loading) — ke ca URL trang chu
    from src.ae_sexy import (
        PHASE_LOADING,
        PHASE_LOBBY,
        PHASE_ROOM,
        _game_launched,
        _get_shell_mode,
        detect_ae_sexy_phase,
        is_ae_sexy_in_room,
    )

    try:
        mode = await asyncio.wait_for(_get_shell_mode(page), timeout=2.5)
    except Exception:
        mode = ""
    if mode in ("room", "lobby", "loading"):
        return True

    try:
        phase = await detect_ae_sexy_phase(page)
    except Exception:
        phase = ""
    if phase in (PHASE_ROOM, PHASE_LOBBY, PHASE_LOADING):
        return True

    try:
        if await is_ae_sexy_in_room(page):
            return True
    except Exception:
        pass

    try:
        return bool(await _game_launched(page))
    except Exception:
        return False


class GameOverlay:
    """Panel overlay tren trang casino (ngoai iframe game)."""

    _BRIDGE_NAMES = (
        "toolbetSaveStakes",
        "toolbetToggleAutoBet",
        "toolbetToggleWatchRecover",
        "toolbetSaveLimits",
        "toolbetTogglePattern",
        "toolbetSetPatternLength",
        "toolbetSuggestConfig",
        "toolbetDailyAnalysis",
        "toolbetSetStatsScope",
        "toolbetSaveTieNurture",
        "toolbetToggleTieNurture",
        "toolbetSaveStrategyTabs",
        "toolbetLoadStrategyHistory",
        "toolbetUiCommand",
    )

    def __init__(self):
        self._installed = False
        self._stakes: list[int] = []
        self._save_handler = None
        self._toggle_handler = None
        self._watch_recover_handler = None
        self._limits_handler = None
        self._pattern_toggle_handler = None
        self._pattern_length_handler = None
        self._suggest_handler = None
        self._daily_handler = None
        self._stats_scope_handler = None
        self._tie_nurture_handler = None
        self._strategy_tabs_handler = None
        self._strategy_history_handler = None
        self._ui_command_handler = None
        self._strategy_tabs: dict[str, Any] = {}
        self._auto_bet = False
        self._run_enabled = False
        self._stop_loss = 0.0
        self._take_profit = 0.0
        self._group_take_profit = 0.0
        self._group_stop_loss = 0.0
        self._progression_mode = "loss_up_win_reset"
        self._loss_watch_recover = False
        self._tie_nurture: dict[str, Any] = {}
        self._pattern_enabled: dict[str, bool] = {}
        self._pattern_lengths: dict[str, int] = {}
        self._bound_ctx_id: int | None = None
        self._exposed_names: set[str] = set()
        self._legacy_overlay_enabled = True
        self._ui_revision = 0
        self._ui_session_id = uuid4().hex
        self._ui_runtime = BrowserUiRuntime(enabled=False)

    def configure_ui_runtime(
        self,
        *,
        runtime_v2_enabled: bool = False,
        legacy_overlay_enabled: bool = True,
    ):
        """Configure the migration flags without changing either betting path."""

        self._legacy_overlay_enabled = bool(legacy_overlay_enabled)
        self._ui_runtime.configure(enabled=runtime_v2_enabled)

    def set_stakes(self, stakes: list[int]):
        self._stakes = list(stakes)

    def set_betting_ui(
        self,
        *,
        auto_bet: bool,
        stop_loss: float,
        take_profit: float,
        group_take_profit: float = 0.0,
        group_stop_loss: float = 0.0,
        progression_mode: str = "loss_up_win_reset",
        loss_watch_recover: bool = False,
    ):
        self._auto_bet = auto_bet
        self._stop_loss = stop_loss
        self._take_profit = take_profit
        self._group_take_profit = group_take_profit
        self._group_stop_loss = group_stop_loss
        self._progression_mode = progression_mode
        self._loss_watch_recover = bool(loss_watch_recover)

    def set_run_enabled(self, enabled: bool) -> None:
        """Keep the operator run latch available to every UI reinstall."""

        self._run_enabled = bool(enabled)

    def set_tie_nurture(self, data: dict[str, Any] | None):
        from src.tie_nurture_config import tie_nurture_to_overlay
        from src.config import TieNurtureConfig

        if isinstance(data, TieNurtureConfig):
            self._tie_nurture = tie_nurture_to_overlay(data)
        elif isinstance(data, dict) and data:
            # Dam bao co presets trong payload overlay
            from src.tie_nurture_config import normalize_tie_nurture_dict, preset_options_for_overlay

            cfg = normalize_tie_nurture_dict(data)
            payload = tie_nurture_to_overlay(cfg)
            if data.get("presets"):
                payload["presets"] = data["presets"]
            else:
                payload["presets"] = preset_options_for_overlay()
            self._tie_nurture = payload
        else:
            self._tie_nurture = tie_nurture_to_overlay(TieNurtureConfig())

    def set_save_handler(self, handler):
        """handler(text: str) -> dict voi keys ok, display?, error?"""
        self._save_handler = handler

    def set_toggle_handler(self, handler):
        """handler(enabled: bool) -> dict"""

        self._toggle_handler = handler

    def set_watch_recover_handler(self, handler):
        """handler(enabled: bool) -> dict with ok, loss_watch_recover"""

        self._watch_recover_handler = handler

    def set_limits_handler(self, handler):
        """handler(stop_loss, take_profit, group_take_profit, group_stop_loss, progression_mode) -> dict"""

        self._limits_handler = handler

    def set_tie_nurture_handler(self, handler):
        """handler(action, payload) -> dict; action=save|toggle"""

        self._tie_nurture_handler = handler

    def set_pattern_enabled(self, enabled: dict[str, bool]):
        self._pattern_enabled = dict(enabled)

    def set_pattern_lengths(self, lengths: dict[str, int]):
        self._pattern_lengths = dict(lengths)

    def set_pattern_toggle_handler(self, handler):
        """handler(pattern_id: str, enabled: bool) -> dict"""

        self._pattern_toggle_handler = handler

    def set_pattern_length_handler(self, handler):
        """handler(pattern_id: str, length: int) -> dict"""

        self._pattern_length_handler = handler

    def set_suggest_handler(self, handler):
        """handler() -> dict with ok, html, stakes_display, patterns, ..."""

        self._suggest_handler = handler

    def set_daily_handler(self, handler):
        """handler() -> dict with ok, html, ..."""

        self._daily_handler = handler

    def set_stats_scope_handler(self, handler):
        """handler(scope: str) -> dict"""

        self._stats_scope_handler = handler

    def set_strategy_tabs(self, data: dict[str, Any] | None):
        payload = dict(data or {})
        # Startup/reinstall can provide the persisted tab config before the
        # runtime status payload is available.  The workspace always needs its
        # catalogue as well; otherwise saved ids cannot be rendered by select
        # controls and appear as empty/reset fields.
        if "strategies" not in payload or "money_managers" not in payload:
            from src.capital_managers import MONEY_MANAGER_OPTIONS
            from src.strategy_tabs import SIMULATION_STRATEGIES

            payload.setdefault("strategies", list(SIMULATION_STRATEGIES))
            payload.setdefault("money_managers", list(MONEY_MANAGER_OPTIONS))
        self._strategy_tabs = payload

    def set_strategy_tabs_handler(self, handler):
        """handler(payload) saves simulation-only strategy tab settings."""

        self._strategy_tabs_handler = handler

    def set_strategy_history_handler(self, handler):
        """handler(payload) loads one paginated strategy-history page."""

        self._strategy_history_handler = handler

    def set_ui_command_handler(self, handler):
        """handler(command: UiCommand) -> dict; reserved for the v2 command bus."""

        self._ui_command_handler = handler

    def _build_ui_snapshot(self, payload: dict[str, Any] | None = None) -> UiSnapshot:
        data = dict(payload or {})
        data.setdefault("run_enabled", self._run_enabled)
        strategy_tabs = data.get("strategy_tabs")
        if not isinstance(strategy_tabs, dict):
            strategy_tabs = self._strategy_tabs
        strategy_tabs = (
            dict(strategy_tabs) if isinstance(strategy_tabs, dict) else {}
        )
        # The workspace renders its strategy and money-manager selects from
        # state.strategy_tabs.  Keep the full catalogue in every snapshot,
        # including initial install and DOM re-install snapshots.
        data["strategy_tabs"] = strategy_tabs
        data["runtime_session_id"] = self._ui_session_id
        tabs = strategy_tabs.get("tabs", [])
        return UiSnapshot(
            revision=self._ui_revision,
            screen=UiScreen.WORKSPACE,
            state=data,
            tabs=tabs if isinstance(tabs, list) else [],
        )

    async def _expose_fn(self, page: Page, name: str, callback) -> bool:
        """Gan bridge Python↔JS. Uu tien context (moi tab), roi page."""
        try:
            ctx = page.context
            ctx_id = id(ctx)
        except Exception:
            ctx = None
            ctx_id = None
        if ctx_id != self._bound_ctx_id:
            self._bound_ctx_id = ctx_id
            self._exposed_names.clear()
            # Stub chet tu lan CDP truoc: typeof=function nhung goi → "is not exposed"
            try:
                await page.evaluate(
                    """(names) => {
                      for (const n of names) {
                        try {
                          if (typeof window[n] === 'function') delete window[n];
                        } catch (e) {}
                      }
                    }""",
                    list(self._BRIDGE_NAMES),
                )
            except Exception:
                pass

        if name in self._exposed_names:
            try:
                await page.expose_function(name, callback)
            except Exception as exc:
                if "already registered" not in str(exc).lower():
                    logger.debug("Re-expose page %s: %s", name, exc)
            return True

        last_err: Exception | None = None
        if ctx is not None:
            try:
                await ctx.expose_function(name, callback)
                self._exposed_names.add(name)
                return True
            except Exception as exc:
                if "already registered" in str(exc).lower():
                    self._exposed_names.add(name)
                    return True
                last_err = exc
        try:
            await page.expose_function(name, callback)
            self._exposed_names.add(name)
            return True
        except Exception as exc:
            if "already registered" in str(exc).lower():
                self._exposed_names.add(name)
                return True
            last_err = exc
        logger.warning("Khong expose %s: %s", name, last_err)
        return False

    async def bind_callbacks(self, page: Page) -> bool:
        ok = True

        if self._save_handler:

            async def _save(text: str) -> dict:
                try:
                    result = self._save_handler(text)
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False, "error": "Loi luu"}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetSaveStakes", _save):
                ok = False

        if self._toggle_handler:

            async def _toggle(enabled: bool) -> dict:
                try:
                    result = self._toggle_handler(enabled)
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetToggleAutoBet", _toggle):
                ok = False

        if self._watch_recover_handler:

            async def _watch_recover(enabled: bool) -> dict:
                try:
                    result = self._watch_recover_handler(enabled)
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetToggleWatchRecover", _watch_recover):
                ok = False

        if self._limits_handler:

            async def _limits(
                stop_loss: str,
                take_profit: str,
                group_take_profit: str = "",
                group_stop_loss: str = "",
                progression_mode: str = "loss_up_win_reset",
            ) -> dict:
                try:
                    result = self._limits_handler(
                        stop_loss,
                        take_profit,
                        group_take_profit,
                        group_stop_loss,
                        progression_mode,
                    )
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetSaveLimits", _limits):
                ok = False

        if self._pattern_toggle_handler:

            async def _pattern_toggle(pattern_id: str, enabled: bool) -> dict:
                try:
                    result = self._pattern_toggle_handler(pattern_id, enabled)
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetTogglePattern", _pattern_toggle):
                ok = False

        if self._pattern_length_handler:

            async def _pattern_length(pattern_id: str, length: int) -> dict:
                try:
                    result = self._pattern_length_handler(pattern_id, int(length))
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetSetPatternLength", _pattern_length):
                ok = False

        if self._suggest_handler:

            async def _suggest() -> dict:
                try:
                    result = self._suggest_handler()
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False, "error": "Loi phan tich"}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetSuggestConfig", _suggest):
                ok = False

        if self._daily_handler:

            async def _daily() -> dict:
                try:
                    result = self._daily_handler()
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False, "error": "Loi phan tich"}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetDailyAnalysis", _daily):
                ok = False

        if self._stats_scope_handler:

            async def _stats_scope(scope: str) -> dict:
                try:
                    result = self._stats_scope_handler(scope)
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetSetStatsScope", _stats_scope):
                ok = False

        if self._tie_nurture_handler:

            async def _save_tie(payload: dict) -> dict:
                try:
                    result = self._tie_nurture_handler("save", payload or {})
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False, "error": "Loi luu"}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            async def _toggle_tie(enabled: bool, payload: dict | None = None) -> dict:
                try:
                    data = dict(payload or {})
                    data["enabled"] = bool(enabled)
                    result = self._tie_nurture_handler("toggle", data)
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False, "error": "Loi toggle"}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetSaveTieNurture", _save_tie):
                ok = False
            if not await self._expose_fn(page, "toolbetToggleTieNurture", _toggle_tie):
                ok = False

        if self._strategy_tabs_handler:

            async def _save_strategy_tabs(payload: dict) -> dict:
                try:
                    result = self._strategy_tabs_handler(payload or {})
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False, "error": "Loi luu"}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetSaveStrategyTabs", _save_strategy_tabs):
                ok = False

        if self._strategy_history_handler:

            async def _load_strategy_history(payload: dict) -> dict:
                try:
                    result = self._strategy_history_handler(payload or {})
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(
                page, "toolbetLoadStrategyHistory", _load_strategy_history
            ):
                ok = False

        async def _ui_command(raw: dict) -> dict:
            command_id = str((raw or {}).get("command_id") or "")
            try:
                command = UiCommand.model_validate(raw or {})
                if not self._ui_command_handler:
                    result = UiCommandResult(
                        command_id=command.command_id,
                        ok=False,
                        error="Lệnh UI chưa được hỗ trợ trong giai đoạn A",
                    )
                    return result.model_dump(mode="json")
                response = self._ui_command_handler(command)
                if hasattr(response, "__await__"):
                    response = await response
                if isinstance(response, UiCommandResult):
                    return response.model_dump(mode="json")
                if isinstance(response, dict):
                    return UiCommandResult(
                        command_id=command.command_id,
                        ok=bool(response.get("ok")),
                        data=response.get("data", {}),
                        error=str(response.get("error", "")),
                    ).model_dump(mode="json")
                raise TypeError("UI command handler phải trả dict hoặc UiCommandResult")
            except Exception as exc:
                return UiCommandResult(
                    command_id=command_id or "invalid",
                    ok=False,
                    error=str(exc),
                ).model_dump(mode="json")

        if not await self._expose_fn(page, "toolbetUiCommand", _ui_command):
            ok = False

        return ok

    async def _panels_present(self, page: Page) -> bool:
        if self._ui_runtime.enabled and await self._ui_runtime.present(page):
            return True
        if not self._legacy_overlay_enabled:
            return False
        try:
            return bool(await page.evaluate(PANELS_DOM_CHECK))
        except Exception:
            return False

    async def install(self, page: Page, stakes: list[int] | None = None) -> bool:
        try:
            url = ""
            try:
                url = page.url or ""
            except Exception:
                url = ""
            # provider_tab → tab AE SEXY; casino_iframe → /casino khi da mo game
            if not await page_should_host_overlay(page):
                logger.debug("Bo qua overlay — khong phai host game: %s", url[:70])
                return False
            if stakes:
                self._stakes = list(stakes)
            await self.bind_callbacks(page)
            opts = {
                "stakesText": format_stakes(self._stakes or [20, 50, 100, 200]),
                "autoBet": self._auto_bet,
                "stopLoss": format_limit(self._stop_loss),
                "takeProfit": format_limit(self._take_profit),
                "groupTakeProfit": format_limit(self._group_take_profit),
                "groupStopLoss": format_limit(self._group_stop_loss),
                "progressionMode": self._progression_mode,
                "lossWatchRecover": self._loss_watch_recover,
                "tieNurture": self._tie_nurture or {},
                "strategyTabs": self._strategy_tabs or {},
            }
        except Exception as e:
            logger.warning("Khong chuan bi duoc overlay: %s", e)
            return False

        legacy_ok = False
        if self._legacy_overlay_enabled:
            try:
                await page.evaluate(INSTALL_SCRIPT, opts)
                legacy_ok = True
            except Exception as e:
                logger.warning("Khong gan duoc legacy overlay: %s", e)
        self._installed = legacy_ok
        runtime_ok = await self._ui_runtime.install(
            page, self._build_ui_snapshot()
        )
        return legacy_ok or runtime_ok

    async def update(
        self,
        page: Page,
        history: list[BetSide],
        table_name: str = "",
        table_id: str = "",
        skip_tie: bool = True,
        stakes: list[int] | None = None,
        betting: dict[str, Any] | None = None,
        display_stats: dict[str, int] | None = None,
        pattern_enabled: dict[str, bool] | None = None,
        pattern_lengths: dict[str, int] | None = None,
        pattern_win_rates: dict[str, dict[str, Any]] | None = None,
        stats_scope: str = "today",
        stake_steps: list[dict[str, Any]] | None = None,
        stake_steps_label: str = "",
        stake_steps_warn: str = "",
        pnl_today: dict[str, Any] | None = None,
        pnl_7days: dict[str, Any] | None = None,
        strategy_tabs: dict[str, Any] | None = None,
        license_status: dict[str, Any] | None = None,
    ) -> bool:
        if not page or page.is_closed():
            return False
        try:
            active_stakes = stakes or self._stakes
            payload = build_overlay_payload(
                history,
                table_name,
                table_id,
                skip_tie,
                stakes=active_stakes,
                betting=betting,
                display_stats=display_stats,
                pattern_enabled=pattern_enabled if pattern_enabled is not None else self._pattern_enabled,
                pattern_lengths=pattern_lengths if pattern_lengths is not None else self._pattern_lengths,
                pattern_win_rates=pattern_win_rates,
                stats_scope=stats_scope,
                stake_steps=stake_steps,
                stake_steps_label=stake_steps_label,
                stake_steps_warn=stake_steps_warn,
                pnl_today=pnl_today,
                pnl_7days=pnl_7days,
            )
            payload["strategy_tabs"] = (
                strategy_tabs if strategy_tabs is not None else self._strategy_tabs
            )
            payload["license"] = dict(license_status or {})
            self._ui_revision += 1
            snapshot = self._build_ui_snapshot(payload)
        except Exception as e:
            logger.debug("Tao snapshot overlay: %s", e)
            return False

        legacy_ok = False
        if self._legacy_overlay_enabled:
            try:
                if not self._installed or not await self._panels_present(page):
                    await self.install(page, stakes=active_stakes or None)
                else:
                    # Dam bao bridge con song (CDP / doi tab AE)
                    await self.bind_callbacks(page)
                result = await page.evaluate(UPDATE_SCRIPT, payload)
                if isinstance(result, dict) and result.get("needsInstall"):
                    self._installed = False
                    await self.install(page, stakes=active_stakes or None)
                    await page.evaluate(UPDATE_SCRIPT, payload)
                legacy_ok = True
            except Exception as e:
                logger.debug("Cap nhat legacy overlay: %s", e)
                self._installed = False
        else:
            try:
                await self.bind_callbacks(page)
            except Exception as e:
                logger.debug("Gan UI command bridge: %s", e)

        runtime_ok = await self._ui_runtime.update(page, snapshot)
        return legacy_ok or runtime_ok

    async def remove(self, page: Page):
        try:
            await page.evaluate(
                """() => {
                  document.getElementById('toolbet-overlay')?.remove();
                  document.getElementById('toolbet-overlay-left')?.remove();
                  document.getElementById('toolbet-overlay-center')?.remove();
                  document.getElementById('tb-strategy-modal')?.remove();
                  document.getElementById('toolbet-overlay-style')?.remove();
                }"""
            )
        except Exception:
            pass
        await self._ui_runtime.remove(page)
        self._installed = False
