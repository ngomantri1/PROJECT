from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime

from playwright.async_api import Page

from src.ae_sexy_betting import (
    probe_betting_phase,
    read_account_balance,
    wait_and_place_bet,
)
from src.betting_session import BettingSession, PendingBet
from src.config import TieNurtureConfig
from src.decision_pipeline import (
    LegacyArmSnapshot,
    LegacyPatternStrategy,
    ShadowDecisionPipeline,
    ShadowDecisionStats,
)
from src.db_store import GameDataStore
from src.models import BetSide, SIDE_LABEL
from src.pattern_analyzer import get_active_signal
from src.risk_decision import ExecutionMode, RiskContext, RiskManager
from src.round_trace import cuoc_bo_qua, cuoc_dat, cuoc_thu
from src.strategy_decision import StrategyContext
from src.tie_nurture_engine import PATTERN_ID as TIE_PATTERN_ID
from src.tie_nurture_engine import PATTERN_NAME as TIE_PATTERN_NAME
from src.tie_nurture_engine import TieNurtureEngine

logger = logging.getLogger(__name__)

# SSOT marker-roads cap nhat lich su truoc roadInfo WS — phai la trigger hop le
BET_TRIGGER_SOURCES = frozenset({"gp-winner", "road-info-round", "marker-roads"})
_BET_OPEN_POLL_SEC = 0.5
_BET_OPEN_WATCH_SEC = 55.0
_BET_PLACE_TIMEOUT_SEC = 45


