from __future__ import annotations

import asyncio
import logging
import sys
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from src.auth import is_logged_in, login_vipbet389
from src.credentials import load_credentials, save_credentials
from src.browser import BrowserManager
from src.release_support import configure_runtime_logging, inspect_pilot_runtime
from src.release_cli import handle_release_command
from src.small_stake_guard import SmallStakePilotGuard, default_lease_path


def _is_target_closed_exc(exc: BaseException) -> bool:
    name = type(exc).__name__
    msg = str(exc).lower()
    return (
        "TargetClosed" in name
        or "has been closed" in msg
        or "browser has been closed" in msg
        or "context or browser has been closed" in msg
    )
from src.ae_sexy_collector import AeSexyCollector
from src.ae_sexy_http import stats_total
from src.ae_sexy_reader import scrape_all_tables
from src.collector import TrafficCollector
from src.config import config_path_resolved, load_config, update_site_url
from src.database import RoundRecord, init_db
from src.db_store import GameDataStore
from src.login_panel import prompt_login_panel
from src.license_client import HttpLicenseBackend, LicenseService
from src.tool_auth import ToolAuthService
from src.tool_login_panel import prompt_tool_login_panel
from src.ui_contracts import UiCommand, UiCommandType
from src.ae_sexy import (
    PHASE_LABEL,
    PHASE_LOBBY,
    PHASE_LOADING,
    PHASE_ROOM,
    PHASE_WEB,
    TABLE_CODE_RE,
    assess_ae_sexy_connection,
    detect_ae_sexy_phase,
    detect_room_table_name,
    ensure_game_overlay_visible,
    ensure_lobby_ready,
    enter_ae_sexy_hall,
    enter_ae_sexy_table,
    is_ae_sexy_in_room,
    is_ae_sexy_table_ready,
    is_ae_sexy_lobby,
    is_ae_sexy_promo_visible,
    is_game_iframe_visible,
    list_ae_sexy_tables,
    lobby_table_candidates,
    describe_table_pick,
    normalize_baccarat_table_name,
    scroll_lobby_to_table,
    read_table_stats,
    fix_session_if_expired,
    is_game_alive,
    is_game_ui_alive,
    is_game_session_expired,
    is_casino_fatal_error,
    is_game_token_zombie,
    recover_game_stream_token,
    force_relaunch_ae_sexy_game,
    recover_ae_sexy_connection,
    recover_ae_sexy_session_expired,
    wait_for_ae_sexy_in_room,
    wait_for_ae_sexy_table_ready,
    wait_for_ae_sexy_lobby,
    wait_for_game_position,
    probe_game_state,
    probe_game_shell_health,
    _game_launched,
)
from src.game import close_game_overlay, find_game_page, get_game_iframe, has_game_iframe, is_game_loaded, show_game_overlay
from src.models import BetSide, RoundResult, TableState, SIDE_LABEL
from src.ongames import decode_baccarat_result
from src.overlay import GameOverlay
from src.stakes_config import format_stakes, parse_stakes_text, save_stakes_to_config
from src.betting_config import format_limit, parse_limit_text, save_betting_to_config, save_limits_to_config
from src.betting_session import BettingSession
from src.progression import PROGRESSION_MODES
from src.auto_bettor import AutoBettor, BET_TRIGGER_SOURCES
from src.strategy_tabs import (
    normalize_strategy_tabs,
    strategy_tabs_to_overlay,
)
from src.strategy_tab_store import StrategyTabStore
from src.strategy_lifecycle import StrategyLifecycleService, TabLifecycleMode
from src.capital_managers import create_money_manager
from src.money_state_store import MoneyStateStore, money_config_fingerprint
from src.live_run_limits import LiveRunLimitTracker
from src.bet_analytics import (
    MIN_CONFIDENCE_SAMPLES,
    pattern_win_rates_by_id,
    pnl_last_days,
    pnl_today,
    stake_index_stats_daily,
    stake_steps_for_overlay,
)
from src.config_optimizer import generate_config_recommendation
from src.patterns_config import (
    disabled_pattern_ids,
    normalize_pattern_enabled,
    save_pattern_enabled,
    save_pattern_length,
)
from src.pattern_analyzer import (
    normalize_pattern_lengths,
)
from src.ae_sexy_state import table_codes_match
from playwright.async_api import Page

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("toolbet")

# Render zombie: can nhieu lan check lien tiep — tranh reload khi game binh thuong
_RENDER_ZOMBIE_THRESHOLD = 2
_UI_FAIL_STREAK_THRESHOLD = 3
_STREAM_ZOMBIE_THRESHOLD = 2
# Cho het luong dat cuoc truoc khi reload/khoi phuc
_BET_RECOVERY_GRACE_SEC = 62
# Auto-login: dung sau N lan that bai lien tiep (sai TK/MK hoac captcha)
_LOGIN_FAIL_STOP = 2
# Khi da dung auto-login — khoang cach giua cac lan log nhac
_LOGIN_STOP_LOG_SEC = 30


class HistoryWatcher:
    """Login -> vao phong Baccarat dau tien -> luu lich su van vao DB."""

    def __init__(self):
        self.config = load_config()
        self._config_path = config_path_resolved("config.yaml")
        logging.getLogger().setLevel(self.config.logging.level)

        Path(self.config.database.path).parent.mkdir(parents=True, exist_ok=True)
        self.session_factory = init_db(self.config.database.path)
        self.store = GameDataStore(self.session_factory, self.config.game.provider)
        self.small_stake_guard = SmallStakePilotGuard(
            self.config.database.path,
            default_lease_path(self.config.database.path),
        )
        self.strategy_tab_store = StrategyTabStore(self.session_factory)
        self.strategy_lifecycle = StrategyLifecycleService(self.session_factory)
        self.money_state_store = MoneyStateStore(self.session_factory)
        self._active_money_tab_id = ""
        self.config.strategy_tabs = self.strategy_tab_store.load_or_import(
            self.config.strategy_tabs
        )
        self.state = TableState()
        self.browser_mgr = BrowserManager(cdp_url=self.config.site.cdp_url)
        self.collector: TrafficCollector | None = None
        self.ae_collector: AeSexyCollector | None = None
        self.page: Page | None = None
        license_service = None
        if self.config.license.enabled:
            public_key_path = Path(self.config.license.public_key_path)
            if not public_key_path.exists():
                raise RuntimeError(
                    f"Thiếu license public key: {public_key_path}"
                )
            license_service = LicenseService(
                HttpLicenseBackend(
                    self.config.license.api_url,
                    timeout_seconds=self.config.license.timeout_seconds,
                ),
                public_key_pem=public_key_path.read_bytes(),
                cache_path=self.config.license.cache_path,
                grace_minutes=self.config.license.grace_minutes,
                refresh_before_minutes=(
                    self.config.license.refresh_before_minutes
                ),
            )
        self.tool_auth = ToolAuthService(
            store_path=self.config.tool_auth.account_store_path,
            bootstrap_username=self.config.tool_auth.bootstrap_username,
            bootstrap_password=self.config.tool_auth.bootstrap_password,
            session_timeout_minutes=self.config.tool_auth.session_timeout_minutes,
            enabled=self.config.tool_auth.enabled,
            license_service=license_service,
        )
        self.overlay = GameOverlay()
        self.overlay.configure_ui_runtime(
            runtime_v2_enabled=self.config.ui.runtime_v2_enabled,
            legacy_overlay_enabled=self.config.ui.legacy_overlay_enabled,
        )
        # ``auto_bet`` in the persisted YAML is legacy configuration only.
        # A process must always start stopped; the run switch exists only for
        # this Tool session and is never restored from disk.
        self._run_enabled = False
        # The v2 shell appears immediately, but its controls remain locked
        # until the current table has yielded its first authoritative history.
        self._workspace_loading = True
        self._running_tab_id = ""
        # Kept for compatibility with existing runtime snapshots.  A new Start
        # now cancels/parks old work and arms immediately instead of queuing.
        self._restart_pending_tab_id = ""
        self._restart_pending_after_history_len = 0
        self._live_tab_run_epochs: dict[str, str] = {}
        self.overlay.set_run_enabled(False)
        self.overlay.set_workspace_loading(True)
        self.overlay.set_stakes(self.config.betting.stakes)
        self.overlay.set_betting_ui(
            auto_bet=False,
            stop_loss=self.config.betting.stop_loss,
            take_profit=self.config.betting.take_profit,
            group_take_profit=self.config.betting.group_take_profit,
            group_stop_loss=self.config.betting.group_stop_loss,
            progression_mode=self.config.betting.progression_mode,
            loss_watch_recover=self.config.betting.loss_watch_recover,
        )
        self.overlay.set_save_handler(self._handle_save_stakes)
        self.overlay.set_toggle_handler(self._handle_toggle_auto_bet)
        self.overlay.set_watch_recover_handler(self._handle_toggle_watch_recover)
        self.overlay.set_limits_handler(self._handle_save_limits)
        self.overlay.set_tie_nurture(self.config.betting.tie_nurture)
        self.overlay.set_tie_nurture_handler(self._handle_tie_nurture)
        self._pattern_enabled = normalize_pattern_enabled(self.config.patterns)
        self._pattern_lengths = normalize_pattern_lengths(self.config.pattern_lengths)
        self.overlay.set_pattern_enabled(self._pattern_enabled)
        self.overlay.set_pattern_lengths(self._pattern_lengths)
        self.overlay.set_pattern_toggle_handler(self._handle_toggle_pattern)
        self.overlay.set_pattern_length_handler(self._handle_pattern_length)
        self.overlay.set_suggest_handler(self._handle_suggest_config)
        self.overlay.set_daily_handler(self._handle_daily_analysis)
        self.overlay.set_stats_scope_handler(self._handle_stats_scope)
        # The initial overlay payload reads this process-local state before
        # BettingSession and the Live managers are initialized.
        self._live_run_limits = LiveRunLimitTracker()
        # The first workspace install happens before the first collector
        # refresh. Supply the complete UI payload now so saved strategy and
        # money-manager ids can be rendered immediately.
        self.overlay.set_strategy_tabs(self._overlay_strategy_tabs_payload())
        self.overlay.set_strategy_tabs_handler(self._handle_save_strategy_tabs)
        self.overlay.set_strategy_history_handler(self._handle_load_strategy_history)
        self.overlay.set_ui_command_handler(self._handle_ui_command)
        # Live take-profit/stop-loss belongs to each strategy tab and is
        # process-local.  Legacy YAML/day-P&L limits must not stop Live tabs.
        self.betting_session = BettingSession(
            self.config.betting.stakes,
            progression_mode=self.config.betting.progression_mode,
            loss_watch_recover=self.config.betting.loss_watch_recover,
        )
        self.betting_session.configure(auto_bet=False)
        self._live_money_managers: dict[str, Any] = {}
        persisted_live_tabs = self.strategy_lifecycle.tabs_in_mode(
            TabLifecycleMode.LIVE
        )
        if persisted_live_tabs:
            for persisted_live_tab in persisted_live_tabs:
                manager = self._create_money_manager_for_tab(
                    persisted_live_tab
                )
                self.money_state_store.restore(
                    persisted_live_tab.id,
                    manager,
                )
                self._live_money_managers[persisted_live_tab.id] = manager
            # Restart never resumes execution.  Do not rewrite the user's
            # configuration merely because a new process has started.
            self.overlay.set_betting_ui(
                auto_bet=False,
                stop_loss=0,
                take_profit=0,
                progression_mode="multi_live",
            )
        self.auto_bettor = AutoBettor(self.betting_session, self.store)
        self.auto_bettor.configure_tie_nurture(self.config.betting.tie_nurture)
        recovery_block = self.auto_bettor.restore_durable_pending()
        if (
            recovery_block
            or self.betting_session.state.pending is not None
            or self.auto_bettor.tie.has_pending
        ):
            self.betting_session.configure(auto_bet=False)
            self.overlay.set_betting_ui(
                auto_bet=False,
                stop_loss=self.config.betting.stop_loss,
                take_profit=self.config.betting.take_profit,
                group_take_profit=self.config.betting.group_take_profit,
                group_stop_loss=self.config.betting.group_stop_loss,
                progression_mode=self.config.betting.progression_mode,
                loss_watch_recover=self.config.betting.loss_watch_recover,
            )
        self.auto_bettor.set_disabled_patterns(disabled_pattern_ids(self._pattern_enabled))
        self.auto_bettor.set_pattern_lengths(self._pattern_lengths)
        self.auto_bettor.set_ui_failed_handler(self._on_bet_ui_failed)
        self.auto_bettor.set_healthy_handler(self.note_ui_healthy)
        self.auto_bettor.set_bet_resolved_handler(self._on_bet_resolved_refresh_overlay)
        # The legacy 1-1/Bet×2 comparison pipeline is retired.  Strategy tabs
        # are now the only decision source for simulation and live execution.
        self.auto_bettor.set_decision_shadow_enabled(False)
        self.auto_bettor.set_strategy_tab_live_evaluator(
            self._evaluate_strategy_tab_live
        )
        self.auto_bettor.set_multi_live_result_handler(
            self._resolve_multi_live_allocations
        )
        self.auto_bettor.set_recovery_handler(
            self._recover_quarantined_allocations
        )
        self.auto_bettor.set_runtime_unsafe_handler(self._report_live_runtime_issue)
        self.auto_bettor.set_license_checker(
            self._live_bet_allowed
        )
        self.auto_bettor.set_real_bet_guard(self._check_small_stake_guard)
        self._full_log_done = False
        self._last_history_key: tuple = ()
        self._active_table_id: str = ""
        self._recovery_pending = False
        self._recovering = False
        self._health_fail_streak = 0
        self._recover_urgent = False
        self._need_hard_recover = False  # man den / 1008 — reload, khong click sanh
        self._enter_click_pending = False
        self._conn_fail_streak = 0
        self._render_fail_streak = 0
        self._ui_fail_streak = 0
        self._stream_zombie_streak = 0
        self._last_recover_at = 0.0
        self._last_ui_fail_reason = ""
        self._last_ui_broken_at = 0.0
        self._last_game_phase = PHASE_WEB
        self._ctx = None
        self._lobby_glitch_streak = 0
        self._login_fail_streak = 0
        self._login_auto_stopped = False
        self._last_login_stop_log_at = 0.0
        self._pattern_win_rates: dict[str, dict] = {}
        self._pattern_win_rates_at: float = 0.0
        self._pattern_stats_scope: str = "today"
        self._stake_steps_cache: list[dict] = []
        self._stake_steps_at: float = 0.0
        self._pending_history_table: str = ""
        self._pnl_cache: dict[str, Any] | None = None
        self._pnl_cache_at: float = 0.0
        self._license_refresh_at: float = 0.0

    def _live_bet_allowed(self) -> bool:
        if self.config.live_execution.mode == "disabled":
            return False
        # Local Tool sessions expose live_bet. When remote licensing is on,
        # ToolAuthService.can() verifies the signed capability and expiry.
        return self.tool_auth.can("live_bet")

    def _require_tool_session(self) -> None:
        """Single gate for every screen/action that can lead to a Game session."""

        self.tool_auth.require_session()

    async def logout_tool(self) -> None:
        """End the Tool session. A new run must pass Tool Login before Game Login."""

        self._report_live_runtime_issue("Tool đã đăng xuất")
        self.tool_auth.logout()
        logger.info("Đã đăng xuất Tool; dừng phiên Game hiện tại.")
        if self.page and not self.page.is_closed():
            await self.overlay.remove(self.page)
        await self.browser_mgr.stop()

    async def change_game_account(self, page: Page):
        """Reopen only Game login; it never changes the current Tool session."""

        self._require_tool_session()
        creds = load_credentials(site=self.config.site.url)
        return await prompt_login_panel(
            page,
            site_url=self.config.site.url,
            username=creds.username,
            password=creds.password,
        )

    async def _handle_ui_command(self, command: UiCommand) -> dict:
        if command.type == UiCommandType.TOOL_LOGOUT:
            # Return the bridge response before closing the CDP context.
            asyncio.get_running_loop().create_task(self.logout_tool())
            return {"ok": True, "data": {"screen": "tool_login"}}
        if command.type == UiCommandType.GAME_LOGIN:
            try:
                self._require_tool_session()
            except PermissionError as exc:
                return {"ok": False, "error": str(exc)}
            return {"ok": True, "data": {"screen": "game_login"}}
        if command.type == UiCommandType.SET_TAB_MODE:
            tab_id = str(command.payload.get("tab_id") or "")
            live = bool(command.payload.get("live"))
            try:
                if self.betting_session.state.pending or self.auto_bettor.is_busy:
                    raise ValueError(
                        "Đang có cược/pipeline chưa hoàn tất"
                    )
                status = self.strategy_lifecycle.set_live(
                    tab_id,
                    live=live,
                )
                self.config.strategy_tabs = (
                    self.strategy_tab_store.load_or_import(
                        self.config.strategy_tabs
                    )
                )
                if live:
                    tab = next(
                        (
                            item
                            for item in self.config.strategy_tabs.tabs
                            if item.id == tab_id
                        ),
                        None,
                    )
                    if tab is None:
                        raise ValueError("Không tìm thấy tab vừa bật Live")
                    manager = self._create_money_manager_for_tab(tab)
                    self.money_state_store.restore(tab.id, manager)
                    self._live_money_managers[tab.id] = manager
                else:
                    manager = self._live_money_managers.pop(tab_id, None)
                    if manager is not None:
                        self.money_state_store.save(tab_id, manager)
                return {
                    "ok": True,
                    "data": {
                        "tab_id": tab_id,
                        "auto_bet": self.betting_session.state.auto_bet,
                        **status,
                    },
                }
            except ValueError as exc:
                return {"ok": False, "error": str(exc)}
        if command.type == UiCommandType.SET_RUN_STATE:
            running = bool(command.payload.get("running"))
            tab_id = str(command.payload.get("tab_id") or "")
            try:
                tab = next(
                    (
                        item for item in self.config.strategy_tabs.tabs
                        if item.id == tab_id
                    ),
                    None,
                )
                if tab is None:
                    raise ValueError("KhÃ´ng tÃ¬m tháº¥y tab chiáº¿n lÆ°á»£c")
                if running:
                    self._require_tool_session()
                    bettor = getattr(self, "auto_bettor", None)
                    if bettor is not None:
                        await bettor.abandon_for_operator_restart(
                            self._effective_table_name()
                        )
                        bettor.park_pending_for_table(
                            self._effective_table_name()
                        )
                    preflight = self._live_preflight_status(tab_ids=[tab_id])
                    # An existing physical attempt belongs to the prior run.
                    # It is not safe to click alongside it, but it must not make
                    # the operator's new Start button fail.
                    start_blockers = [
                        item for item in preflight["blockers"]
                        if item["code"] not in {
                            "CLICK_IN_PROGRESS", "ACTIVE_PENDING_FOR_TABLE",
                        }
                    ]
                    if preflight["enabled_live_tabs"] and start_blockers:
                        first = start_blockers[0]
                        raise ValueError(
                            f"{first['code']}: {first['message']}"
                        )
                response = self._handle_set_run_enabled(
                    running,
                    tab_id=tab_id,
                    simulation_only=running and tab.mode != "live",
                )
                if running:
                    self._restart_pending_tab_id = ""
                    self._restart_pending_after_history_len = 0
                if (
                    running
                    and bool(response.get("run_enabled"))
                    and tab.mode == "live"
                ):
                    await self._arm_current_history_after_start()
                refreshed = self._overlay_strategy_tabs_payload()
                self.overlay.set_strategy_tabs(refreshed)
                refreshed_tab = next(
                    (item for item in refreshed.get("tabs", []) if item.get("id") == tab_id),
                    {},
                )
                return {
                    "ok": True,
                    "data": {
                        "tab_id": tab_id,
                        "running": bool(response.get("running")),
                        "run_enabled": bool(response.get("run_enabled")),
                        "auto_bet": bool(response.get("auto_bet")),
                        "restart_pending": False,
                        "live_tabs": int(tab.mode == "live"),
                        "status": refreshed_tab.get("status", {}),
                        "run_profit": refreshed_tab.get("run_profit", 0),
                    },
                }
            except (PermissionError, ValueError) as exc:
                return {"ok": False, "error": str(exc)}
        if command.type == UiCommandType.RESET_TAB_STATISTICS:
            tab_id = str(command.payload.get("tab_id") or "")
            if tab_id not in {tab.id for tab in self.config.strategy_tabs.tabs}:
                return {"ok": False, "error": "KhÃ´ng tÃ¬m tháº¥y tab chiáº¿n lÆ°á»£c"}
            raw_payload = self._strategy_tabs_raw_payload()
            tab = next(
                (item for item in raw_payload.get("tabs", []) if item.get("id") == tab_id),
                None,
            )
            if tab is None:
                return {"ok": False, "error": "KhÃ´ng cÃ³ dữ liệu thá»‘ng kÃª cho tab"}
            status = tab.get("status") if isinstance(tab.get("status"), dict) else {}
            self.strategy_tab_store.reset_statistics(tab_id, status)
            self._live_run_limits.reset_tab(tab_id)
            refreshed = self._overlay_strategy_tabs_payload()
            self.overlay.set_strategy_tabs(refreshed)
            refreshed_tab = next(
                (item for item in refreshed.get("tabs", []) if item.get("id") == tab_id),
                {},
            )
            return {
                "ok": True,
                "data": {
                    "tab_id": tab_id,
                    "statistics_reset": True,
                    "status": refreshed_tab.get("status", {}),
                    "run_profit": refreshed_tab.get("run_profit", 0),
                },
            }
        if command.type == UiCommandType.START_SHADOW:
            tab_id = str(command.payload.get("tab_id") or "")
            try:
                status = self.strategy_lifecycle.start_shadow(tab_id)
                self.config.strategy_tabs = self.strategy_tab_store.load_or_import(
                    self.config.strategy_tabs
                )
                return {"ok": True, "data": {"tab_id": tab_id, **status}}
            except ValueError as exc:
                return {"ok": False, "error": str(exc)}
        if command.type == UiCommandType.PROMOTE_LIVE:
            tab_id = str(command.payload.get("tab_id") or "")
            confirmation = str(command.payload.get("confirmation") or "")
            try:
                self._require_tool_session()
                if self.betting_session.state.pending or self.auto_bettor.is_busy:
                    raise ValueError("Đang có cược/pipeline chưa hoàn tất")
                # Promotion only establishes authority. It must never silently
                # inherit an already-enabled real betting switch.
                if self.betting_session.state.auto_bet:
                    self._apply_execution_enabled(False)
                status = self.strategy_lifecycle.promote_live(
                    tab_id, confirmation=confirmation
                )
                tab = self.strategy_lifecycle.tab_in_mode(TabLifecycleMode.LIVE)
                if tab is None:
                    raise ValueError("Không tìm thấy tab live sau promote")
                manager = self._create_money_manager_for_tab(tab)
                self.money_state_store.restore(tab.id, manager)
                self.betting_session.activate_money_manager(manager)
                self._active_money_tab_id = tab.id
                self.money_state_store.save(tab.id, manager)
                self.config.betting.stakes = list(tab.stakes)
                self.config.betting.stop_loss = tab.stop_loss
                self.config.betting.take_profit = tab.take_profit
                self.config.betting.progression_mode = tab.progression_mode
                self.overlay.set_stakes(tab.stakes)
                self.config.strategy_tabs = self.strategy_tab_store.load_or_import(
                    self.config.strategy_tabs
                )
                logger.warning(
                    "[TAB_LIVE] PROMOTE | tab=%s | auto_bet=false | stake=%s",
                    tab.id,
                    tab.stakes[0],
                )
                return {
                    "ok": True,
                    "data": {
                        "tab_id": tab_id,
                        "auto_bet": False,
                        **status,
                    },
                }
            except (PermissionError, ValueError) as exc:
                return {"ok": False, "error": str(exc)}
        if command.type == UiCommandType.ENABLE_LIVE_BET:
            try:
                self._require_tool_session()
                tab = self.strategy_lifecycle.tab_in_mode(TabLifecycleMode.LIVE)
                if tab is None:
                    raise ValueError("Chưa có tab live")
                confirmation = str(command.payload.get("confirmation") or "")
                if confirmation.strip() != f"BET {tab.name}":
                    raise ValueError(f'Xác nhận phải là "BET {tab.name}"')
                if self.betting_session.state.pending or self.auto_bettor.is_busy:
                    raise ValueError("Đang có cược/pipeline chưa hoàn tất")
                response = self._handle_toggle_auto_bet(True)
                logger.warning(
                    "[TAB_LIVE] AUTO_BET_ON | tab=%s | stake=%s",
                    tab.id,
                    self.betting_session.current_stake,
                )
                return {
                    "ok": True,
                    "data": {
                        "tab_id": tab.id,
                        "auto_bet": bool(response.get("auto_bet")),
                        "stake": self.betting_session.current_stake,
                    },
                }
            except (PermissionError, ValueError) as exc:
                return {"ok": False, "error": str(exc)}
        if command.type in (
            UiCommandType.DEMOTE_LIVE,
            UiCommandType.DISABLE_LIVE_BET,
        ):
            tab_id = str(command.payload.get("tab_id") or "")
            reason = str(command.payload.get("reason") or "Demote thủ công")
            self._apply_execution_enabled(False)
            status = self.strategy_lifecycle.demote(tab_id, reason=reason)
            self._persist_active_money_manager()
            self._deactivate_money_manager_if_safe()
            self.config.strategy_tabs = self.strategy_tab_store.load_or_import(
                self.config.strategy_tabs
            )
            return {"ok": True, "data": {"tab_id": tab_id, **status}}
        return {"ok": False, "error": "Lệnh UI chưa được hỗ trợ"}

    async def _arm_current_history_after_start(self) -> bool:
        """Use the loaded table history immediately after an explicit Start."""

        page = self.page
        history = list(self.state.history or [])
        table_name = self._effective_table_name()
        if page is None or page.is_closed() or not history or not table_name:
            logger.info(
                "[OPERATOR_START] Chua du lich su/ban de tinh ngay; cho du lieu ban"
            )
            return False
        armed = await self.auto_bettor.arm_from_current_history(
            page,
            history,
            table_name=table_name,
            skip_tie=self.config.game.skip_tie,
        )
        logger.info(
            "[OPERATOR_START] %s | ban=%s | history=%d",
            "da arm tu chuoi hien tai" if armed else "khong co lenh hop le",
            table_name,
            len(history),
        )
        return armed

    def _pnl_as_dict(self, summary) -> dict:
        return {
            "profit": summary.profit,
            "total": summary.total,
            "wins": summary.wins,
            "losses": summary.losses,
            "pushes": summary.pushes,
            "pending": summary.pending,
        }

    def _get_pnl_overlay(self) -> dict[str, Any]:
        now = time.monotonic()
        if self._pnl_cache and now - self._pnl_cache_at < 15:
            return self._pnl_cache
        today_s = date.today().isoformat()
        session = self.session_factory()
        try:
            today = pnl_today(session, today=today_s)
            week = pnl_last_days(session, today=today_s, days=7)
        finally:
            session.close()
        self._pnl_cache = {"today": today, "7days": week}
        self._pnl_cache_at = now
        return self._pnl_cache

    def _get_pattern_win_rates(self) -> dict[str, dict]:
        now = time.monotonic()
        if self._pattern_win_rates and now - self._pattern_win_rates_at < 30:
            return self._pattern_win_rates
        today_s = date.today().isoformat()
        session = self.session_factory()
        try:
            if self._pattern_stats_scope == "7days":
                start = (date.today() - timedelta(days=6)).isoformat()
                self._pattern_win_rates = pattern_win_rates_by_id(
                    session, start_date=start, end_date=today_s
                )
            else:
                self._pattern_win_rates = pattern_win_rates_by_id(
                    session, session_date=today_s
                )
        finally:
            session.close()
        self._pattern_win_rates_at = now
        return self._pattern_win_rates

    def invalidate_live_stats(self) -> None:
        """Xoa cache thong ke live — goi khi co cuoc moi ket qua."""
        self._pattern_win_rates_at = 0.0
        self._stake_steps_at = 0.0
        self._pnl_cache_at = 0.0

    def invalidate_pattern_win_rates(self) -> None:
        self.invalidate_live_stats()

    @staticmethod
    def _create_money_manager_for_tab(tab):
        return create_money_manager(
            tab.money_manager_id,
            tab.stakes,
            stake_chains=tab.stake_chains,
            # Per-run limits are tracked separately so persisted capital state
            # never carries an old run's P&L into the next Start.
            stop_loss=0,
            take_profit=0,
            auto_reset_on_nonnegative_pnl=tab.auto_reset_on_nonnegative_pnl,
        )

    def _sync_live_money_managers(self) -> None:
        live_tabs = self.strategy_lifecycle.tabs_in_mode(
            TabLifecycleMode.LIVE
        )
        live_ids = {tab.id for tab in live_tabs}
        for tab_id in list(self._live_money_managers):
            if tab_id not in live_ids:
                manager = self._live_money_managers.pop(tab_id)
                self.money_state_store.save(tab_id, manager)
        for tab in live_tabs:
            manager = self._live_money_managers.get(tab.id)
            configured = self._create_money_manager_for_tab(tab)
            if (
                manager is not None
                and money_config_fingerprint(manager)
                == money_config_fingerprint(configured)
            ):
                continue
            restored = self.money_state_store.restore(tab.id, configured)
            self._live_money_managers[tab.id] = configured
            # A stake/configuration edit must take effect in the live manager
            # immediately, just like the old single BettingSession.set_stakes().
            # Persist the fresh state so a later overlay/table reload cannot
            # restore the obsolete quote.
            if manager is not None and not restored:
                self.money_state_store.save(tab.id, configured)

    def _persist_active_money_manager(self) -> None:
        manager = self.betting_session.active_money_manager
        if manager is None:
            return
        tab_id = self._active_money_tab_id
        if not tab_id:
            tab = self.strategy_lifecycle.tab_in_mode(TabLifecycleMode.LIVE)
            tab_id = tab.id if tab is not None else ""
        if not tab_id:
            return
        self.money_state_store.save(tab_id, manager)

    def _reset_live_money_for_new_run(self, tab_id: str) -> None:
        """Start a new operator run from the first stake, not old SQLite P&L."""

        tab = next(
            (
                item for item in self.strategy_lifecycle.tabs_in_mode(
                    TabLifecycleMode.LIVE
                )
                if item.id == tab_id
            ),
            None,
        )
        if tab is None:
            return
        manager = self._live_money_managers.get(tab.id)
        if manager is None:
            manager = self._create_money_manager_for_tab(tab)
            self._live_money_managers[tab.id] = manager
        manager.reset()
        self.money_state_store.save(tab.id, manager)

        active_manager = self.betting_session.active_money_manager
        active_tab_id = self._active_money_tab_id
        if active_manager is not None and active_tab_id == tab_id:
            active_manager.reset()
            self.money_state_store.save(active_tab_id, active_manager)

        logger.info("[RUN_START] Reset money manager: %s", tab.id)

    def _status_with_live_quote(
        self, tab_id: str, status: dict[str, Any]
    ) -> dict[str, Any]:
        """Show the active run's actual money level instead of replay history."""

        manager = self._live_money_managers.get(tab_id)
        if manager is None:
            return status
        quote = manager.quote()
        current = dict(status.get("current") or {})
        current.update(
            stake=quote.stake,
            level=quote.level_index + 1,
            total_levels=quote.total_levels,
        )
        return {**status, "current": current}

    def _deactivate_money_manager_if_safe(self) -> None:
        manager = self.betting_session.active_money_manager
        if manager is None or self.betting_session.state.pending is not None:
            return
        self.betting_session.deactivate_money_manager()
        self._active_money_tab_id = ""

    def _on_bet_resolved_refresh_overlay(self) -> None:
        """
        Ket qua cuoc duoc resolve bat dong bo trong AutoBettor sau khi _analyze_patterns
        cua on_history_update da render xong, nen can force refresh overlay ngay.
        """
        self.invalidate_live_stats()
        self._persist_active_money_manager()
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._analyze_patterns(full=True))
        except RuntimeError:
            # Khong co event loop dang chay (khong ky vong), bo qua an toan.
            pass

    def _get_stake_steps_today(self) -> list[dict]:
        now = time.monotonic()
        if self._stake_steps_cache and now - self._stake_steps_at < 30:
            return self._stake_steps_cache
        stakes = list(self.config.betting.stakes)
        session = self.session_factory()
        try:
            by_index = stake_index_stats_daily(session, session_date=date.today().isoformat())
            self._stake_steps_cache = stake_steps_for_overlay(stakes, by_index)
        finally:
            session.close()
        self._stake_steps_at = now
        return self._stake_steps_cache

    def _stake_steps_overlay_meta(self) -> tuple[str, str]:
        steps = self._get_stake_steps_today()
        total = sum(s.get("total", 0) for s in steps)
        if total <= 0:
            return "Win% hom nay theo tung buoc", "chua co cuoc ket qua"
        low = sum(1 for s in steps if s.get("low_confidence") and s.get("total", 0) > 0)
        warn = f"~ = < {3} cuoc/buoc" if low else ""
        return f"Win% hom nay ({total} cuoc)", warn

    def _handle_stats_scope(self, scope: str) -> dict:
        scope = (scope or "").strip().lower()
        if scope not in ("today", "7days"):
            return {"ok": False, "error": "scope khong hop le"}
        self._pattern_stats_scope = scope
        self.invalidate_live_stats()
        return {"ok": True, "scope": scope}

    def _handle_daily_analysis(self) -> dict:
        try:
            from src.ae_sexy_betting import chip_values_for_count
            from src.bet_replay import analyze_daily_stakes, render_daily_stake_html
            from src.pattern_discovery import analyze_day_patterns, render_daily_pattern_html

            table = self._effective_table_name()
            session = self.session_factory()
            try:
                stake_data = analyze_daily_stakes(
                    session,
                    session_date=date.today().isoformat(),
                    current_stakes=list(self.config.betting.stakes),
                    table_name=table,
                    chip_values=chip_values_for_count(5),
                )
                pat_data = analyze_day_patterns(
                    session,
                    session_date=date.today().isoformat(),
                    table_name=table,
                    stakes=list(self.config.betting.stakes),
                    skip_tie=bool(self.config.game.skip_tie),
                )
            finally:
                session.close()
            if stake_data["bet_count"] < 1 and pat_data["round_count"] < 5:
                return {"ok": False, "error": "Chua du du lieu van/cuoc hom nay"}
            html = render_daily_pattern_html(pat_data)
            if stake_data["bet_count"] >= 1:
                html += render_daily_stake_html(stake_data)
            return {"ok": True, "html": html}
        except Exception as exc:
            logger.warning("Phan tich ngay that bai: %s", exc)
            return {"ok": False, "error": str(exc)}

    def note_ui_healthy(self) -> None:
        """Goi khi chip/UI dat cuoc hoat dong binh thuong."""
        self._render_fail_streak = 0
        self._stream_zombie_streak = 0

    def _round_meta_for_history(
        self, table_name: str, history: list[BetSide], start_index: int = 0
    ) -> dict[int, dict]:
        """Map bead_index -> gameShoe/gameRound; hydrate DB cache cho shoe hien tai."""
        round_meta: dict[int, dict] = {}
        if not self.ae_collector or not history:
            return round_meta
        game_shoe = None
        for idx in range(start_index, len(history)):
            meta = self.ae_collector.get_round_meta(table_name, idx)
            round_meta[idx] = meta
            if not game_shoe and meta.get("game_shoe"):
                game_shoe = int(meta["game_shoe"])
        if game_shoe:
            n = self.store.hydrate_saved_rounds(table_name, game_shoe)
            if n:
                logger.debug("DB hydrate: %d round da luu shoe %s", n, game_shoe)
        return round_meta

    def _on_ui_broken(self, reason: str) -> None:
        """UI game den/mat — uu tien reload. Debounce de tranh spam log/loop."""
        if self._recovering:
            return
        import time as _time

        now = _time.monotonic()
        last = float(getattr(self, "_last_ui_broken_at", 0.0) or 0.0)
        if self._need_hard_recover and (now - last) < 15.0:
            return
        if (now - last) < 8.0 and (self._last_ui_fail_reason or "") == (reason or ""):
            return
        self._last_ui_broken_at = now
        self._last_ui_fail_reason = reason
        logger.warning("[PHIEN] UI_HONG | %s — yeu cau khoi phuc", reason)
        # Man den / stream / zombie → HARD reload (khong click sanh)
        if self._requires_hard_reload(reason or ""):
            self._need_hard_recover = True
        self._recover_urgent = True

    async def _room_has_black_video(self, page: Page) -> bool:
        """Trong ban (chip) nhung video den — can reload, khong MAT_BAN."""
        try:
            from src.ae_sexy import probe_game_shell_health, probe_room_stream_health
            from src.ae_sexy_betting import probe_betting_phase

            stream = await probe_room_stream_health(page)
            shell = await probe_game_shell_health(page)
            bet = await probe_betting_phase(page)
            chips = bool(bet.get("chipsVisible") or bet.get("zoneVisible"))
            black = bool(
                (stream.get("blackScreen") or shell.get("blackScreen"))
                and (
                    stream.get("streamDead")
                    or stream.get("videoDead")
                    or shell.get("videoDead")
                    or not stream.get("streamOk")
                )
            )
            return bool(black and chips)
        except Exception:
            return False

    def _on_need_enter_table(self, reason: str) -> None:
        """Collector: dang o sanh — CLICK NGAY, khong chi set flag cho watch 3s."""
        if getattr(self, "_enter_click_pending", False):
            return
        if self._recovering:
            return
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        self._enter_click_pending = True

        async def _click_now():
            try:
                await asyncio.sleep(0.15)  # gom nhieu CAN_CLICK trong 1 tick
                if self._recovering:
                    return
                page = self.page
                ctx = self._ctx
                if page is None or page.is_closed():
                    return
                table = self._effective_table_name()
                # Dang trong ban (chip) — bo qua false CAN_CLICK tu hall an / WS sanh
                if not await self._is_stuck_in_lobby(page, table):
                    if self.ae_collector:
                        self.ae_collector.set_in_room(True)
                    self._recover_urgent = False
                    logger.debug("Bo qua CAN_CLICK (%s) — dang trong ban", reason)
                    return
                self._recover_urgent = True
                if self.ae_collector:
                    self.ae_collector.set_in_room(False)
                    self.ae_collector.set_table_ready(False)
                logger.warning(
                    "[PHIEN] CLICK_NGAY | ban=%s | %s",
                    table,
                    reason,
                )
                if self.auto_bettor.is_busy:
                    await self.auto_bettor.cancel_bet_watch()
                page = await self._handle_stuck_in_lobby(
                    ctx or page.context,
                    page,
                    table,
                    feed_len=len(self.state.history),
                )
                self._set_active_page(page)
                self._bind_page_recovery_events(page)
                try:
                    await self._install_overlay_on_ae(page)
                except Exception:
                    pass
                if self.ae_collector and self.ae_collector.in_room:
                    self._recover_urgent = False
            except Exception as exc:
                logger.warning("CLICK_NGAY loi: %s", exc)
                self._recover_urgent = True
            finally:
                self._enter_click_pending = False

        loop.create_task(_click_now())

    def _effective_table_name(self) -> str:
        """Ban dang choi thuc te (uu tien state sau detect DOM / WS)."""
        return (
            (self.state.table_name or self.config.game.table_name or "").strip()
            or "Baccarat C01"
        )

    async def _detect_runtime_table(self, page: Page) -> str:
        """Phat hien ban dang mo — DOM > probe > WS gan nhat."""
        room_table = (await detect_room_table_name(page) or "").strip()
        if room_table:
            return normalize_baccarat_table_name(room_table)
        probe = await probe_game_state(page, "", self.ae_collector)
        if probe.room_table:
            return normalize_baccarat_table_name(probe.room_table)
        if self.ae_collector:
            ws_name = self.ae_collector.dominant_ws_table_name()
            if ws_name:
                return normalize_baccarat_table_name(ws_name)
        return ""

    async def _sync_table_on_poll(self) -> None:
        if self.page and not self.page.is_closed():
            await self._sync_runtime_table_from_page(self.page)

    async def _sync_runtime_table_from_page(
        self,
        page: Page,
        *,
        reload_history: bool = False,
    ) -> str:
        """Dong bo state/collector theo ban thuc te tren man hinh."""
        probe = await probe_game_state(page, "", self.ae_collector)
        from src.ae_sexy_state import probe_in_room

        if not probe_in_room(probe, ""):
            return self._effective_table_name()

        detected = await self._detect_runtime_table(page)
        if not detected and probe.room_table:
            detected = normalize_baccarat_table_name(probe.room_table)
        if not detected:
            return self._effective_table_name()

        current = normalize_baccarat_table_name(self.state.table_name or "")
        if current != detected:
            self._apply_runtime_table(detected, reason="detected_room")
            ready = await self._is_table_ready(page, detected)
            if ready:
                await self._reload_table_history(page, detected)
                self._pending_history_table = ""
            else:
                self._pending_history_table = detected
                logger.warning(
                    "Doi sang %s — cho ban load xong de nap lich su",
                    detected,
                )
        elif reload_history or self._pending_history_table == detected:
            ready = await self._is_table_ready(page, detected)
            if ready and (not self.state.history or self._pending_history_table):
                await self._reload_table_history(page, detected)
                self._pending_history_table = ""
            elif not self.state.history and not ready:
                self._pending_history_table = detected
        elif not self.state.history:
            ready = await self._is_table_ready(page, detected)
            if ready:
                await self._reload_table_history(page, detected)
        return detected

    def _apply_runtime_table(self, table_name: str, *, reason: str = "") -> None:
        """Cap nhat ban dang choi (vd fallback C01 -> C08)."""
        table_name = normalize_baccarat_table_name(table_name)
        prev = normalize_baccarat_table_name(self.state.table_name or "")
        if prev and prev != table_name:
            logger.warning(
                "Doi ban %s -> %s (%s)",
                prev,
                table_name,
                describe_table_pick(reason) if reason in (
                    "fallback_c02", "fallback_first", "detected_room"
                ) else reason or "doi ban",
            )
            self.state.history = []
            self._reset_table_caches()
            if self.ae_collector:
                self.ae_collector.reset_for_table(table_name)
            self._workspace_loading = True
            self.overlay.set_workspace_loading(True)
        elif reason and reason not in ("preferred", "preferred_blind", "continue_in_room"):
            logger.warning(
                "Chuyen sang ban %s — %s",
                table_name,
                describe_table_pick(reason),
            )
        self.state.table_name = table_name
        self.state.table_id = table_name
        self._active_table_id = table_name
        if self.ae_collector:
            self.ae_collector.table_name = table_name

    async def _is_stuck_in_lobby(self, page: Page, target_name: str) -> bool:
        """That su dang o sanh — can vao lai ban, khong phai loi render."""
        from src.ae_sexy import (
            _gamehall_iframe_visible,
            _has_visible_room_bet_ui,
            _lobby_grid_visible,
        )

        table = self._effective_table_name() or target_name
        # UU TIEN: chip/zone trong ban → KHONG stuck (tranh dem hall an → 19 the ao)
        if await _has_visible_room_bet_ui(page) and not await _gamehall_iframe_visible(page):
            if self.ae_collector:
                self.ae_collector.set_in_room(True)
            return False
        try:
            from src.ae_sexy_betting import probe_betting_phase

            bet_ui = await probe_betting_phase(page)
            if (bet_ui.get("chipsVisible") or bet_ui.get("zoneVisible")) and not await _gamehall_iframe_visible(
                page
            ):
                if self.ae_collector:
                    self.ae_collector.set_in_room(True)
                return False
        except Exception:
            pass
        if await is_ae_sexy_in_room(page, table, self.ae_collector):
            return False
        # Luoi the sanh HIEN that
        lobby_grid = False
        try:
            lobby_grid = await _lobby_grid_visible(page)
        except Exception:
            lobby_grid = False
        if lobby_grid or await is_ae_sexy_lobby(page):
            if self.ae_collector:
                self.ae_collector.set_in_room(False)
            return True
        room_table = (await detect_room_table_name(page) or "").strip()
        if room_table:
            probe = await probe_game_state(page, "", self.ae_collector)
            from src.ae_sexy_state import probe_in_room

            if probe_in_room(probe, ""):
                return False
        try:
            phase = await detect_ae_sexy_phase(page, table, self.ae_collector)
        except Exception:
            return False
        return phase == PHASE_LOBBY and bool(self.state.table_name)

    async def _handle_stuck_in_lobby(
        self, ctx, page: Page, target_name: str, *, feed_len: int = 0
    ) -> Page:
        """Tu dong vao lai ban khi bi day ve sanh."""
        table = self._effective_table_name() or target_name
        # Xac nhan lai — tranh false lobby (hall an) khi dang cuoc trong ban
        if not await self._is_stuck_in_lobby(page, table):
            if self.ae_collector:
                self.ae_collector.set_in_room(True)
            self._recover_urgent = False
            logger.info("Van trong ban %s — bo qua click sanh (false lobby)", table)
            return page
        if self.ae_collector:
            self.ae_collector.set_in_room(False)
            self.ae_collector.set_table_ready(False)
        if feed_len:
            logger.warning(
                "Dang o sanh (feed HTTP %d van) — vao lai ban %s de xem video va cuoc",
                feed_len,
                table,
            )
        else:
            logger.warning("Dang o sanh — vao lai ban %s de xem video va cuoc", table)
        await self._analyze_patterns(full=True)
        # Dang o sanh → luon huy cuoc/cho va CLICK — khong hoan
        if self.auto_bettor.is_busy:
            logger.warning("Huy cho/dat cuoc — uu tien click vao ban tu sanh")
            await self.auto_bettor.cancel_bet_watch()
        page = await self._try_reenter_table(ctx, page, table) or page
        self._set_active_page(page)
        self._bind_page_recovery_events(page)
        active = self._effective_table_name()
        if self.ae_collector and await is_ae_sexy_in_room(page, active, self.ae_collector):
            self.ae_collector.set_in_room(True)
            ready = await is_ae_sexy_table_ready(page, active, self.ae_collector)
            self.ae_collector.set_table_ready(ready)
            if ready:
                await self._reload_table_history(page, active)
            self._recover_urgent = False
        elif not await is_ae_sexy_in_room(page, active, self.ae_collector):
            self._recover_urgent = True
        self._last_game_phase = await detect_ae_sexy_phase(page, active, self.ae_collector)
        return page

    @staticmethod
    def _requires_hard_reload(ui_reason: str) -> bool:
        """Man den / stream zombie / render hong — can reload trang, khong soft recovery."""
        low = (ui_reason or "").lower()
        return any(
            k in low
            for k in (
                "man hinh den",
                "mat stream",
                "zombie",
                "render hong",
                "iframe game",
                "mat iframe",
                "session game het han",
                "trang bi disable",
            )
        )

    def _on_bet_ui_failed(self, shell: dict | None = None, stream: dict | None = None) -> None:
        """Tang dem nghi render/stream loi — khoi phuc sau nhieu lan xac nhan."""
        if (shell or {}).get("lobbyKick") or (stream or {}).get("lobbyKick"):
            self._report_live_runtime_issue("Bị đẩy khỏi bàn")
            logger.warning("[PHIEN] MAT_BAN | bi day ra sanh — can vao lai ban")
            self._recover_urgent = True
            if self.ae_collector:
                self.ae_collector.set_in_room(False)
                self.ae_collector.set_table_ready(False)
            return
        if self.auto_bettor.is_busy:
            return
        stream_dead = bool((shell or {}).get("streamDead") or (stream or {}).get("streamDead"))
        has_road = bool((shell or {}).get("hasRoad") or (stream or {}).get("hasRoad"))
        if stream_dead and has_road:
            self._stream_zombie_streak += 2
            logger.warning(
                "Dat cuoc that bai + stream zombie (%d/%d)",
                self._stream_zombie_streak,
                _STREAM_ZOMBIE_THRESHOLD,
            )
            if self._stream_zombie_streak >= _STREAM_ZOMBIE_THRESHOLD:
                self._report_live_runtime_issue("Game stream/UI không an toàn")
                self._recover_urgent = True
            return
        if not shell or not shell.get("renderBroken"):
            return
        self._render_fail_streak += 2
        logger.warning(
            "Dat cuoc that bai + chip khong hien (%d/%d)",
            self._render_fail_streak,
            _RENDER_ZOMBIE_THRESHOLD,
        )
        if self._render_fail_streak >= _RENDER_ZOMBIE_THRESHOLD:
            self._recover_urgent = True

    def _handle_save_stakes(self, text: str) -> dict:
        try:
            stakes = parse_stakes_text(text)
            from src.ae_sexy_betting import chip_values_for_count, validate_progression_stakes

            bad = validate_progression_stakes(stakes, chip_values_for_count(5))
            if bad:
                return {
                    "ok": False,
                    "error": (
                        f"Muc {bad} khong dat chinh xac bang chip ban "
                        f"(10/20/50/100/200) — doi chuoi hoac chip ban"
                    ),
                }
            save_stakes_to_config(stakes, self._config_path)
            self.config.betting.stakes = stakes
            self.overlay.set_stakes(stakes)
            self.betting_session.set_stakes(stakes)
            self.invalidate_live_stats()
            logger.info("Da luu chuoi cuoc: %s", format_stakes(stakes))
            return {"ok": True, "display": format_stakes(stakes)}
        except Exception as exc:
            logger.warning("Luu chuoi cuoc that bai: %s", exc)
            return {"ok": False, "error": str(exc)}

    def _enabled_tabs(self, mode: TabLifecycleMode) -> list:
        return list(self.strategy_lifecycle.tabs_in_mode(mode))

    @staticmethod
    def _issue(code: str, message: str, **extra) -> dict:
        return {"code": code, "message": message, **extra}

    def _live_preflight_status(self, *, tab_ids: list[str] | None = None) -> dict:
        requested_ids = set(tab_ids or ())
        live_tabs = [
            tab for tab in self._enabled_tabs(TabLifecycleMode.LIVE)
            if not requested_ids or tab.id in requested_ids
        ]
        simulation_tabs = [
            tab for tab in self._enabled_tabs(TabLifecycleMode.SIMULATION)
            if not requested_ids or tab.id in requested_ids
        ]
        table_name = self._effective_table_name()
        summary = self.store.pending_status_summary(table_name=table_name)
        blockers: list[dict] = []
        warnings: list[dict] = []
        mode = self.config.live_execution.mode

        if live_tabs:
            if not self.tool_auth.is_authenticated():
                blockers.append(self._issue(
                    "TOOL_SESSION_REQUIRED", "Tool session chưa hợp lệ"
                ))
            if mode == "disabled":
                blockers.append(self._issue(
                    "LIVE_EXECUTION_DISABLED",
                    "live_execution.mode đang là disabled",
                ))
            if not self.tool_auth.can("live_bet"):
                blockers.append(self._issue(
                    "LIVE_CAPABILITY_BLOCKED",
                    "Tool/license không có capability live_bet hợp lệ",
                ))
            runtime = inspect_pilot_runtime(self.config.database.path)
            blockers.extend(
                self._issue("LIVE_CONFIG_INVALID", message)
                for message in runtime.errors
            )
            if self.auto_bettor.is_busy:
                blockers.append(self._issue(
                    "CLICK_IN_PROGRESS", "Pipeline click đang hoạt động"
                ))
            if summary["active"]:
                blockers.append(self._issue(
                    "ACTIVE_PENDING_FOR_TABLE",
                    f"Bàn {table_name or '?'} có pending active chưa hoàn tất",
                ))
            if self.auto_bettor.durable_block_reason:
                blockers.append(self._issue(
                    "DURABLE_EXECUTION_BLOCK",
                    self.auto_bettor.durable_block_reason,
                ))
            if mode == "pilot" and runtime.maximum_stake > 0:
                decision = self.small_stake_guard.evaluate(
                    stake=runtime.maximum_stake,
                    tab_ids=list(runtime.live_tab_ids),
                    bet_kind="main",
                )
                if not decision.allowed:
                    blockers.append(self._issue(
                        "PILOT_LEASE_REQUIRED", decision.reason
                    ))

        if summary["deferred"]:
            warnings.append(self._issue(
                "DEFERRED_PENDING_WARNING",
                f"Có {summary['deferred']} cược cũ chưa đối chiếu",
                count=summary["deferred"],
            ))
        if summary["quarantined"]:
            warnings.append(self._issue(
                "QUARANTINED_UNCERTAIN_WARNING",
                f"Có {summary['quarantined']} cược cũ không chắc đã click",
                count=summary["quarantined"],
                recovery_epochs=self.money_state_store.recovery_epochs(),
            ))
        return {
            "allowed": not blockers,
            "blockers": blockers,
            "warnings": warnings,
            "enabled_live_tabs": len(live_tabs),
            "enabled_simulation_tabs": len(simulation_tabs),
            "pending": summary,
            "mode": mode,
        }

    def _handle_set_run_enabled(
        self, enabled: bool, *, tab_id: str = "", simulation_only: bool = False
    ) -> dict:
        """Run one operator-selected tab; another tab never joins its bet."""

        was_running = self._run_enabled
        previous_tab_id = getattr(self, "_running_tab_id", "")
        started_new_tab = bool(enabled and tab_id and previous_tab_id != tab_id)
        if enabled and tab_id and previous_tab_id and previous_tab_id != tab_id:
            # Starting another tab transfers the single execution slot and
            # clears any arm belonging to the previous strategy.
            self._apply_execution_enabled(False)
        if enabled and tab_id:
            self._running_tab_id = tab_id
        elif not enabled and (not tab_id or tab_id == self._running_tab_id):
            self._running_tab_id = ""
        actual = self._apply_execution_enabled(
            bool(self._running_tab_id), ignore_durable=simulation_only
        )
        if enabled and actual and started_new_tab:
            self._reset_live_money_for_new_run(tab_id)
            self._live_run_limits.reset_tab(tab_id)
        self._run_enabled = bool(self._running_tab_id) and bool(actual)
        if self._run_enabled and not was_running:
            epochs = getattr(self, "_live_tab_run_epochs", None)
            if epochs is None:
                epochs = self._live_tab_run_epochs = {}
            epochs[tab_id] = self.auto_bettor.begin_run_epoch()
        if not enabled and tab_id == getattr(self, "_restart_pending_tab_id", ""):
            self._restart_pending_tab_id = ""
            self._restart_pending_after_history_len = 0
        self.overlay.set_run_enabled(self._run_enabled)
        return {
            "ok": actual == enabled,
            "run_enabled": self._run_enabled,
            "running": bool(tab_id and tab_id == self._running_tab_id),
            "active_tab_id": self._running_tab_id,
            "auto_bet": self.betting_session.state.auto_bet,
            "restart_pending": tab_id == getattr(self, "_restart_pending_tab_id", ""),
            "error": (
                self.auto_bettor.durable_block_reason
                if enabled and not actual
                else ""
            ),
        }

    def _apply_execution_enabled(
        self, enabled: bool, *, ignore_durable: bool = False
    ) -> bool:
        """Toggle betting execution without changing the operator run latch."""

        actual = self.auto_bettor.on_toggle(
            enabled, ignore_durable=ignore_durable
        )
        self.overlay.set_betting_ui(
            auto_bet=actual,
            stop_loss=self.config.betting.stop_loss,
            take_profit=self.config.betting.take_profit,
            group_take_profit=self.config.betting.group_take_profit,
            group_stop_loss=self.config.betting.group_stop_loss,
            progression_mode=self.config.betting.progression_mode,
            loss_watch_recover=self.config.betting.loss_watch_recover,
        )
        return bool(actual)

    # Compatibility callback used by the legacy overlay.
    def _handle_toggle_auto_bet(self, enabled: bool) -> dict:
        return self._handle_set_run_enabled(enabled)

    def _handle_toggle_watch_recover(self, enabled: bool) -> dict:
        enabled = bool(enabled)
        save_betting_to_config(config_path=self._config_path, loss_watch_recover=enabled)
        self.config.betting.loss_watch_recover = enabled
        self.betting_session.configure(loss_watch_recover=enabled)
        self.overlay.set_betting_ui(
            auto_bet=self.betting_session.state.auto_bet,
            stop_loss=self.config.betting.stop_loss,
            take_profit=self.config.betting.take_profit,
            group_take_profit=self.config.betting.group_take_profit,
            group_stop_loss=self.config.betting.group_stop_loss,
            progression_mode=self.config.betting.progression_mode,
            loss_watch_recover=enabled,
        )
        logger.info("loss_watch_recover: %s", "BAT" if enabled else "TAT")
        return {"ok": True, "loss_watch_recover": enabled}

    def _overlay_betting_payload(self) -> dict:
        from src.tie_nurture_config import tie_nurture_to_overlay

        data = self.betting_session.overlay_status()
        data["run_enabled"] = bool(self._run_enabled)
        data["run_epoch"] = self.auto_bettor.run_epoch
        data["same_round"] = self.auto_bettor.same_round_snapshot()
        preflight = self._live_preflight_status()
        data["live_execution_mode"] = preflight["mode"]
        data["live_preflight_allowed"] = preflight["allowed"]
        data["active_pending"] = preflight["pending"]["active"]
        data["deferred_pending_count"] = preflight["pending"]["deferred"]
        data["quarantined_pending_count"] = preflight["pending"]["quarantined"]
        data["live_blockers"] = preflight["blockers"]
        data["live_warnings"] = preflight["warnings"]
        data["enabled_simulation_tabs"] = preflight["enabled_simulation_tabs"]
        data["enabled_live_tabs"] = preflight["enabled_live_tabs"]
        data["tie_nurture"] = tie_nurture_to_overlay(self.config.betting.tie_nurture)
        data["tie_nurture_live"] = self.auto_bettor.tie.status()
        data["decision_shadow"] = self.auto_bettor.decision_shadow_status()
        return data

    def _strategy_tabs_raw_payload(self) -> dict:
        return strategy_tabs_to_overlay(
            self.config.strategy_tabs,
            list(self.state.history or []),
            skip_tie=self.config.game.skip_tie,
            disabled_patterns=disabled_pattern_ids(self._pattern_enabled),
            pattern_lengths=self._pattern_lengths,
        )

    def _overlay_strategy_tabs_payload(self) -> dict:
        payload = self._strategy_tabs_raw_payload()
        table_name = self._effective_table_name()
        # Stopped sessions may keep collecting authoritative results, but they
        # must not create new simulation decision/history snapshots.
        if self._run_enabled:
            self.strategy_tab_store.record_overlay(payload, table_name=table_name)
        money_configs = self.strategy_tab_store.money_configs_for_tabs(
            [str(tab.get("id") or "") for tab in payload.get("tabs", [])]
        )
        statistics_baselines = self.strategy_tab_store.statistics_baselines_for_tabs(
            [str(tab.get("id") or "") for tab in payload.get("tabs", [])]
        )
        lifecycle = self.strategy_lifecycle.status()
        for tab in payload.get("tabs", []):
            tab_id = str(tab.get("id") or "")
            tab["running"] = tab_id == getattr(self, "_running_tab_id", "")
            status = tab.get("status") if isinstance(tab.get("status"), dict) else {}
            status = self.strategy_tab_store.apply_statistics_baseline(
                status, statistics_baselines.get(tab_id, {})
            )
            if tab["running"]:
                status = self._status_with_live_quote(tab_id, status)
            tab["status"] = status
            history_page = self.strategy_tab_store.history_page(tab_id)
            tab["history"] = history_page["items"]
            tab["history_pagination"] = {
                key: value for key, value in history_page.items() if key != "items"
            }
            tab["money_configs"] = money_configs.get(tab_id, {})
            tab["lifecycle"] = lifecycle.get(
                tab_id,
                {
                    "mode": "simulation",
                    "shadow_evaluations": 0,
                    "shadow_matches": 0,
                    "shadow_mismatches": 0,
                    "shadow_errors": 0,
                    "qualifies": False,
                    "demote_reason": "",
                },
            )
            tab["lifecycle"] = {
                **tab["lifecycle"],
                "restart_pending": tab_id == getattr(self, "_restart_pending_tab_id", ""),
            }
            tab["mode"] = tab["lifecycle"]["mode"]
            run_limit = self._live_run_limits.status_for(tab_id)
            tab["run_profit"] = run_limit.profit
            tab["run_limit_hit"] = run_limit.limit_hit
        return payload

    def _handle_load_strategy_history(self, payload: dict) -> dict:
        tab_id = str((payload or {}).get("tab_id") or "")
        if tab_id not in {tab.id for tab in self.config.strategy_tabs.tabs}:
            return {"ok": False, "error": "Không tìm thấy tab chiến lược"}
        data = self.strategy_tab_store.history_page(
            tab_id,
            page=int((payload or {}).get("page") or 1),
            page_size=int((payload or {}).get("page_size") or 10),
        )
        return {"ok": True, "data": data}

    def _reload_workspace_for_overlay(self) -> None:
        """Rehydrate SQLite-owned tabs only when the workspace is installed."""
        self.config.strategy_tabs = self.strategy_tab_store.load_or_import(
            self.config.strategy_tabs
        )
        self._sync_live_money_managers()
        self.overlay.set_strategy_tabs(self._overlay_strategy_tabs_payload())

    async def _install_workspace_overlay(
        self, page: Page, *, allow_early_host: bool = False
    ) -> bool:
        self._reload_workspace_for_overlay()
        return await self.overlay.install(
            page,
            stakes=self.config.betting.stakes,
            allow_early_host=allow_early_host,
        )

    async def _install_early_workspace_overlay(self, page: Page, *, stage: str) -> bool:
        """Show the locked workspace before table entry/history collection."""
        self._workspace_loading = True
        self.overlay.set_workspace_loading(True)
        ok = await self._install_workspace_overlay(page, allow_early_host=True)
        logger.info(
            "[OVERLAY_EARLY_INSTALL] stage=%s ok=%s url=%s",
            stage,
            ok,
            (page.url or "")[:80],
        )
        return ok

    def _evaluate_strategy_tab_shadow(
        self,
        *,
        history: list[BetSide],
        table_name: str,
        skip_tie: bool,
        source: str,
        shuffling: bool,
        legacy,
    ) -> None:
        tab = self.strategy_lifecycle.tab_in_mode(
            TabLifecycleMode.SHADOW,
            TabLifecycleMode.LIVE_CANDIDATE,
        )
        if tab is None:
            return
        try:
            result = self.strategy_lifecycle.evaluate(
                tab=tab,
                history=history,
                table_name=table_name,
                source=source,
                skip_tie=skip_tie,
                progression=self.betting_session.progression,
                auto_bet=self.betting_session.state.auto_bet,
                license_allowed=self._live_bet_allowed(),
                pending_main=self.betting_session.state.pending is not None,
                pending_tie=self.auto_bettor.tie.has_pending,
                round_already_placed=False,
                shuffling=shuffling,
                source_allowed=not source or source in BET_TRIGGER_SOURCES,
                disabled_patterns=disabled_pattern_ids(self._pattern_enabled),
                pattern_lengths=self._pattern_lengths,
                daily_profit=self.betting_session.effective_profit,
                limit_hit=self.betting_session.state.limit_hit,
            )
            legacy_signal = legacy.signal
            same_presence = result.strategy.wants_bet == bool(
                legacy_signal and legacy_signal.bet_side
            )
            same_side = (
                not result.strategy.wants_bet
                or not legacy_signal
                or result.strategy.side == legacy_signal.bet_side
            )
            same_stake = result.stake == legacy.stake
            shadow_wants_arm = (
                result.strategy.wants_bet and result.risk.allowed
            )
            same_arm = shadow_wants_arm == legacy.wants_arm
            self.strategy_lifecycle.record_shadow(
                tab.id,
                matched=bool(
                    same_presence and same_side and same_stake and same_arm
                ),
            )
        except Exception:
            self.strategy_lifecycle.record_shadow(tab.id, error=True)
            raise

    def _evaluate_strategy_tab_live(
        self,
        *,
        history: list[BetSide],
        table_name: str,
        skip_tie: bool,
        source: str,
        shuffling: bool,
    ):
        tabs = [
            tab
            for tab in self.strategy_lifecycle.tabs_in_mode(TabLifecycleMode.LIVE)
            if tab.id == getattr(self, "_running_tab_id", "")
        ]
        if not tabs:
            return []
        source_allowed = not source or source in BET_TRIGGER_SOURCES
        decisions = []
        for tab in tabs:
            manager = self._live_money_managers.get(tab.id)
            configured = self._create_money_manager_for_tab(tab)
            if (
                manager is None
                or money_config_fingerprint(manager)
                != money_config_fingerprint(configured)
            ):
                manager = configured
                self.money_state_store.restore(tab.id, manager)
                self._live_money_managers[tab.id] = manager
            decisions.append(
                self.strategy_lifecycle.evaluate(
                    tab=tab,
                    history=history,
                    table_name=table_name,
                    source=source,
                    skip_tie=skip_tie,
                    progression=self.betting_session.progression,
                    money_quote=manager.quote(),
                    auto_bet=self.betting_session.state.auto_bet,
                    license_allowed=self._live_bet_allowed(),
                    pending_main=(
                        self.betting_session.state.pending is not None
                    ),
                    pending_tie=self.auto_bettor.tie.has_pending,
                    round_already_placed=False,
                    shuffling=shuffling,
                    source_allowed=source_allowed,
                    disabled_patterns=disabled_pattern_ids(
                        self._pattern_enabled
                    ),
                    pattern_lengths=self._pattern_lengths,
                    daily_profit=self._live_run_limits.status_for(tab.id).profit,
                    limit_hit=self._live_run_limits.status_for(tab.id).limit_hit,
                )
            )
        return decisions

    def _resolve_multi_live_allocations(
        self,
        allocations: list[dict],
        result: BetSide,
    ) -> list[dict]:
        resolved: list[dict] = []
        settled_tabs: set[str] = set()
        for allocation in allocations:
            tab_id = str(allocation.get("tab_id") or "")
            allocation_epoch = str(allocation.get("run_epoch") or "")
            current_epoch = getattr(self, "_live_tab_run_epochs", {}).get(tab_id, "")
            manager = self._live_money_managers.get(tab_id)
            if manager is None:
                continue
            side = BetSide(str(allocation.get("side") or ""))
            if allocation_epoch and current_epoch and allocation_epoch != current_epoch:
                stake = float(allocation.get("stake") or 0)
                if result == BetSide.TIE:
                    outcome, profit = "push", 0.0
                elif result == side:
                    outcome = "win"
                    profit = stake * 0.95 if side == BetSide.BANKER else stake
                else:
                    outcome, profit = "loss", -stake
                logger.info(
                    "[RUN_RESTART] Settled old allocation without advancing "
                    "new run: tab=%s old_epoch=%s new_epoch=%s",
                    tab_id, allocation_epoch, current_epoch,
                )
                resolved.append({
                    **allocation, "outcome": outcome, "profit": float(profit),
                    "progression_ignored": True,
                })
                continue
            update = manager.apply_result(side, result)
            tab_config = next(
                (
                    item
                    for item in self.config.strategy_tabs.tabs
                    if item.id == tab_id
                ),
                None,
            )
            run_limit = self._live_run_limits.record(
                tab_id,
                update.profit,
                take_profit=tab_config.take_profit if tab_config else 0,
                stop_loss=tab_config.stop_loss if tab_config else 0,
            )
            if (
                tab_config is not None
                and tab_config.auto_reset_on_nonnegative_pnl
                and run_limit.profit >= 0
                and not run_limit.limit_hit
            ):
                self._live_run_limits.reset_tab(tab_id)
                logger.info(
                    "[MONEY][AUTO_RESET_NONNEG] tab=%s action=reset_run_profit_and_level1",
                    tab_id,
                )
            if run_limit.limit_hit:
                logger.warning(
                    "[TAB_LIVE] RUN_LIMIT_REACHED | tab=%s | kind=%s | profit=%+.0f",
                    tab_id,
                    run_limit.limit_hit,
                    run_limit.profit,
                )
            self.money_state_store.save(tab_id, manager)
            if tab_id not in settled_tabs:
                self.strategy_lifecycle.record_settled_bet(
                    tab_id,
                    bet_side=side,
                    result=result,
                    history=self.state.history,
                )
                settled_tabs.add(tab_id)
            resolved.append(
                {
                    **allocation,
                    "outcome": update.outcome.value,
                    "profit": float(update.profit),
                    "next_stake": int(update.next_quote.stake),
                    "next_level": int(update.next_quote.level_index),
                }
            )
        return resolved

    def _recover_quarantined_allocations(
        self, bet_id: int, tab_ids: list[str], reason: str
    ) -> dict[str, int]:
        epochs: dict[str, int] = {}
        tabs = {tab.id: tab for tab in self.config.strategy_tabs.tabs}
        for tab_id in tab_ids:
            tab = tabs.get(tab_id)
            if tab is None:
                continue
            manager = self._live_money_managers.get(tab_id)
            if manager is None or manager.manager_id != tab.money_manager_id:
                manager = self._create_money_manager_for_tab(tab)
                self.money_state_store.restore(tab_id, manager)
                self._live_money_managers[tab_id] = manager
            epochs[tab_id] = self.money_state_store.recover_from_last_settled(
                tab_id,
                manager,
                bet_id=bet_id,
                reason=reason,
            )
            self.strategy_lifecycle.reset_runtime(tab_id)
        return epochs

    def _report_live_runtime_issue(self, reason: str) -> None:
        """Report a runtime problem without changing the operator's tab mode."""

        live_tabs = self.strategy_lifecycle.tabs_in_mode(TabLifecycleMode.LIVE)
        if not live_tabs:
            return
        logger.error(
            "[TAB_LIVE] RUNTIME_ISSUE | tabs=%s | reason=%s | giu_nguyen=live",
            ",".join(tab.id for tab in live_tabs),
            reason,
        )

    async def _check_small_stake_guard(
        self,
        *,
        stake: int,
        tab_ids: list[str],
        bet_kind: str,
        current_bet_id: int | None,
    ) -> tuple[bool, str]:
        mode = self.config.live_execution.mode
        if mode == "disabled":
            return False, "live_execution.mode đang là disabled"
        if not self.tool_auth.can("live_bet"):
            return False, "Tool/license không có capability live_bet"
        if mode == "production":
            return True, "production policy hợp lệ"
        decision = await asyncio.to_thread(
            self.small_stake_guard.evaluate,
            stake=stake,
            tab_ids=tab_ids,
            bet_kind=bet_kind,
            current_bet_id=current_bet_id,
        )
        return decision.allowed, decision.reason

    def _handle_save_strategy_tabs(self, payload: dict) -> dict:
        """Save tab settings; each tab independently selects simulation/live."""
        cfg = normalize_strategy_tabs(payload)
        saved = self.strategy_tab_store.save_config(cfg)
        self.config.strategy_tabs = saved
        self._sync_live_money_managers()
        if self._run_enabled and self._running_tab_id:
            preflight = self._live_preflight_status(
                tab_ids=[self._running_tab_id]
            )
            if not preflight["allowed"]:
                self._apply_execution_enabled(False)
                logger.warning(
                    "[TAB_LIVE] Tam dung execution sau khi doi cau hinh: %s",
                    preflight["blockers"][0]["code"],
                )
        if (
            self.betting_session.active_money_manager is not None
            and not any(
                tab.id == self._running_tab_id and tab.mode == "live"
                for tab in self.config.strategy_tabs.tabs
            )
        ):
            self._apply_execution_enabled(False)
            self._persist_active_money_manager()
            self._deactivate_money_manager_if_safe()
        data = self._overlay_strategy_tabs_payload()
        self.overlay.set_strategy_tabs(data)
        logger.info("Da luu %s tab chien luoc mo phong", len(saved.tabs))
        return {"ok": True, "strategy_tabs": data}

    def _handle_tie_nurture(self, action: str, payload: dict) -> dict:
        from src.betting_config import save_tie_nurture_to_config
        from src.tie_nurture_config import (
            normalize_tie_nurture_dict,
            tie_nurture_to_overlay,
        )

        try:
            raw = dict(payload or {})
            if action == "toggle":
                raw["enabled"] = bool(raw.get("enabled", False))
            cfg = normalize_tie_nurture_dict(raw)
            if action == "toggle":
                cfg.enabled = bool(raw.get("enabled", cfg.enabled))
            self.config.betting.tie_nurture = cfg
            save_tie_nurture_to_config(
                {
                    "enabled": cfg.enabled,
                    "preset": cfg.preset,
                    "gap_min": cfg.gap_min,
                    "gap_max": cfg.gap_max,
                    "max_bets": cfg.max_bets,
                    "stake": cfg.stake,
                    "payout": cfg.payout,
                    "session_stop_loss": cfg.session_stop_loss,
                },
                self._config_path,
            )
            self.auto_bettor.configure_tie_nurture(
                cfg, history=list(self.state.history or [])
            )
            if cfg.enabled and self.page and not self.page.is_closed():
                try:
                    hist = list(self.state.history or [])
                    table = self._effective_table_name()
                    loop = asyncio.get_running_loop()
                    loop.create_task(
                        self.auto_bettor.maybe_arm_tie_after_sync(
                            self.page, hist, table_name=table
                        )
                    )
                except RuntimeError:
                    pass
            overlay_data = tie_nurture_to_overlay(cfg)
            self.overlay.set_tie_nurture(overlay_data)
            logger.info(
                "Nuoi Hoa %s | preset=%s gap=%s/%s max_bets=%s stake=%s",
                "BAT" if cfg.enabled else "TAT",
                cfg.preset,
                cfg.gap_min,
                cfg.gap_max or "OFF",
                cfg.max_bets or "OFF",
                cfg.stake,
            )
            return {
                "ok": True,
                "enabled": cfg.enabled,
                "tie_nurture": overlay_data,
            }
        except Exception as exc:
            logger.warning("Luu nuoi Hoa that bai: %s", exc)
            return {"ok": False, "error": str(exc)}

    def _handle_save_limits(
        self,
        stop_loss_text: str,
        take_profit_text: str,
        group_take_profit_text: str = "",
        group_stop_loss_text: str = "",
        progression_mode: str = "loss_up_win_reset",
    ) -> dict:
        try:
            progression_mode = (progression_mode or "").strip()
            if progression_mode not in PROGRESSION_MODES:
                return {"ok": False, "error": "Mode progression khong hop le"}
            stop_loss = parse_limit_text(stop_loss_text)
            take_profit = parse_limit_text(take_profit_text)
            group_take_profit = parse_limit_text(group_take_profit_text)
            group_stop_loss = parse_limit_text(group_stop_loss_text)
            save_limits_to_config(
                stop_loss,
                take_profit,
                self._config_path,
                group_take_profit=group_take_profit,
                group_stop_loss=group_stop_loss,
                progression_mode=progression_mode,
            )
            self.config.betting.stop_loss = stop_loss
            self.config.betting.take_profit = take_profit
            self.config.betting.group_take_profit = group_take_profit
            self.config.betting.group_stop_loss = group_stop_loss
            self.config.betting.progression_mode = progression_mode
            self.auto_bettor.on_limits_saved(stop_loss, take_profit)
            self.betting_session.configure(
                group_take_profit=group_take_profit,
                group_stop_loss=group_stop_loss,
                progression_mode=progression_mode,
            )
            self.overlay.set_betting_ui(
                auto_bet=self.betting_session.state.auto_bet,
                stop_loss=stop_loss,
                take_profit=take_profit,
                group_take_profit=group_take_profit,
                group_stop_loss=group_stop_loss,
                progression_mode=progression_mode,
                loss_watch_recover=self.config.betting.loss_watch_recover,
            )
            logger.info(
                "Da luu gioi han — lo: %s | lai: %s | nhom lai: %s | nhom lo: %s | mode: %s",
                format_limit(stop_loss),
                format_limit(take_profit),
                format_limit(group_take_profit),
                format_limit(group_stop_loss),
                progression_mode,
            )
            return {"ok": True}
        except Exception as exc:
            logger.warning("Luu gioi han that bai: %s", exc)
            return {"ok": False, "error": str(exc)}

    async def _handle_toggle_pattern(self, pattern_id: str, enabled: bool) -> dict:
        try:
            self._pattern_enabled = save_pattern_enabled(
                pattern_id,
                enabled,
                config_path=self._config_path,
            )
            self.config.patterns = dict(self._pattern_enabled)
            disabled = disabled_pattern_ids(self._pattern_enabled)
            self.auto_bettor.set_disabled_patterns(disabled)
            self.overlay.set_pattern_enabled(self._pattern_enabled)
            if not enabled:
                self.auto_bettor.clear_armed_if_pattern(pattern_id, "mau da tat")
            logger.info("Mau %s: %s", pattern_id, "BAT" if enabled else "TAT")
            self._last_history_key = ()
            await self._analyze_patterns(full=True)
            return {"ok": True, "enabled": enabled}
        except Exception as exc:
            logger.warning("Bat/tat mau that bai: %s", exc)
            return {"ok": False, "error": str(exc)}

    async def _handle_pattern_length(self, pattern_id: str, length: int) -> dict:
        try:
            self._pattern_lengths = save_pattern_length(
                pattern_id,
                int(length),
                config_path=self._config_path,
            )
            self.config.pattern_lengths = dict(self._pattern_lengths)
            self.auto_bettor.set_pattern_lengths(self._pattern_lengths)
            self.overlay.set_pattern_lengths(self._pattern_lengths)
            self.auto_bettor.clear_armed_if_pattern(pattern_id, "doi so van dieu kien")
            logger.info(
                "Mau %s so van dieu kien: %s",
                pattern_id,
                self._pattern_lengths.get(pattern_id),
            )
            self._last_history_key = ()
            await self._analyze_patterns(full=True)
            return {
                "ok": True,
                "length": self._pattern_lengths.get(pattern_id),
                "lengths": dict(self._pattern_lengths),
            }
        except Exception as exc:
            logger.warning("Doi so van mau that bai: %s", exc)
            return {"ok": False, "error": str(exc)}

    def _handle_suggest_config(self) -> dict:
        try:
            from src.ae_sexy_betting import chip_values_for_count

            table = self._effective_table_name()
            session = self.session_factory()
            try:
                rec = generate_config_recommendation(
                    session,
                    table_name=table,
                    current_patterns=self._pattern_enabled,
                    current_stakes=list(self.config.betting.stakes),
                    stop_loss=float(self.config.betting.stop_loss or 0),
                    take_profit=float(self.config.betting.take_profit or 0),
                    skip_tie=bool(self.config.game.skip_tie),
                    chip_values=chip_values_for_count(5),
                )
            finally:
                session.close()

            payload = rec.to_dict()
            payload["ok"] = True
            logger.info(
                "De xuat config: stakes=%s | tat=%s",
                payload.get("stakes_display"),
                [k for k, v in rec.patterns.items() if not v],
            )
            return payload
        except Exception as exc:
            logger.warning("De xuat config that bai: %s", exc)
            return {"ok": False, "error": str(exc)}

    def _note_login_success(self) -> None:
        if self._login_fail_streak or self._login_auto_stopped:
            logger.info(
                "[PHIEN] LOGIN_OK | mo lai tu dong dang nhap (truoc do fail=%d)",
                self._login_fail_streak,
            )
        self._login_fail_streak = 0
        self._login_auto_stopped = False

    def _note_login_failure(self) -> bool:
        """Tang streak fail. True neu da dung auto-login (dat nguong)."""
        self._login_fail_streak += 1
        if self._login_fail_streak >= _LOGIN_FAIL_STOP:
            self._login_auto_stopped = True
            logger.error(
                "[PHIEN] DUNG_LOGIN | that bai %d lan lien tiep "
                "(sai TK/MK hoac captcha) — dung tu dong dang nhap. "
                "Kiem tra credentials.yaml / panel, hoac dang nhap tay tren web.",
                self._login_fail_streak,
            )
            return True
        logger.warning(
            "[PHIEN] LOGIN_THAT_BAI | lan %d/%d (sai TK/MK hoac captcha) — "
            "con 1 lan thu tu dong",
            self._login_fail_streak,
            _LOGIN_FAIL_STOP,
        )
        return False

    def _login_auto_allowed(self) -> bool:
        return not self._login_auto_stopped

    def _log_login_stopped_throttle(self) -> None:
        now = asyncio.get_event_loop().time()
        if now - self._last_login_stop_log_at < _LOGIN_STOP_LOG_SEC:
            return
        self._last_login_stop_log_at = now
        logger.error(
            "[PHIEN] DUNG_LOGIN | dang cho user (fail=%d) — "
            "khong spam login. Dang nhap tay roi tool se tiep tuc.",
            self._login_fail_streak,
        )

    async def _is_logged_in_any_tab(self, page: Page) -> bool:
        """Chi nhan login tren tab cua site dang chon — khong lay web kia."""
        from src.sites import get_active_site, page_matches_site, resolve_site_from_page

        active = get_active_site()
        if page_matches_site(page, active) and await is_logged_in(page):
            return True
        for p in page.context.pages:
            if p.is_closed() or p is page:
                continue
            try:
                # Bo tab shell/CDN cua web khac
                site = resolve_site_from_page(p)
                if site and site.info.id != active.info.id:
                    continue
                if not page_matches_site(p, active):
                    continue
                if await is_logged_in(p):
                    return True
            except Exception:
                continue
        return False

    async def _overlay_present(self, page: Page) -> bool:
        return await self.overlay._panels_present(page)

    def _bind_page_recovery_events(self, page: Page):
        """Danh dau can khoi phuc khi tab reload hoac navigate."""

        def _mark():
            if not self._recovering:
                self._recovery_pending = True
            # A document navigation invalidates the workspace snapshot even
            # when the table name is unchanged.  The next install therefore
            # shows the locked loading shell until fresh table data arrives.
            self._workspace_loading = True
            self.overlay.set_workspace_loading(True)

        try:
            page.on("load", lambda _=None: _mark())
        except Exception:
            pass

        def on_frame_nav(frame):
            try:
                if frame == page.main_frame:
                    _mark()
            except Exception:
                pass

        try:
            page.on("framenavigated", on_frame_nav)
        except Exception:
            pass

    async def _is_table_ready(self, page: Page, table_name: str) -> bool:
        return await is_ae_sexy_table_ready(page, table_name)

    async def _reload_table_history(self, page: Page, target_name: str) -> None:
        if not self.ae_collector or not target_name:
            return
        # Render the familiar workspace immediately while the collector waits
        # for an authoritative history.  This does not arm, recover or bet.
        self._workspace_loading = True
        self.overlay.set_workspace_loading(True)
        await self._install_early_workspace_overlay(page, stage="history_reload")
        from src.ae_sexy_state import probe_in_room, probe_table_ready

        probe = await probe_game_state(page, "", self.ae_collector)
        in_room = probe_in_room(probe, target_name) or probe_in_room(probe, "")
        ready = probe_table_ready(probe, target_name) or (
            probe_table_ready(probe, "") and bool(probe.dom_stats)
        )
        if not ready:
            ready = await self._is_table_ready(page, target_name)
        self.ae_collector.reset_for_table(target_name)
        self.ae_collector.set_in_room(in_room)
        self.ae_collector.set_table_ready(ready)
        if not ready:
            logger.warning("Bo qua nap/luu lich su — ban %s chua load xong (stats=0)", target_name)
            self._pending_history_table = target_name
            return
        self._pending_history_table = ""
        hist = await self.ae_collector.wait_for_history(target_name, page, timeout_sec=40)
        if hist:
            self.state.history = hist
            logger.info(
                "[HISTORY_INITIAL_READY] table=%s count=%d", target_name, len(hist)
            )
            self._workspace_loading = False
            self.overlay.set_workspace_loading(False)
            logger.info("[WORKSPACE_UNLOCK] table=%s source=history_reload", target_name)
            self.auto_bettor.sync_history_len(len(hist), force=True)
            self.auto_bettor.configure_tie_nurture(
                self.config.betting.tie_nurture, history=hist
            )
            await self.auto_bettor.maybe_arm_tie_after_sync(
                page, hist, table_name=target_name
            )
            round_meta = self._round_meta_for_history(target_name, hist)
            if round_meta:
                shoe = next(
                    (m.get("game_shoe") for m in round_meta.values() if m.get("game_shoe")),
                    None,
                )
                if shoe:
                    self.store.hydrate_saved_rounds(target_name, int(shoe))
            c = {
                "B": sum(1 for s in hist if s == BetSide.BANKER),
                "P": sum(1 for s in hist if s == BetSide.PLAYER),
                "T": sum(1 for s in hist if s == BetSide.TIE),
            }
            logger.info("Nap lai %d van — B=%d P=%d T=%d", len(hist), c["B"], c["P"], c["T"])
            await self._analyze_patterns(full=True)

    async def _recover_session(self, ctx, page: Page, target_name: str) -> Page | None:
        """Khoi phuc sau reload web / mat mang / mat iframe game / tat Chrome."""
        if self._recovering:
            return page
        self._recovering = True
        self._recovery_pending = False
        wanted = self._effective_table_name() or target_name

        logger.warning("=" * 50)
        logger.warning("KHOI PHUC — web reload hoac mat ket noi game")
        logger.warning("=" * 50)

        await self.auto_bettor.cancel_bet_watch()
        page_closed = True
        try:
            page_closed = page.is_closed()
        except Exception:
            page_closed = True
        if not page_closed:
            idle = await self.auto_bettor.wait_until_idle(timeout_sec=_BET_RECOVERY_GRACE_SEC)
            if not idle:
                logger.warning(
                    "Luong cuoc chua ket thuc sau %ds — huy watch va tiep tuc khoi phuc",
                    _BET_RECOVERY_GRACE_SEC,
                )

        if self.ae_collector:
            self.ae_collector.stop()

        try:
            # Chrome bi tat: mo lai CDP + ket noi Playwright truoc moi thao tac trang
            if page_closed or not self.browser_mgr.is_connected():
                logger.warning(
                    "Trinh duyet da tat / CDP mat — mo lai Chrome va ket noi lai..."
                )
                ctx = await self.browser_mgr.ensure_connected(force=True)
                self._ctx = ctx
                page = await self.browser_mgr.resolve_game_page(
                    self.config.site.url, wanted
                )
                self.page = page
                self._recover_urgent = True
                # Gan lai hook collector len context moi
                if self.ae_collector:
                    try:
                        await self.ae_collector.install_hook(ctx)
                        self.ae_collector.attach_to_context(ctx)
                        await self.ae_collector.attach_cdp(ctx)
                    except Exception as exc:
                        logger.warning("Gan lai collector sau mo Chrome: %s", exc)
                if self.collector:
                    try:
                        self.collector.attach_to_context(ctx)
                    except Exception:
                        pass

            if not await self._is_logged_in_any_tab(page):
                if not self._login_auto_allowed():
                    self._log_login_stopped_throttle()
                    logger.error("Van dung auto-login — bo qua khoi phuc")
                    return page
                creds = load_credentials(site=self.config.site.url)
                if creds.username and creds.password:
                    logger.warning("Chua login — tu dong dang nhap lai...")
                    # 1 lan thu / moi chu ky recover — streak ngoai gioi han spam
                    if await login_vipbet389(
                        page,
                        creds.username,
                        creds.password,
                        max_retries=1,
                        site_url=self.config.site.url,
                    ):
                        self._note_login_success()
                        logger.info("Dang nhap lai thanh cong")
                    else:
                        stopped = self._note_login_failure()
                        if stopped:
                            return page
                        logger.warning(
                            "Tu dong dang nhap that bai (lan %d) — cho chu ky sau",
                            self._login_fail_streak,
                        )
                        return page
                else:
                    logger.error("Khong co TK/MK — khong the tu dong dang nhap")
                    return page
                if not await self._is_logged_in_any_tab(page):
                    logger.error("Van chua login — bo qua khoi phuc")
                    return page
                self._note_login_success()
            else:
                self._note_login_success()

            self.page = page
            self.overlay._installed = False
            ctx = self.browser_mgr.context or ctx
            self._ctx = ctx

            from src.ae_sexy import _clear_casino_fatal_page, is_stream_zombie
            from src.game import close_game_overlay, has_game_iframe, reset_game_iframe

            casino_url = self.config.site.url
            try:
                from src.sites import get_active_site

                casino_url = get_active_site().info.casino_url()
            except Exception:
                casino_url = (self.config.site.url or "https://vipbet389.com").rstrip("/") + "/casino"

            ui_ok, ui_reason = await is_game_ui_alive(page, wanted)
            fail_reason = ui_reason or self._last_ui_fail_reason
            zombie, _ = await is_stream_zombie(page, wanted)
            fatal, fatal_reason = await is_casino_fatal_error(page)
            hard_reload = bool(
                self._recover_urgent
                or zombie
                or fatal
                or self._requires_hard_reload(fail_reason)
            )

            if fatal and not page.is_closed():
                logger.warning(
                    "Loi casino [%s] — khoi phuc session (khong reset iframe)",
                    (fatal_reason or "?")[:80],
                )
                ok = await recover_ae_sexy_session_expired(page, wanted)
                await page.wait_for_timeout(3000)
                ui_ok, ui_reason = await is_game_ui_alive(page, wanted)
                fatal, fatal_reason = await is_casino_fatal_error(page)
                if fatal and ok:
                    logger.warning("Van loi 1008 sau khoi phuc — thu xoa lai")
                    await _clear_casino_fatal_page(page)
                    await enter_ae_sexy_hall(page, wanted, _from_recovery=True, force_relaunch=True)
                    page = await self.browser_mgr.resolve_game_page(self.config.site.url, wanted)
                    self.page = page
                    fatal, _ = await is_casino_fatal_error(page)
                    ui_ok, ui_reason = await is_game_ui_alive(page, wanted)
            elif (not ui_ok or hard_reload) and not page.is_closed():
                logger.warning(
                    "UI hong [%s] — goto trang casino (hard=%s)",
                    fail_reason or ui_reason or "?",
                    hard_reload,
                )
                try:
                    from src.sites import get_active_site

                    site = get_active_site()
                    await close_game_overlay(page)
                    await page.wait_for_timeout(1000)
                    # provider_tab: KHONG reload_shell tren tab AE (se bien webMain thanh live.html)
                    if site.info.shell_mode == "provider_tab":
                        logger.warning(
                            "provider_tab hard recover — shell + SEXY + ban %s (khong goto live tren tab game)",
                            wanted,
                        )
                        from src.ae_sexy import _recover_provider_tab_shell

                        ok_pt = await _recover_provider_tab_shell(page, wanted)
                        page = await self.browser_mgr.resolve_game_page(
                            self.config.site.url, wanted
                        )
                        self.page = page
                        if not ok_pt:
                            logger.warning(
                                "provider_tab hard recover chua vao ban — se thu lai"
                            )
                        ui_ok, ui_reason = await is_game_ui_alive(page, wanted)
                        fatal, fatal_reason = await is_casino_fatal_error(page)
                    else:
                        await page.goto(
                            casino_url, wait_until="domcontentloaded", timeout=60000
                        )
                        await page.wait_for_timeout(3000)
                        ui_ok, ui_reason = await is_game_ui_alive(page, wanted)
                        fatal, fatal_reason = await is_casino_fatal_error(page)
                        if fatal:
                            logger.warning(
                                "Van loi casino sau goto — khoi phuc session day du"
                            )
                            await recover_ae_sexy_session_expired(page, wanted)
                            await page.wait_for_timeout(3000)
                            ui_ok, ui_reason = await is_game_ui_alive(page, wanted)
                            fatal, _ = await is_casino_fatal_error(page)
                        elif not ui_ok and hard_reload:
                            zombie, _ = await is_stream_zombie(page, wanted)
                            if zombie and await has_game_iframe(page):
                                logger.warning(
                                    "Van zombie sau goto — reset iframe game"
                                )
                                await reset_game_iframe(page, force=True)
                                await page.wait_for_timeout(4000)
                                ui_ok, ui_reason = await is_game_ui_alive(page, wanted)
                except Exception as exc:
                    logger.warning("Goto/reload trang loi: %s", exc)
                    ui_ok = False

            if self.ae_collector:
                self.ae_collector.reset_for_table(wanted or target_name)

            in_room_now = await is_ae_sexy_in_room(page, wanted)
            feed_ok = bool(
                self.ae_collector
                and in_room_now
                and self.ae_collector.is_feed_healthy(wanted)
                and len(self.state.history) >= 3
                and ui_ok
                and not hard_reload
            )

            # Feed HTTP/WS song + dang trong ban — chi nap lai du lieu
            if not page.is_closed() and feed_ok:
                logger.info(
                    "Soft recovery — feed OK (%d van), chi nap lai HTTP",
                    len(self.state.history),
                )
                await self.ae_collector.reattach(ctx, page)
                ready = await wait_for_ae_sexy_table_ready(
                    page, wanted, timeout_sec=20
                ) or await is_ae_sexy_table_ready(page, wanted)
                self.ae_collector.set_in_room(
                    await is_ae_sexy_in_room(page, wanted) or ready
                )
                self.ae_collector.set_table_ready(ready)
                await self._reload_table_history(page, wanted)
                await self._install_workspace_overlay(page)
                await self._analyze_patterns(full=True)
                self.ae_collector.start_background(page)
                self._last_game_phase = PHASE_ROOM
                self._health_fail_streak = 0
                self._conn_fail_streak = 0
                self._render_fail_streak = 0
                self._ui_fail_streak = 0
                self._stream_zombie_streak = 0
                self._last_ui_fail_reason = ""
                self._recover_urgent = False
                self._last_recover_at = asyncio.get_event_loop().time()
                logger.info("Soft recovery xong — tiep tuc ban %s", wanted)
                return page

            # Van trong ban — chi nap lai du lieu, khong quay sanh (tru khi can hard reload)
            if (
                not page.is_closed()
                and not hard_reload
                and ui_ok
                and await is_ae_sexy_in_room(page, wanted)
            ):
                logger.info("Soft recovery — van trong ban %s, chi nap lai du lieu", wanted)
                if self.ae_collector:
                    await self.ae_collector.reattach(ctx, page)
                ready = await wait_for_ae_sexy_table_ready(
                    page, wanted, timeout_sec=20
                ) or await is_ae_sexy_table_ready(page, wanted)
                if self.ae_collector:
                    self.ae_collector.set_in_room(True)
                    self.ae_collector.set_table_ready(ready)
                if ready:
                    await self._reload_table_history(page, wanted)
                await self._install_workspace_overlay(page)
                await self._analyze_patterns(full=True)
                if self.ae_collector:
                    self.ae_collector.start_background(page)
                self._last_game_phase = PHASE_ROOM
                self._health_fail_streak = 0
                self._conn_fail_streak = 0
                self._render_fail_streak = 0
                self._ui_fail_streak = 0
                self._stream_zombie_streak = 0
                self._last_ui_fail_reason = ""
                self._recover_urgent = False
                self._last_recover_at = asyncio.get_event_loop().time()
                logger.info("Soft recovery xong — tiep tuc ban %s", wanted)
                return page

            if await self._is_stuck_in_lobby(page, wanted or target_name):
                logger.warning(
                    "Khoi phuc: dang o sanh — uu tien vao lai ban %s (khong soft recovery)",
                    wanted or target_name,
                )
                page = await self._handle_stuck_in_lobby(
                    ctx, page, target_name, feed_len=len(self.state.history)
                )
                if await is_ae_sexy_in_room(page, wanted or target_name):
                    await self._install_workspace_overlay(page)
                    await self._analyze_patterns(full=True)
                    if self.ae_collector:
                        self.ae_collector.start_background(page)
                    self._last_recover_at = asyncio.get_event_loop().time()
                    self._recover_urgent = False
                    return page

            await recover_ae_sexy_connection(page, wanted or target_name)

            # 222b: luon chuyen sang tab provider sau khoi phuc
            page = await self.browser_mgr.resolve_game_page(
                self.config.site.url, wanted or target_name
            )
            self.page = page
            if self.ae_collector:
                await self.ae_collector.reattach(ctx, page)

            phase = await detect_ae_sexy_phase(page, wanted)
            logger.info("Trang thai sau khoi phuc: %s", PHASE_LABEL.get(phase, phase))

            if phase == PHASE_WEB:
                if not await enter_ae_sexy_hall(
                    page, wanted, _from_recovery=True, force_relaunch=True
                ):
                    logger.warning("Chua vao lai duoc sanh AE SEXY")
                else:
                    page = await self.browser_mgr.resolve_game_page(
                        self.config.site.url, wanted or target_name
                    )
                    self.page = page
                    phase = await detect_ae_sexy_phase(page, wanted)

            if phase in (PHASE_LOBBY, PHASE_LOADING):
                if await is_ae_sexy_in_room(page, wanted):
                    phase = PHASE_ROOM
                else:
                    page = await self.browser_mgr.resolve_game_page(
                        self.config.site.url, wanted or target_name
                    )
                    self.page = page
                    await ensure_lobby_ready(page, timeout_sec=45, table_name=wanted)
                    page = await self.browser_mgr.resolve_game_page(
                        self.config.site.url, wanted or target_name
                    )
                    self.page = page
                    entered = await enter_ae_sexy_table(page, wanted or target_name)
                    if entered:
                        page = await self.browser_mgr.resolve_game_page(
                            self.config.site.url, wanted or target_name
                        )
                        self.page = page
                        await wait_for_ae_sexy_in_room(page, wanted or target_name, timeout_sec=45)
                    phase = await detect_ae_sexy_phase(page, wanted)

            if phase in (PHASE_ROOM, PHASE_LOBBY, PHASE_LOADING):
                ready = False
                in_room = False
                if phase == PHASE_ROOM:
                    in_room = await is_ae_sexy_in_room(page, wanted or target_name)
                    ready = await wait_for_ae_sexy_table_ready(
                        page, wanted or target_name, timeout_sec=25
                    )
                    token_zombie, tz_reason = await is_game_token_zombie(
                        page, wanted or target_name
                    )
                    if in_room and (token_zombie or not ready):
                        logger.warning(
                            "Trong ban nhung stream/token loi [%s] — khoi phuc video",
                            tz_reason or "stats=0",
                        )
                        if not await recover_game_stream_token(page, wanted or target_name):
                            await force_relaunch_ae_sexy_game(page, wanted or target_name)
                        in_room = await is_ae_sexy_in_room(page, wanted or target_name)
                        ready = await wait_for_ae_sexy_table_ready(
                            page, wanted or target_name, timeout_sec=25
                        )
                if self.ae_collector:
                    self.ae_collector.set_in_room(in_room)
                    self.ae_collector.set_table_ready(ready)
                if ready:
                    await self._reload_table_history(page, wanted or target_name)
                else:
                    logger.warning(
                        "Khoi phuc xong nhung ban %s chua san sang — khong nap/luu lich su",
                        wanted or target_name,
                    )

            await self._install_workspace_overlay(page)
            await self._analyze_patterns(full=True)

            if self.ae_collector:
                self.ae_collector.start_background(page)

            self._last_game_phase = phase
            self._health_fail_streak = 0
            self._conn_fail_streak = 0
            self._render_fail_streak = 0
            self._ui_fail_streak = 0
            self._stream_zombie_streak = 0
            self._last_recover_at = asyncio.get_event_loop().time()
            self._last_ui_fail_reason = ""
            self._recover_urgent = False
            logger.info("Khoi phuc xong — tiep tuc theo doi ban %s", wanted or target_name)
            return page
        except Exception as exc:
            # Neu Chrome tat giua luc khoi phuc — thu mo lai 1 lan
            if _is_target_closed_exc(exc) or not self.browser_mgr.is_connected():
                try:
                    logger.warning(
                        "Khoi phuc gap TargetClosed — thu mo lai Chrome lan 2..."
                    )
                    ctx = await self.browser_mgr.ensure_connected(force=True)
                    self._ctx = ctx
                    page = await self.browser_mgr.resolve_game_page(
                        self.config.site.url, wanted
                    )
                    self.page = page
                    if self.ae_collector:
                        await self.ae_collector.reattach(ctx, page)
                        self.ae_collector.start_background(page)
                    await self._install_workspace_overlay(page)
                    logger.info(
                        "Da mo lai trinh duyet — se tiep tuc vao ban o vong sau"
                    )
                    self._recover_urgent = True
                    return page
                except Exception as exc2:
                    logger.exception("Khoi phuc trinh duyet that bai: %s", exc2)
                    return page
            logger.exception("Khoi phuc that bai: %s", exc)
            return page
        finally:
            self._recovering = False

    async def _track_render_zombie(self, page: Page) -> bool:
        """
        Theo doi man hinh den / chip khong hien — can nhieu lan lien tiep.
        Tranh reload khi game binh thuong (chip tam an giua cac van).
        """
        try:
            phase = await detect_ae_sexy_phase(page, self._effective_table_name())
        except Exception:
            return False
        if phase != PHASE_ROOM:
            self._render_fail_streak = 0
            return False
        if self.auto_bettor.is_busy:
            return False
        shell = await probe_game_shell_health(page)
        if shell.get("chipsVisible"):
            if self._render_fail_streak:
                logger.debug("Chip hien lai — xoa dem render loi")
            self._render_fail_streak = 0
            return False
        if not shell.get("renderBroken"):
            self._render_fail_streak = max(0, self._render_fail_streak - 1)
            return False
        self._render_fail_streak += 1
        if self._render_fail_streak >= _RENDER_ZOMBIE_THRESHOLD:
            logger.warning(
                "Xac nhan render loi %d lan — chip khong hien, khoi phuc game",
                self._render_fail_streak,
            )
            return True
        logger.info(
            "Nghi render loi (%d/%d) — chip chua hien tren man hinh",
            self._render_fail_streak,
            _RENDER_ZOMBIE_THRESHOLD,
        )
        return False

    async def _needs_recovery(self, page: Page, target_name: str) -> bool:
        if self._recovery_pending:
            return True
        try:
            page_closed = page.is_closed()
        except Exception:
            page_closed = True
        if page_closed or not self.browser_mgr.is_connected():
            self._recover_urgent = True
            return True
        fatal, fatal_reason = await is_casino_fatal_error(page)
        if fatal:
            logger.warning(
                "Trang casino loi [%s] — khoi phuc session day du",
                (fatal_reason or "?")[:80],
            )
            self._recover_urgent = True
            return True
        token_zombie, tz_reason = await is_game_token_zombie(
            page, self._effective_table_name()
        )
        if token_zombie:
            logger.warning(
                "Mat token video [%s] — relaunch game",
                tz_reason,
            )
            self._recover_urgent = True
            return True
        if self.auto_bettor.is_busy:
            logger.debug("Hoan khoi phuc — dang cho/dat cuoc")
            return False
        try:
            ui_ok, ui_reason = await is_game_ui_alive(
                page, self._effective_table_name()
            )
            if not ui_ok:
                self._ui_fail_streak += 1
                if self._ui_fail_streak < _UI_FAIL_STREAK_THRESHOLD:
                    logger.debug(
                        "UI nghi loi (%d/%d): %s",
                        self._ui_fail_streak,
                        _UI_FAIL_STREAK_THRESHOLD,
                        ui_reason,
                    )
                    return False
                logger.warning(
                    "UI game hong [%s] — reload truoc khi xu ly tiep",
                    ui_reason,
                )
                self._recover_urgent = True
                return True
            self._ui_fail_streak = 0
        except Exception as exc:
            logger.warning("Kiem tra UI loi: %s — khoi phuc", exc)
            return True
        try:
            phase = await detect_ae_sexy_phase(page, self._effective_table_name())
        except Exception:
            return True

        if self._last_game_phase in (PHASE_ROOM, PHASE_LOBBY, PHASE_LOADING) and phase == PHASE_WEB:
            return True

        if phase in (PHASE_ROOM, PHASE_LOBBY, PHASE_LOADING) and not await _game_launched(page):
            return True

        if not await self._overlay_present(page):
            try:
                await self._install_workspace_overlay(page)
            except Exception:
                pass
            return False

        if self.ae_collector and self.ae_collector.poll_error_streak >= 3:
            return True

        # Zombie: overlay con lich su cu nhung DOM stats = 0 / man den
        try:
            phase_now = await detect_ae_sexy_phase(page, self._effective_table_name())
            if phase_now == PHASE_ROOM and len(self.state.history) >= 5:
                from src.ae_sexy_bead import read_room_stats_raw

                raw = await read_room_stats_raw(page)
                if raw and sum(raw.values()) == 0:
                    if self.ae_collector and self.ae_collector.in_round_transition(15.0):
                        return False
                    if self.ae_collector and self.ae_collector.in_round_transition():
                        logger.debug(
                            "DOM stats=0 sau GP_WINNER — cho UI cap nhat (%d van)",
                            len(self.state.history),
                        )
                    elif self.ae_collector and phase_now == PHASE_ROOM:
                        if len(self.state.history) >= 3:
                            lag = 0
                            ws = self.ae_collector.get_stats(self._effective_table_name())
                            if ws:
                                lag = stats_total(ws) - len(self.state.history)
                            if 0 < lag <= 5:
                                caught = await self.ae_collector.try_catch_up_rounds(page)
                                if caught:
                                    await self._analyze_patterns(full=True)
                                    return False
                        caught = await self.ae_collector.try_catch_up_rounds(page)
                        if caught:
                            await self._analyze_patterns(full=True)
                            return False
                        feed_ok = self.ae_collector.is_feed_healthy(
                            self._effective_table_name()
                        )
                        in_room = await is_ae_sexy_in_room(
                            page, self._effective_table_name()
                        )
                        if feed_ok or in_room:
                            logger.debug(
                                "DOM stats=0 nhung van trong ban / HTTP-WS song (%d van) — bo qua zombie",
                                len(self.state.history),
                            )
                        else:
                            logger.warning(
                                "DOM stats = 0 nhung tool con %d van — khoi phuc ngay",
                                len(self.state.history),
                            )
                            self._recover_urgent = True
                            return True
                shell = await probe_game_shell_health(page)
                if shell.get("statsZero") and shell.get("videoDead"):
                    logger.warning("Ban zombie (stats 0 + mat video) — khoi phuc ngay")
                    self._recover_urgent = True
                    return True
                if shell.get("blackScreen") and shell.get("videoDead"):
                    logger.warning("Man hinh den + mat stream — khoi phuc ngay")
                    self._recover_urgent = True
                    return True
        except Exception:
            pass

        if await self._track_render_zombie(page):
            self._recover_urgent = True
            return True

        try:
            from src.ae_sexy import is_stream_zombie, probe_game_shell_health, probe_room_stream_health

            phase_now = await detect_ae_sexy_phase(page, self._effective_table_name())
            if phase_now == PHASE_ROOM:
                zombie, zreason = await is_stream_zombie(
                    page, self._effective_table_name()
                )
                if zombie:
                    self._stream_zombie_streak += 1
                    if self._stream_zombie_streak >= _STREAM_ZOMBIE_THRESHOLD:
                        logger.warning(
                            "Stream zombie [%s] (%d lan) — reload game",
                            zreason,
                            self._stream_zombie_streak,
                        )
                        self._recover_urgent = True
                        return True
                    logger.info(
                        "Nghi stream zombie (%d/%d): %s",
                        self._stream_zombie_streak,
                        _STREAM_ZOMBIE_THRESHOLD,
                        zreason,
                    )
                else:
                    self._stream_zombie_streak = 0
        except Exception:
            pass

        broken, reason, severity = await assess_ae_sexy_connection(
            page,
            self._effective_table_name(),
            self.ae_collector,
            last_phase=self._last_game_phase,
        )
        # Khong xoa _recover_urgent neu loi 1008/token — can hard recovery
        if "1008" in (reason or "").lower() or "token" in (reason or "").lower():
            self._recover_urgent = True
        elif severity != "immediate":
            self._recover_urgent = False
        if broken:
            now = asyncio.get_event_loop().time()
            reason_l = (reason or "").lower()
            cooldown = 90 if "session het han" not in reason_l else 15
            if "sanh" in reason_l or "backtogamehall" in reason_l:
                cooldown = 15
            if "1008" in reason_l or "token" in reason_l or "wallet" in reason_l:
                cooldown = 15
            if now - self._last_recover_at < cooldown:
                logger.debug(
                    "Bo qua khoi phuc (cooldown %ds): %s",
                    int(cooldown - (now - self._last_recover_at)),
                    reason,
                )
            elif severity == "immediate":
                logger.warning("Phat hien dut ket noi [%s] — khoi phuc ngay", reason)
                self._recover_urgent = True
                return True
            else:
                self._conn_fail_streak += 1
                if self._conn_fail_streak >= 4:
                    logger.warning(
                        "Phat hien dut ket noi [%s] (%d lan) — khoi phuc",
                        reason,
                        self._conn_fail_streak,
                    )
                    return True
                logger.info("Nghi ngo dut ket noi [%s] (%d/4)", reason, self._conn_fail_streak)
        else:
            self._conn_fail_streak = 0

        self._last_game_phase = phase
        return False

    def _set_active_page(self, page: Page) -> Page:
        """Gan page runtime + bind collector (tranh poll sai tab shell)."""
        self.page = page
        if self.ae_collector:
            self.ae_collector.bind_page(page)
        return page

    async def _try_reenter_table(self, ctx, page: Page, target_name: str) -> Page:
        """Vao lai ban khi bi day ve sanh — khong reload trang."""
        from src.ae_sexy_state import probe_in_room, probe_table_ready
        from src.ae_sexy import _has_visible_room_bet_ui, _gamehall_iframe_visible

        page = await self.browser_mgr.resolve_game_page(
            self.config.site.url, target_name
        )
        self._set_active_page(page)
        config_table = (self.config.game.table_name or "").strip() or target_name
        # Uu tien ban dang theo (C09 tren overlay) — khong chi config C01
        wanted_table = (self._effective_table_name() or config_table or target_name).strip()
        from src.ae_sexy import _count_lobby_table_titles, _lobby_grid_visible

        # Chip/zone trong ban → dung ngay (khong click sanh)
        if await _has_visible_room_bet_ui(page) and not await _gamehall_iframe_visible(page):
            logger.info(
                "Van trong ban %s (UI cuoc) — bo qua reenter/click sanh",
                wanted_table,
            )
            if self.ae_collector:
                self.ae_collector.set_in_room(True)
            await self._sync_runtime_table_from_page(page)
            self._last_game_phase = PHASE_ROOM
            self._recover_urgent = False
            return page

        lobby_grid = False
        n_titles = 0
        try:
            n_titles = await _count_lobby_table_titles(page)
            lobby_grid = await _lobby_grid_visible(page)
        except Exception:
            lobby_grid = False
        # Sanh RO (luoi the HIEN) — luon click
        if lobby_grid or await is_ae_sexy_lobby(page):
            if self.ae_collector:
                self.ae_collector.set_in_room(False)
                self.ae_collector.set_table_ready(False)
            logger.warning(
                "Sanh AE SEXY dang hien (%d the) — bat buoc click vao ban %s",
                n_titles,
                wanted_table,
            )
        else:
            if await is_ae_sexy_in_room(page, wanted_table, self.ae_collector):
                await self._sync_runtime_table_from_page(page)
                self._last_game_phase = PHASE_ROOM
                self._recover_urgent = False
                return page
        # Neu dang o shell 222b / khong phai sanh AE — van thu resolve + click
        if not await is_ae_sexy_lobby(page) and not lobby_grid:
            if await is_ae_sexy_in_room(page, wanted_table, self.ae_collector):
                await self._sync_runtime_table_from_page(page)
                return page
            # Khong phai sanh, khong phai trong ban → can vao sanh roi click
            logger.warning(
                "Chua thay sanh AE SEXY (url=%s) — thu mo sanh roi click %s",
                (page.url or "")[:70],
                wanted_table,
            )
            try:
                from src.ae_sexy import go_ae_sexy_lobby

                if not await enter_ae_sexy_hall(page, wanted_table):
                    await go_ae_sexy_lobby(page)
                page = await self.browser_mgr.resolve_game_page(
                    self.config.site.url, wanted_table
                )
                self._set_active_page(page)
            except Exception as exc:
                logger.debug("Mo sanh truoc reenter: %s", exc)
            if not await is_ae_sexy_lobby(page) and not await _lobby_grid_visible(page):
                # Van chua sanh — khong return som neu dang loading AE; thu click neu co table list
                tables = await list_ae_sexy_tables(page)
                if not tables:
                    await self._sync_runtime_table_from_page(page)
                    self._recover_urgent = True
                    return page
        active = self._effective_table_name() or wanted_table
        probe = await probe_game_state(page, active, self.ae_collector)
        # Neu sanh dang hien — bo qua probe_in_room soft-return
        if (
            not lobby_grid
            and not await is_ae_sexy_lobby(page)
            and probe_in_room(probe, active)
            and not (len(probe.lobby_tables) >= 2 and probe.shell_mode == "lobby")
        ):
            self._last_game_phase = PHASE_ROOM
            return page
        # shell=lobby nhung van co chip → dung click (tru khi luoi sanh ro)
        if await _has_visible_room_bet_ui(page) and not lobby_grid:
            logger.info("Co UI cuoc — bo qua click sanh (false lobby)")
            if self.ae_collector:
                self.ae_collector.set_in_room(True)
            self._last_game_phase = PHASE_ROOM
            return page

        tables = await list_ae_sexy_tables(page)
        if not tables and lobby_grid:
            tables = [wanted_table] if wanted_table else ([config_table] if config_table else [])
        candidates = lobby_table_candidates(wanted_table or config_table, tables)
        logger.warning(
            "Dang o sanh — CLICK vao ban (co %d phuong an, target=%s)...",
            len(candidates),
            wanted_table,
        )
        await ensure_lobby_ready(page, timeout_sec=30, table_name=active)

        for candidate_name, reason in candidates:
            if reason in ("fallback_c02", "fallback_first"):
                logger.warning("Thu vao lai %s (%s)", candidate_name, describe_table_pick(reason))
            in_room, ready = await self._attempt_table_entry(page, candidate_name)
            if in_room:
                self._apply_runtime_table(candidate_name, reason=reason)
                page = await self.browser_mgr.resolve_game_page(
                    self.config.site.url, candidate_name
                )
                self._set_active_page(page)
                if self.ae_collector:
                    self.ae_collector.reset_for_table(candidate_name)
                    self.ae_collector.set_in_room(True)
                    self.ae_collector.set_table_ready(ready)
                await self._reload_table_history(page, candidate_name)
                await self._analyze_patterns(full=True)
                self._last_game_phase = PHASE_ROOM
                logger.info("Vao lai ban %s thanh cong (click sanh)", candidate_name)
                return page

        logger.warning("Vao lai ban that bai — se thu khoi phuc day du")
        self._recover_urgent = True
        return page

    async def _install_overlay_on_ae(self, page: Page) -> Page:
        """Gan overlay dung choi: tab AE SEXY (provider_tab) hoac /casino (casino_iframe)."""
        from src.overlay import page_should_host_overlay

        ctx = page.context
        for p in list(ctx.pages):
            if p.is_closed():
                continue
            try:
                if await page_should_host_overlay(p):
                    continue
                await self.overlay.remove(p)
            except Exception:
                pass
        page = await self.browser_mgr.resolve_game_page(
            self.config.site.url, self._effective_table_name()
        )
        self._set_active_page(page)
        try:
            u = page.url or ""
        except Exception:
            u = ""
        if await page_should_host_overlay(page):
            ok = await self._install_workspace_overlay(page)
            if ok:
                logger.info("Da gan overlay tren: %s", u[:80])
            else:
                logger.warning("Gan overlay that bai: %s", u[:70])
        else:
            logger.warning(
                "Chua gan overlay — chua dung tab/URL game (url=%s)",
                u[:70],
            )
        return page

    async def _watch_forever(self, ctx, page: Page, target_name: str):
        self._require_tool_session()
        self._ctx = ctx
        find_game_page(ctx)
        # Bat buoc dung tab AE SEXY (khong gan panel len live.html shell)
        page = await self.browser_mgr.resolve_game_page(self.config.site.url, target_name)
        self._set_active_page(page)
        self._bind_page_recovery_events(page)
        self._last_game_phase = await detect_ae_sexy_phase(page, target_name)
        from src.overlay import page_should_host_overlay

        if not await page_should_host_overlay(page):
            logger.warning(
                "Watch bat dau — chua o tab/URL game, mo AE SEXY roi click ban %s",
                target_name,
            )
            await enter_ae_sexy_hall(page, target_name)
            page = await self.browser_mgr.resolve_game_page(
                self.config.site.url, target_name
            )
            self._set_active_page(page)
            self._recover_urgent = True
        page = await self._install_overlay_on_ae(page)
        await self._analyze_patterns(full=True)
        if self.ae_collector:
            await self.ae_collector.poll_dom(page)
            self.ae_collector.start_background(page)
        # Neu van o sanh — click ban ngay truoc khi idle watch
        if self._recover_urgent or await is_ae_sexy_lobby(page):
            if not await is_ae_sexy_in_room(page, target_name, self.ae_collector):
                logger.warning("Watch: van o sanh — CLICK vao %s ngay", target_name)
                page = await self._handle_stuck_in_lobby(
                    ctx, page, target_name, feed_len=0
                )
                self._set_active_page(page)
                page = await self._install_overlay_on_ae(page)
        logger.info("=" * 50)
        logger.info("Dang theo doi lich su van Baccarat")
        logger.info("Game iframe: %s", is_game_loaded(page))
        logger.info("Ban: %s (id=%s)", self.state.table_name or "...", self.state.table_id or "...")
        logger.info("Tab: %s", (page.url or "")[:90])
        logger.info("Tu dong khoi phuc khi reload / mat mang / session het han / dut WebSocket")
        logger.info("Nhan Ctrl+C de dung")
        logger.info("=" * 50)
        try:
            while True:
                # Khi can click ban — sleep ngan, uu tien xu ly truoc moi viec khac
                await asyncio.sleep(0.4 if self._recover_urgent else 3)
                if (
                    self.tool_auth.license_enabled
                    and time.monotonic() >= self._license_refresh_at
                ):
                    self._license_refresh_at = time.monotonic() + 60
                    await asyncio.to_thread(
                        self.tool_auth.refresh_license, force=True
                    )
                if not self.tool_auth.is_authenticated():
                    self._report_live_runtime_issue(
                        "Tool session/license hết hạn hoặc bị thu hồi"
                    )
                    self._apply_execution_enabled(False)
                    if (
                        self.betting_session.state.pending is not None
                        or self.auto_bettor.is_busy
                    ):
                        logger.warning(
                            "License không hợp lệ — chặn cược mới, "
                            "chờ resolve cược pending trước khi đăng xuất"
                        )
                        continue
                    logger.warning(
                        "Tool session/license hết hạn — dừng sau khi đã hết pending"
                    )
                    await self.logout_tool()
                    return
                if self._recovering:
                    continue
                try:
                    if not self.browser_mgr.is_connected():
                        logger.warning(
                            "Phat hien Chrome/CDP mat — uu tien khoi phuc trinh duyet"
                        )
                        page = await self._recover_session(
                            self.browser_mgr.context or ctx,
                            page,
                            self._effective_table_name(),
                        ) or page
                        ctx = self.browser_mgr.context or ctx
                        self._ctx = ctx
                        self._bind_page_recovery_events(page)
                        continue
                    # Logout im (web) — tu dong login lai qua _recover_session
                    try:
                        if await self._is_logged_in_any_tab(page):
                            self._note_login_success()
                        elif not self._login_auto_allowed():
                            self._log_login_stopped_throttle()
                            await asyncio.sleep(5)
                            continue
                        else:
                            logger.warning(
                                "[PHIEN] MAT_LOGIN | chua thay Dang xuat — tu dong dang nhap lai"
                            )
                            page = await self._recover_session(
                                self.browser_mgr.context or ctx,
                                page,
                                self._effective_table_name(),
                            ) or page
                            ctx = self.browser_mgr.context or ctx
                            self._ctx = ctx
                            self._bind_page_recovery_events(page)
                            continue
                    except Exception as exc:
                        logger.debug("Kiem tra login watch: %s", exc)
                    # HARD reload (man den) — uu tien hon click sanh
                    if self._need_hard_recover or (
                        self._recover_urgent
                        and self._requires_hard_reload(self._last_ui_fail_reason or "")
                    ):
                        table = self._effective_table_name()
                        logger.warning(
                            "[PHIEN] HARD_RECOVER | %s — reload (khong click sanh)",
                            (self._last_ui_fail_reason or "man den/stream")[:80],
                        )
                        self._need_hard_recover = False
                        self._recover_urgent = False
                        page = await self._recover_session(
                            self.browser_mgr.context or ctx, page, table
                        ) or page
                        ctx = self.browser_mgr.context or ctx
                        self._ctx = ctx
                        self._bind_page_recovery_events(page)
                        continue
                    # Man den + con chip → reload ngay (truoc khi MAT_BAN/click sanh)
                    if await self._room_has_black_video(page):
                        logger.warning(
                            "[PHIEN] MAN_DEN | con chip/cuoc — reload de phuc hoi video"
                        )
                        self._last_ui_fail_reason = "man hinh den + mat stream"
                        self._need_hard_recover = False
                        self._recover_urgent = False
                        page = await self._recover_session(
                            self.browser_mgr.context or ctx,
                            page,
                            self._effective_table_name(),
                        ) or page
                        ctx = self.browser_mgr.context or ctx
                        self._ctx = ctx
                        self._bind_page_recovery_events(page)
                        continue
                    # CAN_CLICK / stuck sanh — XU LY TRUOC sync nang (tranh treo im)
                    if self._recover_urgent:
                        table = self._effective_table_name()
                        self._lobby_glitch_streak += 1
                        page = await self._handle_stuck_in_lobby(
                            self.browser_mgr.context or ctx,
                            page,
                            table,
                            feed_len=len(self.state.history),
                        )
                        self._set_active_page(page)
                        ctx = self.browser_mgr.context or ctx
                        self._ctx = ctx
                        self._bind_page_recovery_events(page)
                        if await is_ae_sexy_in_room(
                            page, self._effective_table_name(), self.ae_collector
                        ):
                            self._recover_urgent = False
                            self._lobby_glitch_streak = 0
                        continue
                    table = await self._sync_runtime_table_from_page(page)
                    if await self._is_stuck_in_lobby(page, table):
                        self._lobby_glitch_streak += 1
                        page = await self._handle_stuck_in_lobby(
                            self.browser_mgr.context or ctx,
                            page,
                            table,
                            feed_len=len(self.state.history),
                        )
                        self._set_active_page(page)
                        ctx = self.browser_mgr.context or ctx
                        self._ctx = ctx
                        self._bind_page_recovery_events(page)
                        if await is_ae_sexy_in_room(
                            page, self._effective_table_name(), self.ae_collector
                        ):
                            self._recover_urgent = False
                            self._lobby_glitch_streak = 0
                        continue
                    self._lobby_glitch_streak = 0
                    if await self._needs_recovery(page, table):
                        self._health_fail_streak += 1
                        if self._recover_urgent or self._health_fail_streak >= 2:
                            self._recover_urgent = False
                            page = await self._recover_session(
                                self.browser_mgr.context or ctx, page, table
                            ) or page
                            ctx = self.browser_mgr.context or ctx
                            self._ctx = ctx
                            self._bind_page_recovery_events(page)
                    else:
                        self._health_fail_streak = 0
                        # Chi xoa urgent khi DA trong ban — khong xoa CAN_CLICK
                        if self.ae_collector and self.ae_collector.in_room:
                            self._recover_urgent = False
                        elif await is_ae_sexy_in_room(
                            page, self._effective_table_name(), self.ae_collector
                        ):
                            self._recover_urgent = False
                except Exception as exc:
                    logger.warning("Health check loi: %s", exc)
                    self._health_fail_streak += 1
                    dead = _is_target_closed_exc(exc) or not self.browser_mgr.is_connected()
                    if dead:
                        self._recover_urgent = True
                        self._health_fail_streak = max(self._health_fail_streak, 2)
                    if self._health_fail_streak >= 2:
                        page = await self._recover_session(
                            self.browser_mgr.context or ctx,
                            page,
                            self._effective_table_name(),
                        ) or page
                        ctx = self.browser_mgr.context or ctx
                        self._ctx = ctx
                        self._bind_page_recovery_events(page)
        except KeyboardInterrupt:
            logger.info("Da dung")
        finally:
            if self.ae_collector:
                self.ae_collector.stop()
            await self._print_summary()
            await self.browser_mgr.stop()

    async def _continue_in_room(self, ctx, page: Page, wanted: str) -> bool:
        room_table = (await detect_room_table_name(page) or "").strip()
        if room_table:
            target_name = normalize_baccarat_table_name(room_table)
            if wanted and not table_codes_match(wanted, target_name):
                logger.warning(
                    "Dang o %s — cap nhat ban runtime (config: %s)",
                    target_name,
                    wanted,
                )
        else:
            target_name = normalize_baccarat_table_name(wanted) if wanted else "Baccarat C01"

        if not await is_ae_sexy_in_room(page, target_name, self.ae_collector):
            probe = await probe_game_state(page, "", self.ae_collector)
            from src.ae_sexy_state import probe_in_room

            if not (room_table and probe_in_room(probe, "")):
                return False

        self._apply_runtime_table(target_name, reason="continue_in_room")
        await self._install_early_workspace_overlay(page, stage="startup_in_room")
        logger.info("Da o trong ban %s — bo qua sanh/web", target_name)
        self.store.register_active_table(target_name)
        if self.ae_collector:
            self.ae_collector.reset_for_table(target_name)
            ready = await wait_for_ae_sexy_table_ready(page, target_name, timeout_sec=45)
            self.ae_collector.set_in_room(True)
            self.ae_collector.set_table_ready(ready)
            if ready:
                logger.info("[TABLE_READY] table=%s", target_name)
            await self.ae_collector.inject_hook_frames(page)
            if not ready:
                logger.warning(
                    "Ban %s chua load footer — van nap HTTP/WS, chi luu DB khi san sang",
                    target_name,
                )
                await self.ae_collector.fetch_http_history(page, target_name)
                if await self.ae_collector.try_catch_up_rounds(page):
                    logger.info(
                        "Nap %d van tu HTTP (footer tam = 0)",
                        len(self.state.history),
                    )
                await self._analyze_patterns(full=True)
                self.ae_collector.start_background(page)
                await self._watch_forever(ctx, page, target_name)
                return True
            from src.ae_sexy_bead import _prepare_room_view, read_in_room_stats

            await _prepare_room_view(page)
            await asyncio.sleep(2)
            dom_stats = await read_in_room_stats(page)
            if dom_stats:
                logger.info(
                    "Stats DOM: B=%s P=%s T=%s (tong %d)",
                    dom_stats.get("banker"),
                    dom_stats.get("player"),
                    dom_stats.get("tie"),
                    sum(dom_stats.values()),
                )
            hist = await self.ae_collector.wait_for_history(
                target_name, page, timeout_sec=45, light_dom=False
            )
            if hist:
                self.state.history = hist
                logger.info(
                    "[HISTORY_INITIAL_READY] table=%s count=%d",
                    target_name,
                    len(hist),
                )
                c = {
                    "B": sum(1 for s in hist if s == BetSide.BANKER),
                    "P": sum(1 for s in hist if s == BetSide.PLAYER),
                    "T": sum(1 for s in hist if s == BetSide.TIE),
                }
                logger.info("Nap %d van — B=%d P=%d T=%d", len(hist), c["B"], c["P"], c["T"])
                round_meta = self._round_meta_for_history(target_name, hist)
                saved = self.store.save_table_history(
                    target_name,
                    hist,
                    stats={"banker": c["B"], "player": c["P"], "tie": c["T"]},
                    source="in-room-init",
                    round_meta=round_meta,
                )
                if saved:
                    logger.info("Da luu %d van lich su ban %s vao DB", saved, target_name)
            await self.ae_collector.poll_dom(page)
        await self._watch_forever(ctx, page, target_name)
        return True

    async def _attempt_table_entry(self, page: Page, table_name: str) -> tuple[bool, bool]:
        """Thu vao ban va cho san sang. Tra ve (in_room, ready)."""
        coll = self.ae_collector
        await scroll_lobby_to_table(page, table_name)
        entered = await enter_ae_sexy_table(page, table_name)
        in_room = False
        ready = False
        if entered:
            probe = await wait_for_game_position(
                page,
                table_name=table_name,
                want_in_room=True,
                timeout_sec=60,
                collector=coll,
            )
            in_room = probe is not None
            if in_room:
                probe = await wait_for_game_position(
                    page,
                    table_name=table_name,
                    want_table_ready=True,
                    timeout_sec=30,
                    collector=coll,
                )
                ready = probe is not None
        if not ready:
            for attempt in range(5):
                logger.warning(
                    "Chua vao ban %s (lan %d/5) — thu click lai",
                    table_name,
                    attempt + 1,
                )
                await scroll_lobby_to_table(page, table_name)
                await asyncio.sleep(2)
                if await enter_ae_sexy_table(page, table_name):
                    probe = await wait_for_game_position(
                        page,
                        table_name=table_name,
                        want_in_room=True,
                        timeout_sec=45,
                        collector=coll,
                    )
                    in_room = probe is not None
                    if in_room:
                        probe = await wait_for_game_position(
                            page,
                            table_name=table_name,
                            want_table_ready=True,
                            timeout_sec=25,
                            collector=coll,
                        )
                        ready = probe is not None
                if ready:
                    break
        return in_room, ready

    async def _enter_table_from_lobby(self, ctx, page: Page, wanted: str) -> bool:
        from src.ae_sexy import DEFAULT_TABLE_NAME, scroll_ae_sexy_lobby

        if not (wanted or "").strip():
            wanted = DEFAULT_TABLE_NAME

        await self._install_early_workspace_overlay(page, stage="startup_lobby")
        logger.info("[TABLE_ENTRY_BEGIN] table=%s", wanted)
        await scroll_ae_sexy_lobby(page)
        tables = await list_ae_sexy_tables(page)
        if not tables:
            await asyncio.sleep(2)
            await scroll_ae_sexy_lobby(page)
            tables = await list_ae_sexy_tables(page)

        candidates = lobby_table_candidates(wanted, tables)
        if tables:
            logger.info("Doc sanh AE SEXY: %d ban — %s", len(tables), ", ".join(tables))
            self.store.sync_table_names(tables)
            plan = ", ".join(f"{n}({r})" for n, r in candidates[:4])
            if len(candidates) > 4:
                plan += f", +{len(candidates) - 4}..."
            logger.info("Ke hoach vao ban: %s", plan)
        else:
            logger.warning("Khong doc duoc danh sach ban — thu lan luot theo config")

        lobby_tables = await scrape_all_tables(page)
        if lobby_tables:
            self.store.sync_lobby_tables(lobby_tables)
        for t in lobby_tables:
            logger.info(
                "Ban %s: %d van roadmap | B=%s P=%s T=%s",
                t.name,
                len(t.history),
                t.stats.get("banker", "?"),
                t.stats.get("player", "?"),
                t.stats.get("tie", "?"),
            )

        target_name = candidates[0][0]
        pick_reason = candidates[0][1]
        in_room = False
        ready = False
        stats: dict = {}

        for candidate_name, reason in candidates:
            if reason == "fallback_c02":
                logger.warning(
                    "Ban %s khong co tren sanh hoac bao tri — thu %s",
                    normalize_baccarat_table_name(wanted),
                    candidate_name,
                )
            elif reason == "fallback_first" and not ready and target_name != candidate_name:
                logger.warning("Khong vao duoc %s — thu ban khac %s", target_name, candidate_name)

            frame = await get_game_iframe(page)
            tstats = await read_table_stats(frame, candidate_name) if frame else {}
            if tstats:
                logger.info(
                    "Thong ke ban %s: B=%s P=%s T=%s",
                    candidate_name,
                    tstats.get("banker", "?"),
                    tstats.get("player", "?"),
                    tstats.get("tie", "?"),
                )

            logger.info("Vao ban: %s (%s)", candidate_name, describe_table_pick(reason))
            in_room, ready = await self._attempt_table_entry(page, candidate_name)
            target_name = candidate_name
            pick_reason = reason
            stats = tstats or stats
            if ready:
                logger.info("[TABLE_READY] table=%s", candidate_name)
                break

        if not ready:
            logger.warning(
                "Khong vao duoc ban nao (cuoi: %s) hoac game chua load — KHONG nap/luu lich su",
                target_name,
            )

        self._apply_runtime_table(target_name, reason=pick_reason)
        self.store.register_active_table(target_name, stats=stats or None)
        if self.ae_collector:
            self.ae_collector.reset_for_table(target_name)
            from src.ae_sexy_state import probe_in_room, probe_table_ready

            # Uu tien trang AE SEXY (provider) — 222b hay dung nham shell live.html
            page = await self.browser_mgr.resolve_game_page(
                self.config.site.url, target_name
            )
            self.page = page
            logger.info("Tab sau vao ban: %s", (page.url or "")[:90])

            final_probe = await probe_game_state(page, target_name, self.ae_collector)
            # Chi tin probe tren tab da resolve — khong OR ket qua cu (sai tab)
            in_room = probe_in_room(final_probe, target_name)
            ready = probe_table_ready(final_probe, target_name)
            # Neu van o sanh (nhieu the ban) — CHUA vao ban that
            if len(final_probe.lobby_tables) >= 2 or final_probe.shell_mode == "lobby":
                if not (
                    final_probe.room_info.get("hasChip")
                    or final_probe.room_info.get("hasBet")
                ):
                    in_room = False
                    ready = False
                    logger.warning(
                        "Van o SANH AE SEXY (%d ban) — chua vao duoc %s, se thu lai trong watch",
                        len(final_probe.lobby_tables),
                        target_name,
                    )
            self.ae_collector.bind_page(page)
            self.ae_collector.set_in_room(in_room)
            self.ae_collector.set_table_ready(ready)
            if ready and in_room:
                await self.ae_collector.inject_hook_frames(page)
                await self.ae_collector.fetch_http_history(page, target_name)
                from src.ae_sexy_bead import _prepare_room_view

                await _prepare_room_view(page)
                await asyncio.sleep(3)
                stats = self.ae_collector.get_stats(target_name)
                if stats:
                    logger.info(
                        "Thong ke WS ban %s: B=%s P=%s T=%s (tong %d)",
                        target_name,
                        stats.get("banker"),
                        stats.get("player"),
                        stats.get("tie"),
                        sum(stats.values()),
                    )
                ws_hist = await self.ae_collector.wait_for_history(target_name, page, timeout_sec=25)
                if ws_hist:
                    self.state.history = ws_hist
                    logger.info(
                        "[HISTORY_INITIAL_READY] table=%s count=%d",
                        target_name,
                        len(ws_hist),
                    )
                    logger.info("Nap %d van lich su day du", len(ws_hist))
                    ws_stats = self.ae_collector.get_stats(target_name) or stats
                    round_meta = self._round_meta_for_history(target_name, ws_hist)
                    saved = self.store.save_table_history(
                        target_name,
                        ws_hist,
                        stats=ws_stats,
                        source="in-room-ws",
                        round_meta=round_meta,
                    )
                    if saved:
                        logger.info("Da luu %d van lich su ban %s vao DB", saved, target_name)
                elif not self.state.history:
                    logger.warning("Chua doc duoc lich su day du — tiep tuc poll khi trong ban")
            else:
                self.state.history = []
                self._recover_urgent = True
                # Chua click vao ban — thu lai ngay truoc khi watch (tranh spam SSOT)
                for retry in range(4):
                    logger.warning(
                        "Van o SANH — click lai vao %s (lan %d/4)",
                        target_name,
                        retry + 1,
                    )
                    page = await self.browser_mgr.resolve_game_page(
                        self.config.site.url, target_name
                    )
                    self.page = page
                    in_room, ready = await self._attempt_table_entry(page, target_name)
                    if in_room:
                        self.ae_collector.set_in_room(True)
                        self.ae_collector.set_table_ready(ready)
                        if ready:
                            await self.ae_collector.inject_hook_frames(page)
                            await self.ae_collector.fetch_http_history(page, target_name)
                            from src.ae_sexy_bead import _prepare_room_view

                            await _prepare_room_view(page)
                            await asyncio.sleep(2)
                            ws_hist = await self.ae_collector.wait_for_history(
                                target_name, page, timeout_sec=20
                            )
                            if ws_hist:
                                self.state.history = ws_hist
                                logger.info("Nap %d van lich su sau click", len(ws_hist))
                        self._recover_urgent = False
                        break
                    await asyncio.sleep(2)

        logger.info("=" * 50)
        logger.info(
            "Theo doi ban %s (trong ban=%s, san sang=%s)%s",
            target_name,
            bool(self.ae_collector and self.ae_collector.in_room),
            bool(self.ae_collector and self.ae_collector.table_ready),
            ""
            if (self.ae_collector and self.ae_collector.in_room)
            else " — UU TIEN CLICK VAO BAN",
        )
        logger.info("=" * 50)
        await self._watch_forever(ctx, page, target_name)
        return True

    async def run(self):
        ctx = await self.browser_mgr.start()

        # Lay tab bat ky de hien Tool Login truoc khi duoc phep vao web/sanh.
        panel_page = None
        for p in ctx.pages:
            if not p.is_closed():
                panel_page = p
                break
        if panel_page is None:
            panel_page = await ctx.new_page()

        if self.tool_auth.license_enabled and self.tool_auth.is_authenticated():
            logger.info(
                "Đã khôi phục Tool session từ signed lease (%s)",
                self.tool_auth.license_status().get("status"),
            )
        elif self.tool_auth.enabled or self.tool_auth.license_enabled:
            await prompt_tool_login_panel(panel_page, self.tool_auth)
        else:
            # Config chi dung cho development; van tao session de gate co mot duong duy nhat.
            self.tool_auth.authenticate("", "")
        self._require_tool_session()

        preferred = self.config.game.table_name.strip()

        phase_probe = await detect_ae_sexy_phase(panel_page, preferred)
        already_in_game = phase_probe in (PHASE_ROOM, PHASE_LOBBY, PHASE_LOADING)
        if already_in_game:
            logger.info(
                "Phat hien dang trong game (%s) — van hien panel de chon web/TK neu can doi",
                phase_probe,
            )

        # Chi hien Game Login sau khi Tool session da hop le.
        creds = load_credentials(site=self.config.site.url)
        form = await self.change_game_account(panel_page)
        save_credentials(form.username, form.password, site=form.site_id)
        self.config = update_site_url(form.site_url)
        # update_site_url() returns a fresh AppConfig read from YAML.  Strategy
        # tabs, including their money manager and stake chains, are SQLite-owned
        # after the first import and must not be replaced by YAML defaults here.
        self.config.strategy_tabs = self.strategy_tab_store.load_or_import(
            self.config.strategy_tabs
        )
        self.browser_mgr.cdp_url = self.config.site.cdp_url
        from src.sites import set_active_site

        active = set_active_site(form.site_id or form.site_url)
        creds = load_credentials(site=form.site_id)
        logger.info(
            "Da luu thong tin Game: site=%s (%s) web=%s",
            active.info.id,
            active.info.shell_mode,
            self.config.site.url,
        )

        logger.info("Dang tim tab web/game...")
        page = await self.browser_mgr.resolve_game_page(self.config.site.url, preferred)
        self.page = page
        logger.info("Tab dang dung: %s", (page.url or "")[:90])
        # Dong tab login/about:blank de tranh switch_to nhay ve trang trang
        try:
            from src.ae_sexy import is_usable_browser_page_url

            for p in list(ctx.pages):
                if p is page or p.is_closed():
                    continue
                try:
                    u = p.url or ""
                except Exception:
                    continue
                if not is_usable_browser_page_url(u):
                    try:
                        await p.close()
                    except Exception:
                        pass
            await page.bring_to_front()
        except Exception:
            pass

        logger.info("Kiem tra trang thai / login...")
        try:
            phase = await asyncio.wait_for(detect_ae_sexy_phase(page, ""), timeout=12.0)
        except Exception:
            phase = PHASE_LOADING
            logger.warning("detect phase timeout/loi — coi la loading (KHONG nhay web)")
            try:
                from src.ae_sexy import _get_shell_mode, is_ae_sexy_url

                if is_ae_sexy_url(page.url or ""):
                    mode = await asyncio.wait_for(_get_shell_mode(page), timeout=3.0)
                    if mode == "lobby":
                        phase = PHASE_LOBBY
                    elif mode == "room":
                        phase = PHASE_ROOM
            except Exception:
                pass
        detected = ""
        # Chi detect ban khi da o AE SEXY (tranh treo tren /home/ 222b)
        if phase in (PHASE_ROOM, PHASE_LOBBY, PHASE_LOADING):
            try:
                detected = await asyncio.wait_for(
                    self._detect_runtime_table(page), timeout=10.0
                )
            except Exception:
                detected = ""
        if detected:
            self._apply_runtime_table(detected, reason="startup_detect")
            wanted = detected
            if preferred and not table_codes_match(preferred, detected):
                logger.info(
                    "Theo ban hien tai %s — config.game.table_name (%s) chi la uu tien khi vao tu sanh",
                    detected,
                    preferred,
                )
        else:
            wanted = preferred
        if not wanted and phase == PHASE_ROOM:
            wanted = (await detect_room_table_name(page) or "").strip()
            if wanted:
                wanted = normalize_baccarat_table_name(wanted)
                self._apply_runtime_table(wanted, reason="startup_detect")
                logger.info("Tu phat hien ban: %s", wanted)
        logger.info("Trang thai: %s", PHASE_LABEL.get(phase, phase))
        in_game = phase in (PHASE_ROOM, PHASE_LOBBY, PHASE_LOADING)
        # Phase WEB nhung iframe AE SEXY/sanh da mo (session cu) — bo qua login
        if not in_game:
            try:
                from src.ae_sexy import _game_launched, _list_tables_in_frames

                if await _game_launched(page) and len(await _list_tables_in_frames(page)) >= 1:
                    logger.info("Phat hien sanh AE SEXY dang mo — bo qua login web")
                    in_game = True
                    phase = PHASE_LOBBY
            except Exception:
                pass

        creds = load_credentials(site=self.config.site.url)
        if in_game:
            logger.info("Trong game AE SEXY — bo qua buoc login web")
        else:
            logged_in = await is_logged_in(page)
            if logged_in:
                try:
                    from src.sites import get_active_site

                    site = get_active_site()
                    marker = (
                        "Dang xuat"
                        if site.info.id == "222b"
                        else "plyr/so du"
                    )
                    logger.info(
                        "Web da login [%s] (%s) — bo qua form captcha",
                        site.info.id,
                        marker,
                    )
                except Exception:
                    logger.info("Web da login — bo qua form captcha")
            elif creds.username and creds.password:
                logger.info("Chua login — tu dong dang nhap (doc captcha)...")
                logged_in = await login_vipbet389(
                    page,
                    creds.username,
                    creds.password,
                    max_retries=_LOGIN_FAIL_STOP,
                    site_url=self.config.site.url,
                )
                if not logged_in:
                    logger.error(
                        "[PHIEN] DUNG_LOGIN | dang nhap that bai sau %d lan "
                        "(sai TK/MK hoac captcha) — dung tool. "
                        "Kiem tra panel / credentials.yaml",
                        _LOGIN_FAIL_STOP,
                    )
                    await self.browser_mgr.stop()
                    return
            else:
                logger.error("=" * 50)
                logger.error("CHUA DANG NHAP!")
                logger.error("Nhap Web/TK/MK tren panel khi mo tool")
                logger.error("=" * 50)
                await self.browser_mgr.stop()
                return

            if not await is_logged_in(page):
                logger.error("Van chua nhan dien duoc trang thai login — dung")
                await self.browser_mgr.stop()
                return

        logger.info("OK - Da login")
        self.store.register_hall()

        # Neu phase nham "loading" nhung da thay luoi ban → coi la sanh, click ngay
        if phase == PHASE_LOADING:
            try:
                from src.ae_sexy import _list_tables_in_frames

                quick_tables = await asyncio.wait_for(
                    _list_tables_in_frames(page), timeout=8.0
                )
                if len(quick_tables) >= 2:
                    logger.info(
                        "Phat hien sanh (%d ban) — sua phase loading → lobby",
                        len(quick_tables),
                    )
                    phase = PHASE_LOBBY
            except Exception:
                pass

        # Tren shell web (222b /home/) bo qua quet session AE — di thang vao sanh
        if phase == PHASE_WEB:
            logger.info("Dang o trang web shell — chuyen vao sanh AE SEXY...")
        elif phase in (PHASE_LOBBY, PHASE_ROOM):
            # Sanh/ban ro — khong can quet session nang (tranh treo sau OK login)
            logger.info("Da o %s — bo qua quet session, tien hanh vao ban", PHASE_LABEL.get(phase, phase))
        elif await is_game_session_expired(page, wanted):
            if await is_ae_sexy_in_room(page, wanted) or await is_ae_sexy_in_room(page, ""):
                logger.info("Bo qua session het han gia — game van trong ban %s", wanted)
            else:
                logger.warning("Phat hien session game het han luc khoi dong — khoi phuc...")
                await recover_ae_sexy_session_expired(page, wanted)
                phase = await detect_ae_sexy_phase(page, wanted)
                logger.info("Trang thai sau khoi phuc session: %s", PHASE_LABEL.get(phase, phase))

        # Gan collector — AE SEXY dung DOM/CDP, ongames dung WebSocket STOMP
        if self.config.game.provider == "ae_sexy":
            boot_table = self._effective_table_name() or wanted or preferred
            self.ae_collector = AeSexyCollector(
                state=self.state,
                table_name=boot_table,
                on_history_update=self._on_ae_history_update,
                on_round_winner=self._on_round_winner,
                on_shoe_change=lambda name: self.store.clear_reserved_rounds(name),
                on_betting_open=self._on_betting_open,
                on_ui_broken=self._on_ui_broken,
                on_need_enter_table=self._on_need_enter_table,
                poll_interval=2.0,
            )
            self.auto_bettor.set_round_meta_provider(
                lambda table, idx: self.ae_collector.get_bet_round_meta(table, idx)
            )
            self.auto_bettor.set_history_provider(lambda: list(self.state.history))
            async def _check_ui_alive(p: Page):
                return await is_game_ui_alive(p, self._effective_table_name())

            self.auto_bettor.set_ui_alive_checker(_check_ui_alive)
            self.auto_bettor.set_shuffle_checker(
                lambda table: self.ae_collector.is_shuffle_active(table)
            )
            self.ae_collector.set_poll_gate(lambda: self.auto_bettor.is_placing_bet)
            self.ae_collector.set_table_sync_hook(self._sync_table_on_poll)
            await self.ae_collector.install_hook(ctx)
            self.ae_collector.attach_to_context(ctx)
            await self.ae_collector.attach_cdp(ctx)
            self.ae_collector.attach_http(page)
            if phase == PHASE_ROOM:
                await self._sync_runtime_table_from_page(page, reload_history=True)
        else:
            self.collector = TrafficCollector(
                state=self.state,
                table_id=self.config.game.table_id,
                table_name=self.config.game.table_name,
                on_round_result=self._on_round_result,
                on_table_loaded=self._on_table_loaded,
                on_history_sync=self._on_history_sync,
            )
            self.collector.attach_to_context(ctx)

        # --- AE SEXY: room -> lobby -> web ---
        if phase == PHASE_ROOM:
            if await self._continue_in_room(ctx, page, wanted):
                return
            phase = await detect_ae_sexy_phase(page, wanted)
            logger.info("Chuyen sang: %s", PHASE_LABEL.get(phase, phase))

        if phase in (PHASE_LOBBY, PHASE_LOADING):
            from src.ae_sexy import has_ae_sexy_room_ui

            if await has_ae_sexy_room_ui(page):
                logger.info("Phat hien UI trong ban — bo qua sanh/web")
                if await self._continue_in_room(ctx, page, wanted):
                    return
            logger.info("Da o sanh — CLICK vao ban %s...", wanted or "C01")
            # Sanh ro: bo qua quet session + ensure_lobby dai
            try:
                from src.ae_sexy import _list_tables_in_frames

                n = len(await asyncio.wait_for(_list_tables_in_frames(page), timeout=6.0))
            except Exception:
                n = 0
            if n < 2:
                if await is_game_session_expired(page, wanted):
                    if not await is_ae_sexy_in_room(page, wanted):
                        await recover_ae_sexy_session_expired(page, wanted)
                if not await ensure_lobby_ready(page, timeout_sec=20, table_name=wanted):
                    logger.warning("Sanh chua san sang — thu mo tu web...")
                else:
                    if await self._enter_table_from_lobby(ctx, page, wanted):
                        return
                    await self.browser_mgr.stop()
                    return
            else:
                if await self._enter_table_from_lobby(ctx, page, wanted):
                    return
                await self.browser_mgr.stop()
                return

        # Tu trang web casino -> vao sanh
        if not await enter_ae_sexy_hall(page, wanted):
            # goGame bi chan "Vui long dang nhap truoc" — login lai roi thu
            if not await is_logged_in(page):
                logger.warning(
                    "Web CHUA login (nhan sai truoc do?) — dang nhap roi mo sanh lai..."
                )
                if creds.username and creds.password:
                    ok_login = await login_vipbet389(
                        page,
                        creds.username,
                        creds.password,
                        max_retries=_LOGIN_FAIL_STOP,
                        site_url=self.config.site.url,
                    )
                    if ok_login and await enter_ae_sexy_hall(page, wanted):
                        page = await self.browser_mgr.resolve_game_page(
                            self.config.site.url, wanted
                        )
                        self.page = page
                    else:
                        logger.error(
                            "[PHIEN] DUNG_LOGIN | dang nhap/mo sanh that bai sau toi da %d lan "
                            "— kiem tra TK-MK tren panel",
                            _LOGIN_FAIL_STOP,
                        )
                        await self.browser_mgr.stop()
                        return
                else:
                    logger.error("Khong co TK/MK de dang nhap — nhap tren panel")
                    await self.browser_mgr.stop()
                    return
            else:
                try:
                    from src.sites import get_active_site

                    hint = get_active_site().info.casino_url()
                except Exception:
                    hint = self.config.site.url
                logger.error("Khong vao duoc cong AE SEXY — hay mo %s", hint)
                await self.browser_mgr.stop()
                return

        # 222b mo tab provider moi — bat buoc dung tab AE SEXY, khong o live.html
        page = await self.browser_mgr.resolve_game_page(self.config.site.url, wanted)
        self.page = page
        logger.info("Tab AE SEXY sau goGame: %s", (page.url or "")[:90])
        await self._install_early_workspace_overlay(page, stage="startup_game_host")
        try:
            from src.ae_sexy import is_ae_sexy_url, switch_to_ae_sexy_page

            if not is_ae_sexy_url(page.url or ""):
                switched = await switch_to_ae_sexy_page(page, wanted)
                if switched and switched is not page:
                    page = switched
                    self.page = page
                    logger.info("Chuyen sang tab provider: %s", (page.url or "")[:90])
        except Exception:
            pass

        if await is_ae_sexy_promo_visible(page) and not await is_ae_sexy_lobby(page):
            logger.error("Chua vao duoc sanh AE SEXY (van o trang promo)")
            await self.browser_mgr.stop()
            return

        if not await self._enter_table_from_lobby(ctx, page, wanted):
            await self.browser_mgr.stop()

    def _reset_table_caches(self):
        self._full_log_done = False
        self._last_history_key = ()

    def _table_matches(self, t_id: str) -> bool:
        active = self._active_table_id or str(
            (self.collector.table_id if self.collector else "") or self.state.table_id
        )
        return not active or str(t_id) == str(active)

    def _on_round_winner(self, table_id: int, game_round: int) -> None:
        """GP_WINNER — lich su da cap nhat trong collector.apply_gp_winner."""
        logger.debug("GP_WINNER table=%s round=%s — lich su cap nhat qua event", table_id, game_round)

    async def _on_betting_open(self, page: Page, table_name: str) -> None:
        """CUOC_MO — dat cuoc khi cua mo."""
        await self._sync_runtime_table_from_page(page)
        table_name = self._effective_table_name() or table_name
        await self.auto_bettor.on_betting_open(
            page,
            table_name,
            skip_tie=self.config.game.skip_tie,
        )

    async def _on_ae_history_update(self, history: list[BetSide], source: str, prev_len: int = 0):
        """Cap nhat lich su tu DOM/CDP AE SEXY — goi khi co van moi."""
        prev_snapshot = list(self.state.history)
        self.state.history = list(history)
        table_name = self.state.table_name or self._active_table_id
        stats = None
        round_meta: dict[int, dict] = {}
        if self.ae_collector and table_name:
            stats = self.ae_collector.get_stats(table_name)
        if table_name and history and self.ae_collector and self.ae_collector.in_room:
            if (
                self.ae_collector.table_ready
                and self.page
                and await self._is_table_ready(self.page, table_name)
            ):
                round_meta = self._round_meta_for_history(table_name, history, start_index=prev_len)
                saved = self.store.append_history(
                    table_name,
                    history,
                    prev_len,
                    source=source,
                    stats=stats,
                    round_meta=round_meta,
                )
                if saved:
                    logger.info("DB: +%d van ban %s", saved, table_name)
            else:
                logger.debug("Bo qua luu DB — ban %s chua san sang (stats=0)", table_name)
        elif table_name and history:
            logger.debug("Bo qua luu DB — chua trong ban %s", table_name)
        if len(history) > prev_len:
            new_sides = history[prev_len:]
            last_label = SIDE_LABEL.get(new_sides[-1], new_sides[-1].value)
            logger.info("Van moi (%s): %s — tong %d van", source, last_label, len(history))
            table = table_name or self.state.table_name or ""
            if self.page and table:
                # Resolve pending truoc khi ve overlay — tranh hien buoc/PnL cu khi van da co ket qua.
                await self.auto_bettor.on_history_grew(
                    self.page,
                    history,
                    prev_len,
                    table_name=table,
                    skip_tie=self.config.game.skip_tie,
                    source=source,
                    round_meta_by_index=round_meta,
                )
            if (
                getattr(self, "_restart_pending_tab_id", "")
                and len(history) > self._restart_pending_after_history_len
                and not self.auto_bettor.is_busy
                and self.betting_session.state.pending is None
            ):
                logger.info(
                    "[RUN_RESTART] Ready tab=%s at history=%d; "
                    "new-round arm was evaluated",
                    self._restart_pending_tab_id, len(history),
                )
                self._restart_pending_tab_id = ""
                self._restart_pending_after_history_len = 0
            await self._analyze_patterns(last_result=last_label)
        elif prev_len == 0 and history:
            await self._analyze_patterns(full=True)
        elif history != prev_snapshot:
            await self._analyze_patterns(full=True)

    async def _on_table_loaded(self, table: dict, history_codes: list[str]):
        """Luu lich su co san khi vao ban — map theo table_id."""
        t_id = str(table.get("tId", ""))
        t_no = str(table.get("tNo", ""))
        if not self._table_matches(t_id):
            logger.debug("Bo qua lich su ban khac: %s (id=%s)", t_no, t_id)
            return

        if self._active_table_id and t_id != self._active_table_id:
            self.state.history = []
            self._reset_table_caches()

        self._active_table_id = t_id
        self.state.table_id = t_id
        self.state.table_name = t_no
        if self.collector:
            self.collector.table_id = table.get("tId")

        decoded = len([c for c in history_codes if decode_baccarat_result(str(c))])
        logger.info(
            "Lich su ban %s (id=%s): %d ma | %d van decode",
            t_no, t_id, len(history_codes), decoded,
        )

        sides: list[BetSide] = []
        for code in history_codes:
            side = decode_baccarat_result(str(code))
            if side:
                sides.append(side)
        saved = 0
        if t_no and sides:
            saved = self.store.save_table_history(t_no, sides, source="ongames-load")
        logger.info("Da luu %d/%d van lich su vao DB (ban id=%s)", saved, len(history_codes), t_id)
        self._reset_table_caches()
        await self._analyze_patterns(full=True)

    async def _on_history_sync(self, table: dict, history_codes: list[str], prev_history: list[BetSide]):
        """Cap nhat khi 1101 day lich su moi (van moi) — chi ban dang theo doi."""
        t_id = str(table.get("tId", ""))
        t_no = str(table.get("tNo", ""))
        if not self._table_matches(t_id):
            return

        self.state.table_id = t_id
        self.state.table_name = t_no

        prev = [s for s in prev_history if s != BetSide.TIE] if self.config.game.skip_tie else prev_history
        curr = [s for s in self.state.history if s != BetSide.TIE] if self.config.game.skip_tie else list(self.state.history)
        if len(curr) <= len(prev):
            return

        new_sides = curr[len(prev):]
        if t_no and new_sides:
            self.store.append_history(t_no, curr, len(prev), source="ongames-sync")

        last_label = SIDE_LABEL.get(new_sides[-1], new_sides[-1].value)
        await self._analyze_patterns(last_result=last_label)

    async def _on_round_result(self, result: RoundResult):
        t_id = self.state.table_id
        t_no = self.state.table_name
        if t_id and not self._table_matches(t_id):
            return
        if t_no and self.state.history:
            self.store.append_history(
                t_no,
                self.state.history,
                len(self.state.history) - 1,
                source="ongames-round",
            )
        last_label = SIDE_LABEL.get(result.side, result.side.value)
        await self._analyze_patterns(last_result=last_label)

    async def _analyze_patterns(self, *, full: bool = False, last_result: str = ""):
        history_key = (
            str(self.state.table_id),
            len(self.state.history),
            tuple(s.value for s in self.state.history[-6:]),
        )
        if not full and history_key == self._last_history_key:
            return
        self._last_history_key = history_key

        # A background collector can deliver the initial trusted history
        # without passing through _reload_table_history.  Unlock only when
        # that data is about to become the matching workspace snapshot.
        if self._workspace_loading and self.state.history:
            self._workspace_loading = False
            self.overlay.set_workspace_loading(False)
            logger.info(
                "[WORKSPACE_UNLOCK] table=%s source=history_update count=%d",
                self._effective_table_name(),
                len(self.state.history),
            )

        if self.page:
            steps_label, steps_warn = self._stake_steps_overlay_meta()
            pnl = self._get_pnl_overlay()
            overlay_table = self._effective_table_name()
            await self.overlay.update(
                self.page,
                self.state.history,
                table_name=overlay_table,
                table_id=str(
                    self.state.table_id
                    or self._active_table_id
                    or overlay_table
                ),
                skip_tie=self.config.game.skip_tie,
                stakes=self.config.betting.stakes,
                betting=self._overlay_betting_payload(),
                stats_scope=self._pattern_stats_scope,
                stake_steps=self._get_stake_steps_today(),
                stake_steps_label=steps_label,
                stake_steps_warn=steps_warn,
                pnl_today=self._pnl_as_dict(pnl["today"]),
                pnl_7days=self._pnl_as_dict(pnl["7days"]),
                strategy_tabs=self._overlay_strategy_tabs_payload(),
                license_status=self.tool_auth.license_status(),
            )

    async def _print_summary(self):
        await self._analyze_patterns()
        summary = self.store.get_summary()
        session = self.session_factory()
        try:
            total_rounds = session.query(RoundRecord).count()
        finally:
            session.close()
        logger.info(
            "DB: %d sanh | %d ban (%s) | %d van (%s) | tong %d van",
            summary["halls"],
            summary["tables"],
            self.store.hall_name,
            summary["rounds"],
            self.store.hall_name,
            total_rounds,
        )


def main():
    maintenance_result = handle_release_command(sys.argv[1:])
    if maintenance_result is not None:
        raise SystemExit(maintenance_result)
    configure_runtime_logging()
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(HistoryWatcher().run())


if __name__ == "__main__":
    main()