class AutoBettor:
    """Tu dong dat cuoc theo tin hieu mau — trigger: GP_WINNER / roadInfo / marker-roads (+1 van).
    Nuoi Hoa: cuoc them SAU khi cuoc mode hoan tat trong cung cua (khong doc quyen).
    """

    def __init__(self, session: BettingSession, store: GameDataStore):
        self.session = session
        self.store = store
        self.tie = TieNurtureEngine()
        self._last_processed_len = 0
        self._ui_failed_handler = None
        self._healthy_handler = None
        self._bet_resolved_handler = None
        self._round_meta_provider = None
        self._history_provider = None
        self._ui_alive_checker = None
        self._shuffle_checker = None
        self._bet_lock = asyncio.Lock()
        self._betting_active = 0
        self._clicking_bet = 0
        self._armed_bet: dict | None = None
        self._multi_live_pending: dict | None = None
        self._bet_open_poll_task: asyncio.Task | None = None
        self._placing_key: tuple | None = None
        self._placed_round_keys: set[tuple] = set()
        self._disabled_patterns: frozenset[str] = frozenset()
        self._pattern_lengths: dict[str, int] = {}
        self._decision_shadow_enabled = True
        self._decision_shadow_stats = ShadowDecisionStats()
        self._last_shadow_event_key: tuple | None = None
        self._strategy_tab_shadow_evaluator = None
        self._strategy_tab_live_evaluator = None
        self._multi_live_result_handler = None
        self._runtime_unsafe_handler = None
        self._license_checker = None

    def configure_tie_nurture(
        self, cfg: TieNurtureConfig, *, history: list[BetSide] | None = None
    ) -> None:
        self.tie.configure(cfg)
        if not cfg.enabled and self._armed_bet and self._armed_bet.get("kind") == "tie":
            self._clear_armed_bet("tat Nuoi Hoa")
        if history is not None:
            self.tie.sync_from_history(history)
        elif cfg.enabled:
            hist = self._current_history()
            if hist:
                self.tie.sync_from_history(hist)

    async def maybe_arm_tie_after_sync(
        self,
        page: Page,
        history: list[BetSide],
        *,
        table_name: str,
        skip_tie: bool = True,
    ) -> None:
        """Sau nap lich su / bat toggle — neu gap du thi arm Hoa cho cua mo sap toi."""
        if not self.tie.wants_bet():
            return
        async with self._bet_lock:
            await self._arm_bet_signal(
                page,
                history,
                table_name=table_name,
                skip_tie=skip_tie,
                source="marker-roads",
            )

    @property
    def is_placing_bet(self) -> bool:
        """Dang click chip/zone — chan poll ngan (khong chan ca 45s cho cua)."""
        return self._clicking_bet > 0

    @property
    def is_betting_active(self) -> bool:
        return self._betting_active > 0

    @property
    def is_busy(self) -> bool:
        """Dang dat chip — recovery phai hoan."""
        return self._betting_active > 0 or self._placing_key is not None

    @property
    def has_armed_bet(self) -> bool:
        return self._armed_bet is not None

    def set_ui_failed_handler(self, handler) -> None:
        self._ui_failed_handler = handler

    def set_healthy_handler(self, handler) -> None:
        self._healthy_handler = handler

    def set_bet_resolved_handler(self, handler) -> None:
        """handler() — goi sau khi resolve_bet vao DB."""
        self._bet_resolved_handler = handler

    def set_round_meta_provider(self, provider) -> None:
        """provider(table_name, bead_index) -> {game_shoe, game_round}."""
        self._round_meta_provider = provider

    def set_history_provider(self, provider) -> None:
        """provider() -> list[BetSide] — lich su hien tai de tranh arm cu."""
        self._history_provider = provider

    def set_ui_alive_checker(self, checker) -> None:
        """checker(page) -> (ok: bool, reason: str) — UI game con song khong."""
        self._ui_alive_checker = checker

    def set_shuffle_checker(self, checker) -> None:
        """checker(table_name) -> bool — True khi dang xao bai."""
        self._shuffle_checker = checker

    def set_disabled_patterns(self, disabled: frozenset[str] | set[str] | None) -> None:
        self._disabled_patterns = frozenset(disabled or ())

    def set_pattern_lengths(self, lengths: dict[str, int] | None) -> None:
        from src.pattern_analyzer import normalize_pattern_lengths

        self._pattern_lengths = normalize_pattern_lengths(lengths)

    def set_decision_shadow_enabled(self, enabled: bool) -> None:
        self._decision_shadow_enabled = bool(enabled)

    def set_strategy_tab_shadow_evaluator(self, evaluator) -> None:
        self._strategy_tab_shadow_evaluator = evaluator

    def set_strategy_tab_live_evaluator(self, evaluator) -> None:
        self._strategy_tab_live_evaluator = evaluator

    def set_multi_live_result_handler(self, handler) -> None:
        self._multi_live_result_handler = handler

    def set_runtime_unsafe_handler(self, handler) -> None:
        self._runtime_unsafe_handler = handler

    def set_license_checker(self, checker) -> None:
        self._license_checker = checker

    def decision_shadow_status(self) -> dict:
        data = self._decision_shadow_stats.to_dict()
        data["enabled"] = self._decision_shadow_enabled
        return data

    def _run_decision_shadow(
        self,
        history: list[BetSide],
        *,
        table_name: str,
        skip_tie: bool,
        source: str,
        shuffling: bool,
    ) -> None:
        """Diagnostic only. Never returns a value used by the legacy arm path."""

        if not self._decision_shadow_enabled:
            return

        try:
            legacy_signal = get_active_signal(
                history,
                skip_tie=skip_tie,
                disabled_patterns=self._disabled_patterns,
                pattern_lengths=self._pattern_lengths,
            )
            source_allowed = not source or source in BET_TRIGGER_SOURCES
            legacy = LegacyArmSnapshot(
                can_place_bet=self.session.can_place_bet(),
                signal=legacy_signal,
                stake=int(self.session.current_stake),
                blocked_by_shuffle=shuffling,
                pending_main=self.session.state.pending is not None,
                pending_tie=self.tie.has_pending,
                source_allowed=source_allowed,
            )
            strategy = LegacyPatternStrategy(
                skip_tie=skip_tie,
                disabled_patterns=self._disabled_patterns,
                pattern_lengths=self._pattern_lengths,
            )
            pipeline = ShadowDecisionPipeline(strategy)
            report = pipeline.evaluate(
                context=StrategyContext(
                    history=tuple(history),
                    table_name=table_name,
                    source=source,
                ),
                progression=self.session.progression,
                legacy=legacy,
                auto_bet=self.session.state.auto_bet,
                daily_profit=self.session.effective_profit,
                stop_loss=self.session.state.stop_loss,
                take_profit=self.session.state.take_profit,
                limit_hit=self.session.state.limit_hit,
            )
            self._decision_shadow_stats.record(report, table_name=table_name)
            if self._strategy_tab_shadow_evaluator:
                try:
                    self._strategy_tab_shadow_evaluator(
                        history=list(history),
                        table_name=table_name,
                        skip_tie=skip_tie,
                        source=source,
                        shuffling=shuffling,
                        legacy=legacy,
                    )
                except Exception:
                    logger.exception("[TAB_SHADOW] Không đánh giá được strategy tab")
            if (
                self._decision_shadow_stats.evaluations == 1
                or self._decision_shadow_stats.evaluations % 25 == 0
            ):
                logger.info(
                    "[SHADOW] STATUS | total=%d | match=%d | mismatch=%d | error=%d",
                    self._decision_shadow_stats.evaluations,
                    self._decision_shadow_stats.matches,
                    self._decision_shadow_stats.mismatches,
                    self._decision_shadow_stats.errors,
                )
            if report.matched:
                logger.debug(
                    "[SHADOW] MATCH | ban=%s | van=%d | signal=%s | stake=%d | risk=%s",
                    table_name or "?",
                    len(history),
                    report.strategy.signal_id or "-",
                    report.money.stake,
                    report.risk.code.value,
                )
                return

            event_key = (
                table_name,
                len(history),
                source,
                report.mismatches,
                (
                    report.legacy.signal.pattern_id
                    if report.legacy.signal
                    else ""
                ),
                report.strategy.signal_id,
                report.legacy.stake,
                report.money.stake,
            )
            if event_key == self._last_shadow_event_key:
                return
            self._last_shadow_event_key = event_key
            payload = report.to_event_payload(
                table_name=table_name,
                source=source,
            )
            logger.warning(
                "[SHADOW] MISMATCH | ban=%s | van=%d | lech=%s | old=%s/%s/%d | new=%s/%s/%d | risk=%s",
                table_name or "?",
                len(history),
                ",".join(report.mismatches),
                payload["legacy"]["signal_id"] or "-",
                payload["legacy"]["side"] or "-",
                payload["legacy"]["stake"],
                payload["shadow"]["strategy"]["signal_id"] or "-",
                payload["shadow"]["strategy"]["side"] or "-",
                payload["shadow"]["money"]["stake"],
                payload["shadow"]["risk"]["code"],
            )
            try:
                self.store.save_event("decision_shadow_mismatch", payload)
            except Exception as exc:
                logger.warning("[SHADOW] Khong luu duoc mismatch event: %s", exc)
        except Exception as exc:
            self._decision_shadow_stats.record_error(
                table_name=table_name,
                history_size=len(history),
            )
            logger.exception(
                "[SHADOW] ERROR | ban=%s | van=%d | %s",
                table_name or "?",
                len(history),
                exc,
            )

    def clear_armed_if_pattern(self, pattern_id: str, reason: str = "") -> None:
        armed = self._armed_bet
        signal = armed.get("signal") if armed else None
        if signal and signal.pattern_id == pattern_id:
            self._clear_armed_bet(reason or f"mau {pattern_id} tat")

    def sync_history_len(self, length: int, *, force: bool = False) -> None:
        if force or self._last_processed_len == 0:
            self._last_processed_len = length

    @asynccontextmanager
    async def _click_scope(self):
        self._clicking_bet += 1
        try:
            yield
        finally:
            self._clicking_bet = max(0, self._clicking_bet - 1)

    async def wait_until_idle(self, timeout_sec: float = 62) -> bool:
        """Cho het luong cuoc. Tra ve True neu idle, False neu het timeout."""
        import time

        deadline = time.monotonic() + timeout_sec
        while self.is_busy and time.monotonic() < deadline:
            await asyncio.sleep(0.25)
        return not self.is_busy

    def _stop_bet_open_poll(self) -> None:
        task = self._bet_open_poll_task
        self._bet_open_poll_task = None
        if task and not task.done():
            task.cancel()

    async def cancel_bet_watch(self) -> None:
        """Huy watcher cho CUOC_MO (vd. bi day ra sanh)."""
        task = self._bet_open_poll_task
        self._stop_bet_open_poll()
        if self._armed_bet:
            self._clear_armed_bet("huy — UI ra sanh / khoi phuc")
        self._placing_key = None
        if not task or task.done() or task is asyncio.current_task():
            return
        try:
            await task
        except asyncio.CancelledError:
            pass

    def _current_history(self) -> list[BetSide]:
        if not self._history_provider:
            return []
        try:
            history = self._history_provider()
            return list(history) if history else []
        except Exception as exc:
            logger.debug("history_provider: %s", exc)
            return []

    def _clear_armed_bet(self, reason: str = "") -> None:
        if self._armed_bet and reason:
            logger.info(
                "[PHIEN] HUY_VU_KHI | ban=%s | %s",
                self._armed_bet.get("table_name", "?"),
                reason,
            )
        self._armed_bet = None

    def _armed_window_missed(self, history: list[BetSide]) -> bool:
        armed = self._armed_bet
        if not armed:
            return False
        armed_at = int(armed.get("armed_at_len") or 0)
        return len(history) > armed_at

    def notify_history_grew(
        self,
        page: Page,
        history: list[BetSide],
        prev_len: int,
        *,
        table_name: str,
        skip_tie: bool = True,
        source: str = "",
    ) -> None:
        """Van moi tu roadInfo/GP_WINNER — dat cuoc (fire-and-forget; uu tien goi on_history_grew)."""
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(
                self.on_history_grew(
                    page,
                    history,
                    prev_len,
                    table_name=table_name,
                    skip_tie=skip_tie,
                    source=source,
                )
            )
        except RuntimeError:
            pass

    async def on_history_grew(
        self,
        page: Page,
        history: list[BetSide],
        prev_len: int,
        *,
        table_name: str,
        skip_tie: bool = True,
        source: str = "",
    ) -> None:
        async with self._bet_lock:
            if len(history) <= prev_len:
                return

            new_results = history[prev_len:]
            for result in new_results:
                await self._resolve_if_needed(result, table_name)
                tie_resolved = await self._resolve_tie_if_needed(result, table_name)
                if not tie_resolved:
                    self.tie.observe_result(result)

            self._last_processed_len = len(history)

            if self._armed_window_missed(history):
                armed_at = int(self._armed_bet.get("armed_at_len") or 0) if self._armed_bet else 0
                self._clear_armed_bet(
                    f"qua cua cuoc — tool={len(history)} van, arm tai #{armed_at}"
                )
                self._stop_bet_open_poll()

            if prev_len == 0 and len(new_results) > 1:
                cuoc_bo_qua(
                    reason="dong bo lich su ban dau",
                    table=table_name,
                    source=source,
                    tool_len=len(history),
                    detail=f"nap {len(new_results)} van — cho van moi",
                )
                return

            if source and source not in BET_TRIGGER_SOURCES:
                cuoc_bo_qua(
                    reason="nguon khong trigger cuoc",
                    table=table_name,
                    source=source,
                    tool_len=len(history),
                )
                return

            await self._arm_bet_signal(
                page, history, table_name=table_name, skip_tie=skip_tie, source=source
            )

    async def on_betting_open(
        self,
        page: Page,
        table_name: str,
        *,
        skip_tie: bool = True,
    ) -> None:
        """CUOC_MO — dat cuoc khi cua mo (khong dat luc co ket qua / dang mo bai)."""
        async with self._bet_lock:
            if self.is_busy or self.session.state.pending or self.tie.has_pending:
                logger.debug("[PHIEN] CUOC_MO — bo qua (dang dat hoac cho ket qua)")
                return
            if not self._armed_bet:
                logger.debug("[PHIEN] CUOC_MO — chua co vu khi cuoc")
                return
            if self._armed_bet.get("table_name") != table_name:
                return

            history = self._current_history() or list(self._armed_bet.get("history") or [])
            if self._armed_window_missed(history):
                self._clear_armed_bet(f"het cua — tool={len(history)} van")
                self._stop_bet_open_poll()
                return

            armed = self._armed_bet
            want_tie = bool(armed.get("tie")) or self.tie.wants_bet()
            has_pattern = bool(armed.get("signal")) and armed.get("kind") != "tie"
            live_authorities = list(armed.get("live_authorities") or [])

            placed_main = False
            placed_tie = False

            if has_pattern:
                signal = armed.get("signal")
                logger.info(
                    "[PHIEN] CUOC_MO_DAT | ban=%s | %s | mau=%s | van #%d%s",
                    table_name,
                    SIDE_LABEL.get(signal.bet_side, "?") if signal else "?",
                    signal.pattern_name if signal else "?",
                    len(history),
                    " (+Hoa sau)" if want_tie else "",
                )
                if live_authorities:
                    placed_main = await self._try_place_multi_live(
                        page,
                        history,
                        table_name=table_name,
                        source="cuoc-mo-multi-live",
                        bet_timeout_sec=_BET_PLACE_TIMEOUT_SEC,
                    )
                else:
                    placed_main = await self._try_place_bet(
                        page,
                        history,
                        table_name=table_name,
                        skip_tie=armed.get("skip_tie", skip_tie),
                        source="cuoc-mo",
                        bet_timeout_sec=_BET_PLACE_TIMEOUT_SEC,
                    )
            elif want_tie:
                logger.info(
                    "[PHIEN] CUOC_MO_DAT | ban=%s | hoa (khong co mau) | Nuoi Hoa | van #%d",
                    table_name,
                    len(history),
                )

            # Sau cuoc chinh (xong / khong co mau) → them Hoa neu khop dieu kien
            if want_tie and self.tie.wants_bet() and not self.tie.has_pending:
                if has_pattern:
                    await page.wait_for_timeout(400)
                logger.info(
                    "[PHIEN] CUOC_HOA_THEM | ban=%s | sau mode=%s | van #%d",
                    table_name,
                    "ok" if placed_main else ("skip" if not has_pattern else "fail"),
                    len(history),
                )
                placed_tie = await self._try_place_tie_bet(
                    page,
                    history,
                    table_name=table_name,
                    source="cuoc-mo-hoa",
                    bet_timeout_sec=_BET_PLACE_TIMEOUT_SEC if not has_pattern else 25,
                    allow_after_main=True,
                )

            self._stop_bet_open_poll()
            ok = placed_main or placed_tie or (not has_pattern and not want_tie)
            if has_pattern and want_tie:
                ok = placed_main or placed_tie
            self._clear_armed_bet("" if ok else "dat cuoc that bai hoac het cua")

    async def _arm_bet_signal(
        self,
        page: Page,
        history: list[BetSide],
        *,
        table_name: str,
        skip_tie: bool,
        source: str,
    ) -> None:
        """Sau ket qua van — vu khi tin hieu, cho CUOC_MO de dat.
        Mode pattern danh truoc; Nuoi Hoa la cuoc them sau khi mode xong (cung cua).
        """
        shuffling = False
        if self._shuffle_checker:
            try:
                shuffling = bool(self._shuffle_checker(table_name))
            except Exception as exc:
                logger.debug("shuffle_checker: %s", exc)

        self._run_decision_shadow(
            history,
            table_name=table_name,
            skip_tie=skip_tie,
            source=source,
            shuffling=shuffling,
        )

        if shuffling:
            cuoc_bo_qua(
                reason="dang xao bai",
                table=table_name,
                source=source,
                tool_len=len(history),
            )
            return

        # Chi chan khi con pending cua van TRUOC (chua resolve)
        if self.session.state.pending or self.tie.has_pending:
            cuoc_bo_qua(
                reason="dang cho ket qua cuoc truoc",
                table=table_name,
                source=source,
                tool_len=len(history),
            )
            return

        want_tie = self.tie.wants_bet()
        signal = None
        live_authority = None
        live_authorities = []
        if self._strategy_tab_live_evaluator:
            try:
                evaluated = self._strategy_tab_live_evaluator(
                    history=list(history),
                    table_name=table_name,
                    skip_tie=skip_tie,
                    source=source,
                    shuffling=shuffling,
                )
                if isinstance(evaluated, (list, tuple)):
                    live_authorities = list(evaluated)
                elif evaluated is not None:
                    live_authorities = [evaluated]
            except Exception as exc:
                logger.exception("[TAB_LIVE] Lỗi authority; tự demote: %s", exc)
                if self._runtime_unsafe_handler:
                    self._runtime_unsafe_handler("Lỗi đánh giá live strategy")

        if live_authorities:
            # Live tabs are evaluated independently. They share one aggregate
            # round transaction so recovery/dedup still sees one pending bet.
            want_tie = False
            live_authorities = [
                authority
                for authority in live_authorities
                if authority.may_participate
            ]
            live_authority = (
                live_authorities[0] if live_authorities else None
            )
            signal = live_authority.as_pattern() if live_authority else None
            if signal is None:
                self._armed_bet = None
                logger.info("[TAB_LIVE] Không tab Live nào có lệnh hợp lệ")
                return
        elif self.session.can_place_bet():
            signal = get_active_signal(
                history,
                skip_tie=skip_tie,
                disabled_patterns=self._disabled_patterns,
                pattern_lengths=self._pattern_lengths,
            )
            if signal and not signal.bet_side:
                signal = None

        if not signal and not want_tie:
            self._armed_bet = None
            if not self.session.can_place_bet():
                cuoc_bo_qua(
                    reason="auto cuoc tat hoac cham gioi han hoac dang cho ket qua",
                    table=table_name,
                    source=source,
                    tool_len=len(history),
                )
            else:
                cuoc_bo_qua(
                    reason="chua co mau khop",
                    table=table_name,
                    source=source,
                    tool_len=len(history),
                    detail="khong co tin hieu / khong nuoi Hoa",
                )
            return

        armed_at = len(history)
        if (
            self._armed_bet
            and self._armed_bet.get("armed_at_len") == armed_at
            and self._armed_bet.get("table_name") == table_name
            and bool(self._armed_bet.get("signal")) == bool(signal)
            and bool(self._armed_bet.get("tie")) == want_tie
            and tuple(
                item.tab_id
                for item in self._armed_bet.get("live_authorities", [])
            )
            == tuple(item.tab_id for item in live_authorities)
        ):
            logger.debug("[PHIEN] VU_KHI_CUOC — da arm cho van #%d", armed_at)
            self._schedule_bet_on_open_poll(page, table_name)
            return

        if signal and want_tie:
            kind = "both"
        elif signal:
            kind = "pattern"
        else:
            kind = "tie"

        self._armed_bet = {
            "kind": kind,
            "history": list(history),
            "table_name": table_name,
            "skip_tie": skip_tie,
            "source": source,
            "signal": signal,
            "live_authority": live_authority,
            "live_authorities": live_authorities,
            "tie": want_tie,
            "armed_at_len": armed_at,
            "stake": int(self.tie.cfg.stake) if want_tie else 0,
        }
        if signal:
            logger.info(
                "[PHIEN] VU_KHI_CUOC | ban=%s | %s | mau=%s%s | cho CUOC_MO",
                table_name,
                SIDE_LABEL.get(signal.bet_side, signal.bet_side.value),
                signal.pattern_name,
                " + Hoa them sau" if want_tie else "",
            )
        else:
            logger.info(
                "[PHIEN] VU_KHI_CUOC | ban=%s | hoa | Nuoi Hoa gap=%d | cho CUOC_MO",
                table_name,
                self.tie.gap,
            )
        self._schedule_bet_on_open_poll(page, table_name)

    def _schedule_bet_on_open_poll(self, page: Page, table_name: str) -> None:
        """Watcher DOM nhanh — chi fire khi cd>0 hoac confirm ready."""
        self._stop_bet_open_poll()
        try:
            loop = asyncio.get_running_loop()
            self._bet_open_poll_task = loop.create_task(
                self._poll_bet_on_open(page, table_name)
            )
        except RuntimeError:
            pass

    def _betting_window_open(self, phase: dict) -> bool:
        if phase.get("closed") or phase.get("moBai"):
            return False
        if not phase.get("chipsVisible") or not phase.get("zoneVisible"):
            return False
        cd = str(phase.get("cdText") or "").strip()
        has_cd = bool(cd and cd.isdigit() and int(cd) > 0)
        if has_cd and int(cd) < 3:
            return False
        if has_cd:
            return True
        if phase.get("confirmReady"):
            return True
        if phase.get("bettingText"):
            return True
        if phase.get("cdVisible") and phase.get("progressActive"):
            return True
        if phase.get("cdVisible") and phase.get("hasCountdown"):
            return True
        return bool(phase.get("open") or phase.get("canClick"))

    async def _poll_bet_on_open(self, page: Page, table_name: str) -> None:
        """Khi armed — goi wait_and_place_bet (tu cho cua mo), khong can detect window truoc."""
        deadline = time.monotonic() + _BET_OPEN_WATCH_SEC
        try:
            while time.monotonic() < deadline:
                if page.is_closed():
                    if (
                        (self._armed_bet or {}).get("live_authority") is not None
                        and self._runtime_unsafe_handler
                    ):
                        self._runtime_unsafe_handler("Browser/page đã đóng")
                    return
                armed = self._armed_bet
                if not armed or armed.get("table_name") != table_name:
                    return
                if self.is_busy:
                    await asyncio.sleep(_BET_OPEN_POLL_SEC)
                    continue
                history = self._current_history()
                if history and self._armed_window_missed(history):
                    async with self._bet_lock:
                        if self._armed_bet:
                            self._clear_armed_bet(f"poll — tool={len(history)} van")
                    return
                if self._ui_alive_checker:
                    try:
                        ui_ok, ui_reason = await self._ui_alive_checker(page)
                        if not ui_ok:
                            if (
                                armed.get("live_authority") is not None
                                and self._runtime_unsafe_handler
                            ):
                                self._runtime_unsafe_handler(
                                    f"UI không an toàn: {ui_reason}"
                                )
                            logger.warning(
                                "[PHIEN] BO_QUA_DAT | UI hong: %s — cho khoi phuc",
                                ui_reason,
                            )
                            await asyncio.sleep(_BET_OPEN_POLL_SEC)
                            continue
                    except Exception as exc:
                        logger.debug("ui_alive_checker: %s", exc)
                logger.info("[PHIEN] BAT_DAU_DAT | ban=%s — cho cua mo trong %ds", table_name, _BET_PLACE_TIMEOUT_SEC)
                await self.on_betting_open(page, table_name)
                return
        except asyncio.CancelledError:
            return

    async def _resolve_if_needed(self, result: BetSide, table_name: str) -> None:
        pending = self.session.state.pending
        if not pending:
            return
        if pending.bet_id <= 0:
            logger.warning("Bo qua resolve pending tam — chua co bet_id")
            self.session.clear_pending()
            return

        multi = self._multi_live_pending
        if multi and multi.get("round_id") == pending.round_id:
            allocations = list(multi.get("allocations") or [])
            resolved_allocations = []
            if self._multi_live_result_handler:
                resolved_allocations = list(
                    self._multi_live_result_handler(allocations, result) or []
                )
            if not resolved_allocations:
                for allocation in allocations:
                    side = BetSide(allocation["side"])
                    stake = float(allocation["stake"])
                    if result == BetSide.TIE:
                        outcome, profit = "push", 0.0
                    elif result == side:
                        outcome = "win"
                        profit = (
                            stake * 0.95
                            if side == BetSide.BANKER
                            else stake
                        )
                    else:
                        outcome, profit = "loss", -stake
                    resolved_allocations.append(
                        {
                            **allocation,
                            "outcome": outcome,
                            "profit": profit,
                        }
                    )
            total_profit = sum(
                float(item.get("profit") or 0)
                for item in resolved_allocations
            )
            resolved = self.session.resolve_aggregate_pending(total_profit)
            if resolved is None:
                return
            outcome, profit = resolved
            self.store.resolve_bet(
                pending.bet_id,
                outcome=outcome,
                profit=profit,
                session_profit_after=self.session.state.session_profit,
            )
            self.store.save_event(
                "multi_live_resolved",
                {
                    "bet_id": pending.bet_id,
                    "table": table_name,
                    "result": result.value,
                    "outcome": outcome,
                    "profit": profit,
                    "allocations": resolved_allocations,
                },
                round_id=pending.round_id,
            )
            self._multi_live_pending = None
            if self._bet_resolved_handler:
                self._bet_resolved_handler()
            return

        resolved = self.session.resolve_pending(result)
        if not resolved:
            return

        outcome, profit = resolved
        group_pnl_after = self.session.group_pnl_after_resolve()
        self.store.resolve_bet(
            pending.bet_id,
            outcome=outcome,
            profit=profit,
            session_profit_after=self.session.state.session_profit,
            group_pnl_after=group_pnl_after,
        )
        group_id = self.session.state.current_group_id
        if group_id:
            loss_count = (
                self.session.group_loss_count
                if self.session.state.last_group_closed
                else self.session.group_loss_count
            )
            self.store.touch_bet_group(
                group_id,
                pnl=group_pnl_after,
                outcome=outcome,
                stake_index=pending.stake_index,
                loss_count=loss_count,
            )
            if self.session.state.last_group_closed:
                self.store.close_bet_group(
                    group_id,
                    close_reason=self.session.state.last_group_close_reason,
                    pnl=self.session.state.last_group_close_pnl,
                )
                self.store.save_event(
                    "group_closed",
                    {
                        "group_id": group_id,
                        "reason": self.session.state.last_group_close_reason,
                        "pnl": self.session.state.last_group_close_pnl,
                        "table": table_name,
                    },
                    round_id=pending.round_id,
                )
                self.session.clear_current_group()
        self.store.save_event(
            "bet_resolved",
            {
                "bet_id": pending.bet_id,
                "table": table_name,
                "side": pending.side.value,
                "stake": pending.stake,
                "outcome": outcome,
                "profit": profit,
                "session_profit": self.session.state.session_profit,
                "group_id": group_id,
                "group_pnl": group_pnl_after,
                "result": result.value,
            },
            round_id=pending.round_id,
        )
        logger.info(
            "Ket qua cuoc #%d: %s %s — %s (%+.0f) | P&L phien %+.0f",
            pending.bet_id,
            SIDE_LABEL.get(pending.side, pending.side.value),
            pending.stake,
            outcome.upper(),
            profit,
            self.session.state.session_profit,
        )
        if self._bet_resolved_handler:
            try:
                self._bet_resolved_handler()
            except Exception as exc:
                logger.debug("bet_resolved_handler: %s", exc)

        if self.session.state.limit_hit:
            self.store.save_event(
                "limit_hit",
                {
                    "reason": self.session.state.limit_hit,
                    "session_profit": self.session.state.session_profit,
                    "stop_loss": self.session.state.stop_loss,
                    "take_profit": self.session.state.take_profit,
                },
            )
            logger.warning(
                "Cham gioi han %s — tu tat auto cuoc (P&L %+.0f)",
                self.session.state.limit_hit,
                self.session.state.session_profit,
            )

    async def _resolve_tie_if_needed(self, result: BetSide, table_name: str) -> bool:
        """Resolve cuoc Hoa rieng — khong dung GroupStakeProgression. True neu co pending."""
        pending = self.tie.pending
        if not pending:
            return False
        if pending.bet_id <= 0:
            logger.warning("[HOA] Bo qua resolve pending tam — chua co bet_id")
            self.tie.clear_pending()
            return True

        resolved = self.tie.resolve_pending(result)
        if not resolved:
            return True
        outcome, profit = resolved
        self.store.resolve_bet(
            pending.bet_id,
            outcome=outcome,
            profit=profit,
            session_profit_after=self.session.state.session_profit,
            group_pnl_after=0.0,
        )
        self.store.save_event(
            "bet_resolved",
            {
                "bet_id": pending.bet_id,
                "table": table_name,
                "side": BetSide.TIE.value,
                "stake": pending.stake,
                "outcome": outcome,
                "profit": profit,
                "session_profit": self.session.state.session_profit,
                "tie_session_pnl": self.tie.session_pnl,
                "pattern": TIE_PATTERN_NAME,
                "result": result.value,
            },
            round_id=pending.round_id,
        )
        logger.info(
            "Ket qua cuoc Hoa #%d: hoa %s — %s (%+.0f) | PnL nuoi Hoa %+.0f",
            pending.bet_id,
            pending.stake,
            outcome.upper(),
            profit,
            self.tie.session_pnl,
        )
        if self._bet_resolved_handler:
            try:
                self._bet_resolved_handler()
            except Exception as exc:
                logger.debug("bet_resolved_handler: %s", exc)
        return True

    async def _try_place_tie_bet(
        self,
        page: Page,
        history: list[BetSide],
        *,
        table_name: str,
        source: str = "",
        bet_timeout_sec: int = 30,
        allow_after_main: bool = False,
    ) -> bool:
        """Dat them Hoa sau cuoc mode (cung cua). Cho phep session.pending mode neu allow_after_main."""
        if not self.tie.wants_bet() and not (
            self._armed_bet and self._armed_bet.get("tie")
        ):
            return False
        if self.tie.has_pending:
            cuoc_bo_qua(
                reason="dang cho ket qua cuoc Hoa truoc",
                table=table_name,
                source=source,
                pattern=TIE_PATTERN_NAME,
                tool_len=len(history),
            )
            return False
        # Van truoc: mode pending ma chua den cua moi → khong dat Hoa xen
        if self.session.state.pending and not allow_after_main:
            cuoc_bo_qua(
                reason="dang cho ket qua cuoc truoc",
                table=table_name,
                source=source,
                pattern=TIE_PATTERN_NAME,
                tool_len=len(history),
            )
            return False

        fresh = self._current_history()
        if fresh:
            history = fresh
        armed_at = (
            int(self._armed_bet.get("armed_at_len") or len(history))
            if self._armed_bet
            else len(history)
        )
        if len(history) > armed_at:
            cuoc_bo_qua(
                reason="qua cua cuoc",
                table=table_name,
                source=source,
                pattern=TIE_PATTERN_NAME,
                tool_len=len(history),
                detail=f"arm #{armed_at}",
            )
            return False

        stake = int(
            (self._armed_bet or {}).get("stake")
            or self.tie.cfg.stake
            or 100
        )
        if stake <= 0:
            stake = int(self.tie.cfg.stake) or 100
        target_index = len(history)
        bet_meta = {}
        if self._round_meta_provider:
            try:
                bet_meta = self._round_meta_provider(table_name, target_index) or {}
            except Exception as exc:
                logger.debug("round_meta_provider: %s", exc)
        game_shoe = int(bet_meta.get("game_shoe") or 0)
        game_round = int(bet_meta.get("game_round") or 0)
        if not game_shoe or not game_round:
            cuoc_bo_qua(
                reason="chua co gameShoe/gameRound",
                table=table_name,
                source=source,
                pattern=TIE_PATTERN_NAME,
                tool_len=len(history),
            )
            return False

        # Tach key voi cuoc mode cung van — tranh chan nham "da dat"
        round_key = (table_name, game_shoe, game_round, target_index, "tie")
        if round_key in self._placed_round_keys:
            cuoc_bo_qua(
                reason="da dat cuoc Hoa van nay",
                table=table_name,
                source=source,
                pattern=TIE_PATTERN_NAME,
                tool_len=len(history),
            )
            return False
        if self._placing_key:
            return False

        round_ref = self.store.reserve_round(
            table_name,
            target_index,
            game_shoe=game_shoe,
            game_round=game_round,
        )
        # round_id rieng — save_bet unique theo round_id (mode dung id goc)
        round_id = f"{round_ref.round_id}#tie"

        cuoc_thu(
            table=table_name,
            side=BetSide.TIE,
            stake=stake,
            pattern=TIE_PATTERN_NAME,
            tool_len=target_index,
            game_round=game_round,
            source=source,
        )

        self._placing_key = round_key
        self.tie.begin_pending(
            round_id=round_id,
            stake=stake,
            target_round_index=target_index,
            table_name=table_name,
            bet_id=0,
        )

        self._betting_active += 1
        placed = False
        try:
            placed = await wait_and_place_bet(
                page,
                BetSide.TIE,
                stake,
                timeout_sec=bet_timeout_sec,
                click_scope=self._click_scope,
            )
        finally:
            self._betting_active = max(0, self._betting_active - 1)

        phase = await probe_betting_phase(page)
        if placed:
            cuoc_dat(
                table=table_name,
                side=BetSide.TIE,
                stake=stake,
                pattern=TIE_PATTERN_NAME,
                cd=str(phase.get("cdText") or ""),
            )

        if not placed:
            self.tie.clear_pending()
            self._placing_key = None
            logger.info(
                "[HOA] Khong dat duoc cuoc Hoa — bo qua van | cd=%s chips=%s zone=%s",
                phase.get("cdText", ""),
                phase.get("chipsVisible"),
                phase.get("zoneVisible"),
            )
            self.store.save_event(
                "bet_skipped",
                {
                    "reason": "betting_closed",
                    "pattern": TIE_PATTERN_NAME,
                    "side": BetSide.TIE.value,
                    "stake": stake,
                    "session_no": round_ref.session_no,
                    "session_date": round_ref.session_date,
                },
                round_id=round_id,
            )
            return False

        bet = self.store.save_bet(
            round_id=round_id,
            table_name=table_name,
            side=BetSide.TIE.value,
            stake=stake,
            stake_index=0,
            pattern_id=TIE_PATTERN_ID,
            pattern_name=TIE_PATTERN_NAME,
            reason=f"gap={self.tie.gap} bets_in={self.tie.bets_in_cycle} after_main={allow_after_main}",
            target_round_index=target_index,
            session_date=round_ref.session_date,
            session_no=round_ref.session_no,
            game_shoe=round_ref.game_shoe,
            game_round=round_ref.game_round,
            status="placed",
            group_id=None,
        )
        if not bet:
            self.tie.clear_pending()
            self._placing_key = None
            logger.warning("[HOA] save_bet that bai sau khi click chip — huy pending")
            return False

        self.tie.attach_bet_id(bet.id)
        self._placed_round_keys.add(round_key)
        self._placing_key = None
        summary = f"Da dat hoa {stake} — Nuoi Hoa"
        if allow_after_main and self.session.state.pending:
            prev = self.session.state.last_bet_summary or ""
            self.session.state.last_bet_summary = f"{prev} | {summary}".strip(" |")
        else:
            self.session.state.last_bet_summary = summary
        logger.info(
            ">>> AUTO CUOC HOA: %s | Nuoi Hoa gap=%d | %s (bead #%d)%s",
            stake,
            self.tie.gap,
            round_ref.display,
            target_index + 1,
            " [sau mode]" if allow_after_main else "",
        )
        if self._healthy_handler:
            self._healthy_handler()
        return True

    async def _try_place_multi_live(
        self,
        page: Page,
        history: list[BetSide],
        *,
        table_name: str,
        source: str,
        bet_timeout_sec: int,
    ) -> bool:
        authorities = list(
            (self._armed_bet or {}).get("live_authorities") or []
        )
        allocations: list[dict] = []
        for authority in authorities:
            if (
                not authority.may_participate
                or authority.strategy.side not in (
                    BetSide.PLAYER,
                    BetSide.BANKER,
                )
            ):
                continue
            allocations.append(
                {
                    "tab_id": authority.tab_id,
                    "tab_name": authority.tab_name,
                    "side": authority.strategy.side.value,
                    "stake": int(authority.stake),
                    "stake_index": 0,
                    "signal_id": authority.strategy.signal_id,
                    "reason": authority.strategy.reason,
                }
            )
        if not allocations:
            return False

        fresh = self._current_history()
        if fresh:
            history = fresh
        armed_at = int(
            (self._armed_bet or {}).get("armed_at_len") or len(history)
        )
        if len(history) > armed_at:
            return False
        target_index = len(history)
        bet_meta = {}
        if self._round_meta_provider:
            bet_meta = self._round_meta_provider(
                table_name,
                target_index,
            ) or {}
        game_shoe = int(bet_meta.get("game_shoe") or 0)
        game_round = int(bet_meta.get("game_round") or 0)
        if not game_shoe or not game_round:
            cuoc_bo_qua(
                reason="chưa có gameShoe/gameRound",
                table=table_name,
                source=source,
                tool_len=len(history),
            )
            return False

        round_key = (
            table_name,
            game_shoe,
            game_round,
            target_index,
            "multi_live",
        )
        if (
            round_key in self._placed_round_keys
            or self._placing_key
            or self.session.state.pending
        ):
            return False

        physical_total = sum(
            item["stake"] for item in allocations if item["stake"] > 0
        )
        if physical_total > 0:
            phase = await probe_betting_phase(page)
            ui_healthy = bool(
                phase.get("chipsVisible")
                and phase.get("zoneVisible")
                and not phase.get("closed")
            )
            cd_text = str(phase.get("cdText") or "").strip()
            countdown = int(cd_text) if cd_text.isdigit() else None
            if self._ui_alive_checker:
                try:
                    alive, _reason = await self._ui_alive_checker(page)
                    ui_healthy = ui_healthy and bool(alive)
                except Exception:
                    ui_healthy = False
            license_allowed = bool(
                self._license_checker()
                if self._license_checker
                else True
            )
            shuffling = bool(
                self._shuffle_checker(table_name)
                if self._shuffle_checker
                else False
            )
            if (
                not self.session.state.auto_bet
                or not license_allowed
                or not ui_healthy
                or shuffling
                or (countdown is not None and countdown < 3)
                or (
                    source
                    and source != "cuoc-mo-multi-live"
                    and source not in BET_TRIGGER_SOURCES
                )
            ):
                cuoc_bo_qua(
                    reason="risk tổng hợp không an toàn",
                    table=table_name,
                    source=source,
                    tool_len=len(history),
                )
                return False
            balance = await read_account_balance(page)
            if balance is None or float(balance) < physical_total:
                cuoc_bo_qua(
                    reason="số dư không đủ cho tổng các tab Live",
                    table=table_name,
                    source=source,
                    tool_len=len(history),
                    detail=f"cần={physical_total} số_dư={balance}",
                )
                return False

        round_ref = self.store.reserve_round(
            table_name,
            target_index,
            game_shoe=game_shoe,
            game_round=game_round,
        )
        pending = PendingBet(
            bet_id=0,
            round_id=round_ref.round_id,
            side=BetSide(allocations[0]["side"]),
            stake=sum(item["stake"] for item in allocations),
            stake_index=0,
            pattern_id="multi_live",
            pattern_name="Nhiều tab Live",
            reason=f"{len(allocations)} phân bổ tab",
            target_round_index=target_index,
            placed_at=datetime.now(),
        )
        self._placing_key = round_key
        if not self.session.try_reserve_pending(pending):
            self._placing_key = None
            return False

        side_totals = {
            side: sum(
                item["stake"]
                for item in allocations
                if item["side"] == side.value and item["stake"] > 0
            )
            for side in (BetSide.PLAYER, BetSide.BANKER)
        }
        placed_sides: set[BetSide] = set()
        self._betting_active += 1
        try:
            for side in (BetSide.PLAYER, BetSide.BANKER):
                amount = side_totals[side]
                if amount <= 0:
                    continue
                placed = await wait_and_place_bet(
                    page,
                    side,
                    amount,
                    timeout_sec=bet_timeout_sec,
                    click_scope=self._click_scope,
                )
                if placed:
                    placed_sides.add(side)
                else:
                    logger.warning(
                        "[MULTI_LIVE] Không đặt được %s %s",
                        side.value,
                        amount,
                    )
        finally:
            self._betting_active = max(0, self._betting_active - 1)

        kept = [
            item
            for item in allocations
            if item["stake"] == 0
            or BetSide(item["side"]) in placed_sides
        ]
        if not kept:
            self.session.clear_pending()
            self._placing_key = None
            return False

        distinct_sides = {item["side"] for item in kept}
        aggregate_side = (
            next(iter(distinct_sides))
            if len(distinct_sides) == 1
            else "multi"
        )
        bet = self.store.save_bet(
            round_id=round_ref.round_id,
            table_name=table_name,
            side=aggregate_side,
            stake=sum(item["stake"] for item in kept),
            stake_index=0,
            pattern_id="multi_live",
            pattern_name="Nhiều tab Live",
            reason=f"{len(kept)} phân bổ tab",
            target_round_index=target_index,
            session_date=round_ref.session_date,
            session_no=round_ref.session_no,
            game_shoe=round_ref.game_shoe,
            game_round=round_ref.game_round,
            status="placed",
        )
        if not bet:
            self.session.clear_pending()
            self._placing_key = None
            return False
        self.session.attach_bet_id(bet.id)
        self._multi_live_pending = {
            "round_id": round_ref.round_id,
            "bet_id": bet.id,
            "allocations": kept,
        }
        self._placed_round_keys.add(round_key)
        self._placing_key = None
        self.session.state.last_bet_summary = (
            f"Đã đặt {len(kept)} tab Live: "
            f"Tay con {side_totals[BetSide.PLAYER]}, "
            f"Nhà cái {side_totals[BetSide.BANKER]}"
        )
        self.store.save_event(
            "multi_live_placed",
            {
                "table": table_name,
                "allocations": kept,
                "player_total": side_totals[BetSide.PLAYER],
                "banker_total": side_totals[BetSide.BANKER],
            },
            round_id=round_ref.round_id,
        )
        return True

    async def _try_place_bet(
        self,
        page: Page,
        history: list[BetSide],
        *,
        table_name: str,
        skip_tie: bool,
        source: str = "",
        bet_timeout_sec: int = 30,
    ) -> bool:
        signal = self._armed_bet.get("signal") if self._armed_bet else None
        if not signal:
            signal = get_active_signal(
                history,
                skip_tie=skip_tie,
                disabled_patterns=self._disabled_patterns,
                pattern_lengths=self._pattern_lengths,
            )
        if not signal or not signal.bet_side:
            return False

        fresh = self._current_history()
        if fresh:
            history = fresh
        armed_at = int(self._armed_bet.get("armed_at_len") or len(history)) if self._armed_bet else len(history)
        if len(history) > armed_at:
            cuoc_bo_qua(
                reason="qua cua cuoc",
                table=table_name,
                source=source,
                pattern=signal.pattern_name,
                tool_len=len(history),
                detail=f"arm #{armed_at}",
            )
            return False

        stake = self.session.current_stake
        stake_index = self.session.current_stake_index
        target_index = len(history)
        bet_meta = {}
        if self._round_meta_provider:
            try:
                bet_meta = self._round_meta_provider(table_name, target_index) or {}
            except Exception as exc:
                logger.debug("round_meta_provider: %s", exc)
        game_shoe = int(bet_meta.get("game_shoe") or 0)
        game_round = int(bet_meta.get("game_round") or 0)
        if not game_shoe or not game_round:
            cuoc_bo_qua(
                reason="chua co gameShoe/gameRound",
                table=table_name,
                source=source,
                pattern=signal.pattern_name,
                tool_len=len(history),
                detail=f"bead #{target_index} shoe={game_shoe} round={game_round}",
            )
            return False

        round_key = (table_name, game_shoe, game_round, target_index, "pattern")
        if round_key in self._placed_round_keys:
            cuoc_bo_qua(
                reason="da dat cuoc van nay",
                table=table_name,
                source=source,
                pattern=signal.pattern_name,
                tool_len=len(history),
                detail=f"shoe={game_shoe} round={game_round}",
            )
            return False
        if self._placing_key or self.session.state.pending:
            cuoc_bo_qua(
                reason="dang dat cuoc hoac cho ket qua",
                table=table_name,
                source=source,
                pattern=signal.pattern_name,
                tool_len=len(history),
            )
            return False

        authority = (
            self._armed_bet.get("live_authority") if self._armed_bet else None
        )
        if authority is not None:
            phase_before = await probe_betting_phase(page)
            ui_healthy = bool(
                phase_before.get("chipsVisible")
                and phase_before.get("zoneVisible")
                and not phase_before.get("closed")
            )
            countdown = None
            cd_text = str(phase_before.get("cdText") or "").strip()
            if cd_text.isdigit():
                countdown = int(cd_text)
            if self._ui_alive_checker:
                try:
                    alive, _reason = await self._ui_alive_checker(page)
                    ui_healthy = ui_healthy and bool(alive)
                except Exception:
                    ui_healthy = False
            license_allowed = True
            if self._license_checker:
                try:
                    license_allowed = bool(self._license_checker())
                except Exception:
                    license_allowed = False
            balance = await read_account_balance(page)
            original_source = str(
                (self._armed_bet or {}).get("source") or ""
            )
            shuffling = False
            if self._shuffle_checker:
                try:
                    shuffling = bool(self._shuffle_checker(table_name))
                except Exception:
                    shuffling = True
            final_risk = RiskManager().evaluate(
                RiskContext(
                    strategy=authority.strategy,
                    money=self.session.money_quote(),
                    auto_bet=self.session.state.auto_bet,
                    license_allowed=license_allowed,
                    daily_profit=self.session.effective_profit,
                    stop_loss=self.session.state.stop_loss,
                    take_profit=self.session.state.take_profit,
                    limit_hit=self.session.state.limit_hit,
                    pending_main=self.session.state.pending is not None,
                    pending_tie=self.tie.has_pending,
                    round_already_placed=round_key in self._placed_round_keys,
                    shuffling=shuffling,
                    source_allowed=(
                        not original_source
                        or original_source in BET_TRIGGER_SOURCES
                    ),
                    ui_healthy=ui_healthy,
                    countdown=countdown,
                    balance=balance,
                    require_balance=True,
                )
            )
            if (
                not final_risk.allowed
                or final_risk.execution_mode != ExecutionMode.REAL
            ):
                cuoc_bo_qua(
                    reason=f"risk final: {final_risk.code.value}",
                    table=table_name,
                    source=source,
                    pattern=signal.pattern_name,
                    tool_len=len(history),
                    detail=final_risk.reason,
                )
                if (
                    final_risk.code.value in ("license_blocked", "ui_unhealthy")
                    and self._runtime_unsafe_handler
                ):
                    self._runtime_unsafe_handler(final_risk.reason)
                return False

        round_ref = self.store.reserve_round(
            table_name,
            target_index,
            game_shoe=game_shoe,
            game_round=game_round,
        )
        round_id = round_ref.round_id

        cuoc_thu(
            table=table_name,
            side=signal.bet_side,
            stake=stake,
            pattern=signal.pattern_name,
            tool_len=target_index,
            game_round=game_round,
            source=source,
        )

        self._placing_key = round_key
        reserved = PendingBet(
            bet_id=0,
            round_id=round_id,
            side=signal.bet_side,
            stake=stake,
            stake_index=stake_index,
            pattern_id=signal.pattern_id,
            pattern_name=signal.pattern_name,
            reason=signal.reason,
            target_round_index=target_index,
            placed_at=datetime.now(),
        )
        if not self.session.try_reserve_pending(reserved):
            self._placing_key = None
            cuoc_bo_qua(
                reason="khong giu duoc slot pending",
                table=table_name,
                source=source,
                pattern=signal.pattern_name,
                tool_len=len(history),
            )
            return False

        self._betting_active += 1
        placed = False
        try:
            placed = await wait_and_place_bet(
                page,
                signal.bet_side,
                stake,
                timeout_sec=bet_timeout_sec,
                click_scope=self._click_scope,
            )
        finally:
            self._betting_active = max(0, self._betting_active - 1)

        phase = await probe_betting_phase(page)
        if placed:
            cuoc_dat(
                table=table_name,
                side=signal.bet_side,
                stake=stake,
                pattern=signal.pattern_name,
                cd=str(phase.get("cdText") or ""),
            )

        if not placed:
            self.session.clear_pending()
            self._placing_key = None
            # Bi day ra sanh trong luc cho cua → bao UI fail de watch loop vao lai ban
            try:
                from src.ae_sexy import is_ae_sexy_lobby

                if await is_ae_sexy_lobby(page) and self._ui_failed_handler:
                    self._ui_failed_handler(
                        {"lobbyKick": True, "streamDead": False},
                        {"lobbyKick": True},
                    )
            except Exception:
                pass
            if not self.is_betting_active:
                try:
                    from src.ae_sexy import probe_game_shell_health, probe_room_stream_health

                    shell = await probe_game_shell_health(page)
                    stream = await probe_room_stream_health(page)
                    if self._ui_failed_handler:
                        self._ui_failed_handler(shell, stream)
                except Exception:
                    pass
            logger.info(
                "Khong dat duoc cuoc — bo qua van nay (mau %s) | cd=%s chips=%s zone=%s",
                signal.pattern_name,
                phase.get("cdText", ""),
                phase.get("chipsVisible"),
                phase.get("zoneVisible"),
            )
            self.store.save_event(
                "bet_skipped",
                {
                    "reason": "betting_closed",
                    "pattern": signal.pattern_name,
                    "side": signal.bet_side.value,
                    "stake": stake,
                    "session_no": round_ref.session_no,
                    "session_date": round_ref.session_date,
                    "phase": {
                        "cd": phase.get("cdText"),
                        "chips": phase.get("chipsVisible"),
                        "zone": phase.get("zoneVisible"),
                        "confirm": phase.get("confirmReady"),
                    },
                },
                round_id=round_id,
            )
            return False

        if self.session.state.current_group_id is None:
            group = self.store.open_bet_group(
                session_date=round_ref.session_date,
                table_name=table_name,
                group_take_profit=self.session.state.group_take_profit,
                group_stop_loss=self.session.state.group_stop_loss,
                stakes=self.session.active_stakes,
            )
            self.session.state.current_group_id = group.id
            self.session.state.current_group_seq = group.seq_no

        bet = self.store.save_bet(
            round_id=round_id,
            table_name=table_name,
            side=signal.bet_side.value,
            stake=stake,
            stake_index=stake_index,
            pattern_id=signal.pattern_id,
            pattern_name=signal.pattern_name,
            reason=signal.reason,
            target_round_index=target_index,
            session_date=round_ref.session_date,
            session_no=round_ref.session_no,
            game_shoe=round_ref.game_shoe,
            game_round=round_ref.game_round,
            status="placed",
            group_id=self.session.state.current_group_id,
        )
        if not bet:
            self.session.clear_pending()
            self._placing_key = None
            logger.warning("save_bet that bai sau khi click chip — huy pending")
            return False

        self.session.attach_bet_id(bet.id)
        self._placed_round_keys.add(round_key)
        self._placing_key = None
        label = SIDE_LABEL.get(signal.bet_side, signal.bet_side.value)
        if stake <= 0:
            self.session.state.last_bet_summary = (
                f"Theo doi {label} (stake 0) — mau {signal.pattern_name}"
            )
            logger.info(
                ">>> AUTO THEO DOI (stake 0): %s | mau %s | %s (bead #%d) — khong dat chip",
                label,
                signal.pattern_name,
                round_ref.display,
                target_index + 1,
            )
        else:
            self.session.state.last_bet_summary = (
                f"Da dat {label} {stake} — mau {signal.pattern_name}"
            )
            logger.info(
                ">>> AUTO CUOC: %s %s | mau %s | %s (bead #%d)",
                label,
                stake,
                signal.pattern_name,
                round_ref.display,
                target_index + 1,
            )
        if self._healthy_handler:
            self._healthy_handler()
        return True

    def on_toggle(self, enabled: bool) -> None:
        self.session.configure(auto_bet=enabled)
        if not enabled:
            self._clear_armed_bet("AutoBettor đã tắt")
            self._stop_bet_open_poll()
        self.store.save_event("auto_bet_toggle", {"enabled": enabled})
        logger.info("Auto cuoc: %s", "BAT" if enabled else "TAT")

    def on_limits_saved(self, stop_loss: float, take_profit: float) -> None:
        self.session.configure(stop_loss=stop_loss, take_profit=take_profit)
        self.store.save_event(
            "limits_updated",
            {"stop_loss": stop_loss, "take_profit": take_profit},
        )
