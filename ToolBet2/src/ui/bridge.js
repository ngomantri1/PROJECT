() => {
  const ROOT_ID = "toolbet-ui-v2";
  const THEME_ID = "toolbet-ui-v2-theme";
  const COMPONENTS_ID = "toolbet-ui-v2-components";
  const POSITION_STORAGE_KEY = "toolbet-ui-v2-position";
  const clone = value => typeof structuredClone === "function"
    ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const money = value => number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 });
  const sideLabel = side => ({ player: "Tay con", banker: "Nhà cái", tie: "Hòa" }[side] || "—");
  const MODE_LABELS = {
    simulation: "MÔ PHỎNG/TEST",
    live: "CHẠY THẬT",
  };
  const scrollTrace = (stage, details = {}) => {
    try {
      console.info("[TBV2_SCROLL_TRACE]", JSON.stringify({
        stage,
        at: new Date().toISOString(),
        ...details,
      }));
    } catch (_) {}
  };

  const savedPosition = () => {
    try {
      const raw = window.localStorage.getItem(POSITION_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return Number.isFinite(parsed?.left) && Number.isFinite(parsed?.top) ? parsed : null;
    } catch (_) { return null; }
  };
  const persistPosition = position => {
    try { window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position)); } catch (_) {}
  };
  const resetPosition = root => {
    root.style.removeProperty("left"); root.style.removeProperty("top");
    root.style.removeProperty("bottom"); root.style.removeProperty("height");
    try { window.localStorage.removeItem(POSITION_STORAGE_KEY); } catch (_) {}
  };
  const moveRoot = (root, left, top) => {
    const rect = root.getBoundingClientRect();
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    const next = {
      left: Math.round(Math.min(maxLeft, Math.max(margin, left))),
      top: Math.round(Math.min(maxTop, Math.max(margin, top))),
    };
    root.style.left = `${next.left}px`; root.style.top = `${next.top}px`;
    root.style.bottom = "auto"; root.style.height = `${Math.round(rect.height)}px`;
    return next;
  };
  const applySavedPosition = root => {
    if (window.innerWidth <= 700) return;
    const position = savedPosition();
    if (position) moveRoot(root, position.left, position.top);
  };
  const bindDrag = (root, header) => {
    if (window.innerWidth <= 700) return;
    header.title = "Kéo để di chuyển bảng điều khiển. Double-click để về vị trí mặc định.";
    header.addEventListener("pointerdown", event => {
      if (event.button !== 0 || event.target.closest("button")) return;
      const rect = root.getBoundingClientRect();
      const drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      header.classList.add("tbv2-dragging");
      header.setPointerCapture?.(event.pointerId);
      const move = nextEvent => {
        const position = moveRoot(root, nextEvent.clientX - drag.x, nextEvent.clientY - drag.y);
        persistPosition(position);
      };
      const stop = () => {
        header.classList.remove("tbv2-dragging");
        header.removeEventListener("pointermove", move);
        header.removeEventListener("pointerup", stop);
        header.removeEventListener("pointercancel", stop);
      };
      header.addEventListener("pointermove", move);
      header.addEventListener("pointerup", stop);
      header.addEventListener("pointercancel", stop);
    });
    header.addEventListener("dblclick", event => {
      if (!event.target.closest("button")) resetPosition(root);
    });
  };

  const ensureStyle = (id, cssText) => {
    let style = document.getElementById(id);
    if (!style) {
      style = document.createElement("style"); style.id = id;
      (document.head || document.documentElement).appendChild(style);
    }
    if (style.textContent !== (cssText || "")) style.textContent = cssText || "";
  };

  const field = (label, control) => {
    const wrap = el("label", "tbv2-field");
    wrap.append(el("span", "tbv2-label", label), control);
    return wrap;
  };
  const input = (id, value, type = "text") => {
    const node = el("input", "tbv2-input"); node.id = id; node.type = type; node.value = value ?? "";
    return node;
  };
  const textarea = (id, value) => {
    const node = el("textarea", "tbv2-input tbv2-stakes-area");
    node.id = id; node.value = value ?? ""; node.rows = 2; node.spellcheck = false;
    return node;
  };
  const bindValueTooltip = node => {
    const sync = () => { node.title = node.value || ""; };
    sync();
    node.addEventListener("input", sync);
    node.addEventListener("change", sync);
    return node;
  };
  const select = (id, options, value) => {
    const node = el("select", "tbv2-input"); node.id = id;
    let selectedValueExists = false;
    (options || []).forEach(item => {
      const option = el("option", "", item.label); option.value = item.id;
      if (item.id === value) {
        option.selected = true;
        selectedValueExists = true;
      }
      node.append(option);
    });
    // Never silently fall back to the first/default option while a catalogue
    // is still loading. Keep the persisted id visible so a premature Save
    // cannot overwrite valid SQLite data with the first option.
    if (value && !selectedValueExists) {
      const pending = el("option", "", `Đang tải: ${value}`);
      pending.value = value;
      pending.selected = true;
      pending.dataset.pendingCatalogue = "true";
      node.prepend(pending);
    } else if (!node.options.length) {
      const pending = el("option", "", "Đang tải danh sách…");
      pending.value = "";
      pending.selected = true;
      pending.disabled = true;
      pending.dataset.pendingCatalogue = "true";
      node.append(pending);
    }
    const syncTooltip = () => {
      node.title = node.options[node.selectedIndex]?.textContent || "";
    };
    syncTooltip();
    node.addEventListener("change", syncTooltip);
    return node;
  };
  const cardTitle = (title, action) => {
    const head = el("div", "tbv2-card-head"); head.append(el("h2", "", title));
    if (action) head.append(action); return head;
  };

  const setBoundText = (root, key, value) => {
    const node = root.querySelector(`[data-bind="${key}"]`);
    if (node && node.textContent !== String(value ?? "")) {
      node.textContent = String(value ?? "");
    }
    return node;
  };

  const historyDotsFor = state => {
    window.__toolbetUiLocal.historyByTable =
      window.__toolbetUiLocal.historyByTable || {};
    const incomingDots = Array.isArray(state.history_dots)
      ? state.history_dots
      : [];
    const tableKey = String(state.table_id || state.table || "").trim();
    const knownTable = tableKey && tableKey !== "—";
    if (incomingDots.length) {
      const cacheKey = knownTable ? tableKey : "__last__";
      window.__toolbetUiLocal.historyByTable[cacheKey] = clone(incomingDots);
      window.__toolbetUiLocal.lastHistoryKey = cacheKey;
      return { dots: incomingDots, cached: false };
    }
    if (knownTable) {
      const cached = window.__toolbetUiLocal.historyByTable[tableKey] || [];
      return { dots: cached, cached: cached.length > 0 };
    }
    if (window.__toolbetUiLocal.lastHistoryKey) {
      const cached = window.__toolbetUiLocal.historyByTable[
        window.__toolbetUiLocal.lastHistoryKey
      ] || [];
      return { dots: cached, cached: cached.length > 0 };
    }
    return { dots: [], cached: false };
  };

  const tableLabelFor = state => {
    window.__toolbetUiLocal = window.__toolbetUiLocal || {};
    const incoming = String(state.table || "").trim();
    if (incoming && incoming !== "—") {
      window.__toolbetUiLocal.lastTableLabel = incoming;
      return incoming;
    }
    return window.__toolbetUiLocal.lastTableLabel || "—";
  };

  const selectedContext = snapshot => {
    const state = snapshot.state || {};
    const tabs = Array.isArray(snapshot.tabs) ? snapshot.tabs : [];
    const selectedId = tabs.some(
      tab => tab.id === window.__toolbetUiLocal.selectedId
    )
      ? window.__toolbetUiLocal.selectedId
      : ((state.strategy_tabs || {}).selected_tab_id
        || (tabs[0] || {}).id
        || "");
    window.__toolbetUiLocal.selectedId = selectedId;
    const selected = tabs.find(tab => tab.id === selectedId) || tabs[0] || {};
    return { state, tabs, selectedId, selected };
  };

  const liveStatusView = state => {
    const blockers = Array.isArray(state.live_blockers) ? state.live_blockers : [];
    const warnings = Array.isArray(state.live_warnings) ? state.live_warnings : [];
    if (!number(state.enabled_live_tabs)) {
      return { kind: "simulation", text: "Chỉ mô phỏng/test · không click chip." };
    }
    if (blockers.length) {
      return { kind: "blocked", text: `Live bị chặn · ${blockers[0].message}` };
    }
    if (warnings.length) {
      return { kind: "warning", text: `Live sẵn sàng · ${warnings.map(item => item.message).join("; ")}` };
    }
    return { kind: "ready", text: `Live sẵn sàng · policy ${state.live_execution_mode || "pilot"}.` };
  };

  const structureSignature = snapshot => {
    const { state, tabs, selectedId, selected } = selectedContext(snapshot);
    const strategyTabs = state.strategy_tabs || {};
    const lifecycle = selected.lifecycle || {};
    return JSON.stringify({
      screen: snapshot.screen || "workspace",
      session: state.runtime_session_id || "",
      selectedId,
      tabs: tabs.map(tab => ({
        id: tab.id,
        name: tab.name,
        enabled: tab.enabled,
        running: !!tab.running,
      })),
      selectedConfig: {
        name: selected.name,
        enabled: selected.enabled,
        strategy_id: selected.strategy_id,
        money_manager_id: selected.money_manager_id,
        stakes: selected.stakes,
        stake_chains: selected.stake_chains,
        stop_loss: selected.stop_loss,
        take_profit: selected.take_profit,
        auto_reset_on_nonnegative_pnl: selected.auto_reset_on_nonnegative_pnl,
        bet_when_remaining_seconds: selected.bet_when_remaining_seconds,
        strategy_input: selected.strategy_input,
      },
      strategies: strategyTabs.strategies || [],
      moneyManagers: strategyTabs.money_managers || [],
      lifecycleMode: lifecycle.mode || selected.mode || "simulation",
      license: state.license || {},
    });
  };

  const setWorkspaceLoading = (root, loading) => {
    const local = window.__toolbetUiLocal;
    const cover = root.querySelector(".tbv2-loading-cover");
    const tabsBar = root.querySelector(".tbv2-tabs");
    const scroll = root.querySelector(".tbv2-scroll");
    if (!cover || !tabsBar || !scroll) return;

    const wasLoading = !!local.workspaceLoading;
    local.workspaceLoading = !!loading;
    root.classList.toggle("tbv2-workspace-loading", !!loading);
    root.dataset.workspaceLoading = String(!!loading);
    tabsBar.inert = !!loading;
    tabsBar.setAttribute("aria-busy", String(!!loading));
    scroll.setAttribute("aria-busy", String(!!loading));
    [...scroll.children].forEach(node => {
      if (node !== cover) node.inert = !!loading;
    });
    cover.hidden = !loading;

    if (!loading) {
      if (local.workspaceLoadingTimer) clearTimeout(local.workspaceLoadingTimer);
      local.workspaceLoadingTimer = null;
      return;
    }
    if (!wasLoading || !local.workspaceLoadingSince) {
      local.workspaceLoadingSince = Date.now();
    }
    const message = cover.querySelector("[data-bind=workspace-loading-message]");
    const elapsed = Date.now() - local.workspaceLoadingSince;
    if (elapsed >= 15000) {
      if (message) message.textContent = "Chưa nhận được dữ liệu bàn. Đang tiếp tục chờ…";
      return;
    }
    if (message) message.textContent = "Đang kết nối bàn và tải dữ liệu…";
    if (local.workspaceLoadingTimer) return;
    local.workspaceLoadingTimer = setTimeout(() => {
      local.workspaceLoadingTimer = null;
      if (!local.workspaceLoading) return;
      const timeoutMessage = document.querySelector(
        `#${ROOT_ID} [data-bind=workspace-loading-message]`
      );
      if (timeoutMessage) {
        timeoutMessage.textContent = "Chưa nhận được dữ liệu bàn. Đang tiếp tục chờ…";
      }
    }, 15000 - elapsed);
  };

  const saveTabs = async (tabs, selectedId, message, quiet = false, clearDraftId = "", renderOnSuccess = true) => {
    if (typeof window.toolbetSaveStrategyTabs !== "function") {
      if (message) message.textContent = "Chưa kết nối bridge lưu mô phỏng.";
      return false;
    }
    try {
      const result = await window.toolbetSaveStrategyTabs({ selected_tab_id: selectedId, tabs });
      if (!result || !result.ok) throw new Error((result && result.error) || "Lưu thất bại");
      const next = result.strategy_tabs || {};
      // A configuration save returns durable tab fields only. Keep the latest
      // runtime ledger on the same tab until the next server snapshot arrives.
      const existingTabs = new Map(
        (window.__toolbetUiSnapshot.tabs || []).map(tab => [tab.id, tab])
      );
      const savedTabs = (next.tabs || tabs).map(tab => ({
        ...(existingTabs.get(tab.id) || {}),
        ...tab,
      }));
      window.__toolbetUiSnapshot.tabs = clone(savedTabs);
      window.__toolbetUiSnapshot.state.strategy_tabs = clone({ ...next, tabs: savedTabs });
      window.__toolbetUiLocal.selectedId = next.selected_tab_id || selectedId;
      if (clearDraftId && window.__toolbetUiLocal.drafts) {
        delete window.__toolbetUiLocal.drafts[clearDraftId];
      }
      if (message && !quiet) message.textContent = "Đã lưu cấu hình mô phỏng vào SQLite.";
      if (renderOnSuccess) {
        render(window.__toolbetUiSnapshot, window.__toolbetUiAssets || {});
      }
      return true;
    } catch (error) {
      if (message) message.textContent = String(error && error.message ? error.message : error);
      return false;
    }
  };

  const lifecycleCommand = async (type, payload, message) => {
    try {
      const result = await window.ToolBetUi.dispatch({
        version: 1,
        command_id: crypto.randomUUID ? crypto.randomUUID().replaceAll("-", "") : `cmd${Date.now()}`,
        type,
        payload: payload || {},
      });
      if (!result || !result.ok) throw new Error((result && result.error) || "Lệnh lifecycle thất bại");
      const data = result.data || {};
      const snapshot = window.__toolbetUiSnapshot;
      const tabs = Array.isArray(snapshot.tabs) ? snapshot.tabs : [];
      snapshot.tabs = tabs.map(tab => {
        const isTarget = tab.id === data.tab_id;
        const running = Object.prototype.hasOwnProperty.call(data, "active_tab_id")
          ? tab.id === data.active_tab_id
          : (isTarget && Object.prototype.hasOwnProperty.call(data, "running")
            ? !!data.running : tab.running);
        return isTarget
          ? {
            ...tab,
            mode: data.mode || tab.mode,
            running,
            status: data.status || tab.status,
            run_profit: Object.prototype.hasOwnProperty.call(data, "run_profit")
              ? data.run_profit : tab.run_profit,
            lifecycle: { ...(tab.lifecycle || {}), ...data },
          }
          : { ...tab, running };
      });
      snapshot.state.strategy_tabs.tabs = clone(snapshot.tabs);
      if (Object.prototype.hasOwnProperty.call(data, "run_enabled")) snapshot.state.run_enabled = !!data.run_enabled;
      if (message) {
        message.classList.remove("error");
        message.textContent = data.running
          ? "Chiến lược đã bắt đầu."
          : "Chiến lược đã dừng.";
      }
      render(snapshot, window.__toolbetUiAssets || {});
      return true;
    } catch (error) {
      if (message) {
        message.classList.add("error");
        message.textContent = String(error && error.message ? error.message : error);
      }
      return false;
    }
  };

  const loadHistoryPage = async (tabId, page, pageSize) => {
    if (typeof window.toolbetLoadStrategyHistory !== "function") return;
    const result = await window.toolbetLoadStrategyHistory({ tab_id: tabId, page, page_size: pageSize });
    if (!result || !result.ok) return;
    const snapshot = window.__toolbetUiSnapshot;
    const data = result.data || {};
    snapshot.tabs = (snapshot.tabs || []).map(tab => tab.id === tabId
      ? { ...tab, bet_history: data.items || [], bet_history_pagination: { page: data.page, page_size: data.page_size, total: data.total, page_count: data.page_count } }
      : tab);
    snapshot.state.strategy_tabs.tabs = clone(snapshot.tabs);
    render(snapshot, window.__toolbetUiAssets || {});
  };

  const readHistoryPageSize = () => {
    try { return Number(localStorage.getItem("toolbet.history_page_size")); }
    catch (_) { return 0; }
  };
  const saveHistoryPageSize = value => {
    try { localStorage.setItem("toolbet.history_page_size", String(value)); }
    catch (_) {}
  };

  const renderRoad = dots => {
    const road = el("div", "tbv2-road");
    const lastIndex = (dots || []).length - 1;
    (dots || []).forEach((item, index) => {
      const dot = el(
        "span",
        `tbv2-dot ${item.side || ""}${index === lastIndex ? " tbv2-dot-latest" : ""}`
      );
      dot.title = item.label || item.side || ""; road.append(dot);
    });
    if (!road.childElementCount) road.append(el("span", "tbv2-empty", "Chưa có kết quả"));
    return road;
  };

  const winLossLabel = outcome => ({
    win: "Thắng", loss: "Thua", push: "Hòa",
  }[outcome] || "Chưa rõ");

  const renderWinLossRoad = outcomes => {
    const road = el("div", "tbv2-win-loss-road");
    const lastIndex = (outcomes || []).length - 1;
    (outcomes || []).forEach((item, index) => {
      const outcome = item.outcome || "unknown";
      const chip = el(
        "span",
        `tbv2-win-loss ${outcome}${index === lastIndex ? " tbv2-win-loss-latest" : ""}`,
        winLossLabel(outcome)
      );
      const resultText = outcome === "win" ? "Lời" : (outcome === "loss" ? "Lỗ" : "Hòa");
      const roundText = item.round == null ? "" : ` · Ván ${item.round}`;
      chip.title = `${winLossLabel(outcome)} · ${sideLabel(item.side)} · Cược ${money(item.stake)} · ${resultText} ${money(item.profit)}${roundText}`;
      road.append(chip);
    });
    if (!road.childElementCount) road.append(el("span", "tbv2-empty", "Chưa có cược đã chốt"));
    return road;
  };

  const betHistoryStatus = row => {
    if (row.outcome === "win") return { label: "Thắng", kind: "win" };
    if (row.outcome === "loss") return { label: "Thua", kind: "loss" };
    if (row.outcome === "push") return { label: "Hòa", kind: "push" };
    return ({
      planned: { label: "Đang chờ", kind: "pending" },
      placing: { label: "Đang đặt", kind: "pending" },
      placed: { label: "Đang chờ", kind: "pending" },
      virtual: { label: "Đang chờ", kind: "pending" },
      uncertain: { label: "Không chắc chắn", kind: "uncertain" },
      quarantined: { label: "Không chắc chắn", kind: "uncertain" },
      deferred: { label: "Bỏ qua", kind: "skipped" },
      cancelled: { label: "Đã hủy", kind: "skipped" },
    }[row.placement_status] || { label: "Chưa rõ", kind: "unknown" });
  };

  const betHistoryTime = value => {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  };

  const betHistoryRound = row => {
    const table = String(row.table_name || "").replace(/^Baccarat\s+/i, "");
    if (table && row.round != null) return `${table}·${row.round}`;
    if (row.round != null) return `Ván ${row.round}`;
    return table || "—";
  };

  const renderBetHistoryRows = (rows, previousRows = null) => {
    const fragment = document.createDocumentFragment();
    (rows || []).forEach(row => {
      const status = betHistoryStatus(row);
      const tr = el("tr", `tbv2-bet-row ${status.kind}`);
      const betId = String(row.bet_id || "");
      const rowSignature = JSON.stringify([
        row.placement_status, row.outcome, row.profit, row.execution_mode,
      ]);
      tr.dataset.betId = betId;
      tr.dataset.betSignature = rowSignature;
      if (previousRows) {
        const previousSignature = previousRows.get(betId);
        if (!previousSignature) tr.classList.add("tbv2-bet-row-new");
        else if (previousSignature !== rowSignature) tr.classList.add("tbv2-bet-row-updated");
      }
      const details = [
        `Mã journal #${row.bet_id || "—"}`,
        row.shoe == null ? "" : `Shoe ${row.shoe}`,
        row.stake_index == null ? "" : `Mức ${Number(row.stake_index) + 1}`,
        row.signal_id ? `Tín hiệu ${row.signal_id}` : "",
        row.reason || "",
      ].filter(Boolean);
      tr.title = details.join(" · ");
      tr.append(el("td", "tbv2-bet-time", betHistoryTime(row.placed_at)));
      tr.append(el("td", "tbv2-bet-round", betHistoryRound(row)));
      tr.append(el("td", `tbv2-bet-side tbv2-result-${row.side || "unknown"}`, sideLabel(row.side)));
      const stake = el("td", "tbv2-bet-stake");
      stake.append(el("strong", "", money(row.stake)));
      stake.append(el("span", `tbv2-bet-mode ${row.execution_mode === "virtual" ? "virtual" : "live"}`, row.execution_mode === "virtual" ? "Mô phỏng" : "Live"));
      tr.append(stake);
      tr.append(el("td", `tbv2-bet-outcome ${status.kind}`, status.label));
      const pnl = el("td", "tbv2-bet-pnl", row.profit == null ? "—" : money(row.profit));
      if (Number(row.profit) < 0) pnl.classList.add("negative");
      tr.append(pnl); fragment.append(tr);
    });
    if (!fragment.childNodes.length) {
      const tr = el("tr"); const td = el("td", "tbv2-empty", "Chưa có cược trong phiên này");
      td.colSpan = 6; tr.append(td); fragment.append(tr);
    }
    return fragment;
  };

  const render = (snapshot, assets) => {
    ensureStyle(THEME_ID, assets && assets.themeCss);
    ensureStyle(COMPONENTS_ID, assets && assets.componentsCss);
    window.__toolbetUiLocal = window.__toolbetUiLocal || { selectedId: "", drafts: {} };
    window.__toolbetUiLocal.drafts = window.__toolbetUiLocal.drafts || {};
    window.__toolbetUiLocal.historyByTable = window.__toolbetUiLocal.historyByTable || {};
    const renderSessionId = String(
      window.__toolbetUiLocal.runtimeSessionId || ""
    );
    const { state, tabs, selectedId, selected } = selectedContext(snapshot);
    const historyView = historyDotsFor(state);
    const displayedDots = historyView.dots;
    const draft = window.__toolbetUiLocal.drafts[selectedId] || null;
    const status = selected.status || {};
    const current = status.current || {};

    let root = document.getElementById(ROOT_ID);
    const firstPanelMount = !root;
    const previousScrollTop = root?.querySelector(".tbv2-scroll")?.scrollTop || 0;
    scrollTrace("render_begin", {
      first_panel_mount: firstPanelMount,
      previous_scroll_top: previousScrollTop,
      revision: snapshot.revision ?? 0,
      runtime_session_id: state.runtime_session_id || "",
    });
    const activeControlId = root?.contains(document.activeElement)
      ? (document.activeElement.id || "")
      : "";
    const activeSelection = activeControlId && "selectionStart" in document.activeElement
      ? [document.activeElement.selectionStart, document.activeElement.selectionEnd]
      : null;
    if (!root) {
      root = el("aside", "tbv2-runtime"); root.id = ROOT_ID;
      root.setAttribute("aria-label", "ToolBet strategy workspace");
      (document.body || document.documentElement).appendChild(root);
      applySavedPosition(root);
    }
    root.replaceChildren();
    const shell = el("div", "tbv2-shell"); root.append(shell);

    const header = el("header", "tbv2-header");
    const brand = el("div", "tbv2-brand"); brand.append(el("strong", "", "Baccarat Sexy Casino (Telegram: @minoauto)"));
    const activeMode = ((selected.lifecycle || {}).mode || selected.mode || "simulation");
    const headerActions = el("div", "tbv2-header-actions");
    const license = state.license || {};
    if (license.status) {
      const licenseBadge = el(
        "span",
        `tbv2-license ${license.allowed ? "ok" : "blocked"}`,
        `${license.plan || "LICENSE"} · ${license.status}`
      );
      licenseBadge.title = [
        license.reason || "",
        license.expires_at ? `Hết lease: ${license.expires_at}` : "",
        license.device_id ? `Thiết bị: ${license.device_id}` : "",
      ].filter(Boolean).join("\n");
      headerActions.append(licenseBadge);
      const logout = el("button", "tbv2-logout", "Thoát Tool");
      logout.type = "button";
      logout.addEventListener("click", async () => {
        if (!window.confirm("Đăng xuất tài khoản Tool và dừng phiên Game?")) return;
        await window.ToolBetUi.dispatch({ type:"tool_logout", payload:{} });
      });
      headerActions.append(logout);
    }
    header.append(brand, headerActions); shell.append(header);
    bindDrag(root, header);

    const tabsBar = el("nav", "tbv2-tabs");
    tabs.forEach(tab => {
      const button = el("button", `tbv2-tab ${tab.id === selectedId ? "active" : ""}${tab.running ? " running" : ""}`);
      button.type = "button"; button.dataset.tabId = tab.id;
      const tabMode = ((tab.lifecycle || {}).mode || tab.mode || "simulation");
      const liveIcon = el(
        "span",
        `tbv2-tab-live${tabMode === "live" ? "" : " is-hidden"}`,
        "●"
      );
      if (tabMode === "live") {
        liveIcon.title = "Chạy thật";
        liveIcon.setAttribute("aria-label", "Chạy thật");
      } else {
        liveIcon.setAttribute("aria-hidden", "true");
      }
      button.append(liveIcon);
      const tabName = el("span", "tbv2-tab-name", tab.name || "Chiến lược");
      tabName.title = "Double-click để đổi tên";
      tabName.addEventListener("dblclick", event => {
        event.preventDefault(); event.stopPropagation();
        const originalName = tab.name || "Chiến lược";
        const editor = el("input", "tbv2-tab-name-edit");
        editor.type = "text"; editor.value = originalName;
        editor.setAttribute("aria-label", "Tên chiến lược");
        let finished = false;
        const finish = async save => {
          if (finished) return;
          finished = true;
          const nextName = editor.value.trim();
          if (!save || !nextName) {
            render(window.__toolbetUiSnapshot, window.__toolbetUiAssets || {});
            return;
          }
          await saveTabs(
            tabs.map(item => item.id === tab.id ? { ...item, name: nextName } : item),
            selectedId,
            null,
            true,
            "",
            true
          );
        };
        editor.addEventListener("click", innerEvent => innerEvent.stopPropagation());
        editor.addEventListener("dblclick", innerEvent => innerEvent.stopPropagation());
        editor.addEventListener("keydown", keyEvent => {
          if (keyEvent.key === "Enter") { keyEvent.preventDefault(); finish(true); }
          if (keyEvent.key === "Escape") { keyEvent.preventDefault(); finish(false); }
        });
        editor.addEventListener("blur", () => finish(true));
        tabName.replaceWith(editor);
        editor.focus(); editor.select();
      });
      button.append(tabName);
      const close = el("span", "tbv2-tab-close", "×");
      close.title = tabs.length <= 1 ? "Cần giữ ít nhất một chiến lược" : "Đóng tab";
      close.setAttribute("aria-label", "Đóng tab");
      close.setAttribute("role", "button");
      close.tabIndex = 0;
      close.classList.toggle("disabled", tabs.length <= 1);
      const closeTab = event => {
        event.preventDefault(); event.stopPropagation();
        if (tabs.length <= 1) return;
        const remaining = tabs.filter(item => item.id !== tab.id);
        saveTabs(remaining, (remaining[0] || {}).id || "", null, false, tab.id);
      };
      close.addEventListener("click", closeTab);
      close.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") closeTab(event);
      });
      button.append(close);
      button.addEventListener("click", () => {
        if (window.__toolbetUiLocal.selectedId === tab.id) return;
        window.__toolbetUiLocal.selectedId = tab.id;
        // Tab selection is local workspace navigation, not configuration.
        // Persisting the full tabs array here races with form auto-save and
        // can restore an older selected tab (or older tab list) over a click.
        // The active selection remains stable through runtime snapshots via
        // selectedContext() while the tab is still present.
        const workspace = window.__toolbetUiSnapshot.state.strategy_tabs || {};
        workspace.selected_tab_id = tab.id;
        window.__toolbetUiSnapshot.state.strategy_tabs = workspace;
        render(window.__toolbetUiSnapshot, window.__toolbetUiAssets || {});
      });
      tabsBar.append(button);
    });
    const add = el("button", "tbv2-tab-add", "+"); add.type = "button"; add.title = "Thêm chiến lược";
    add.disabled = tabs.length >= 5;
    add.addEventListener("click", () => {
      const id = (crypto.randomUUID ? crypto.randomUUID() : `tab-${Date.now()}`).replaceAll("-", "");
      const next = { id, name: `Chiến lược ${tabs.length + 1}`, enabled: true, strategy_id: "follow_last", strategy_input: "", stakes: [0,100,110,120,130], progression_mode: "loss_up_win_reset", money_manager_id: "IncreaseWhenLose", stake_chains: [], stop_loss: 0, take_profit: 0, auto_reset_on_nonnegative_pnl: false, bet_when_remaining_seconds: 10, mode: "live" };
      saveTabs([...tabs, next], id, null, true);
    });
    tabsBar.append(add); shell.append(tabsBar);

    const scroll = el("div", "tbv2-scroll"); shell.append(scroll);
    const isSimulationOnly = (draft?.mode ?? activeMode) !== "live";
    const configCard = el("section", "tbv2-card tbv2-config-card");
    const executionBadge = el(
      "span",
      `tbv2-safe tbv2-execution-badge ${isSimulationOnly ? "simulation" : "live"}`,
      isSimulationOnly ? "Không click chip" : "LIVE"
    );
    executionBadge.title = isSimulationOnly
      ? "Mô phỏng: không click chip"
      : "Live: có thể click chip";
    configCard.append(cardTitle(
      "Chiến lược & Chuỗi tiền",
      executionBadge
    ));
    const grid = el("div", "tbv2-form-grid");
    const selectedManagerId = draft?.money_manager_id ?? selected.money_manager_id ?? "IncreaseWhenLose";
    const stakeChainsText = (selected.stake_chains || [selected.stakes || []])
      .map(chain => chain.join("-"))
      .join("\n");
    const stakesText = draft?.stakes_text ?? (
      selectedManagerId === "MultiChain" ? stakeChainsText : (selected.stakes || []).join("-")
    );
    grid.append(
      field("Chiến lược", select("tbv2-strategy", (state.strategy_tabs || {}).strategies || [], draft?.strategy_id ?? selected.strategy_id)),
      field("Quản lý vốn", select("tbv2-progression",
        (state.strategy_tabs || {}).money_managers || [],
        draft?.money_manager_id ?? selected.money_manager_id ?? "IncreaseWhenLose")),
      field("Chuỗi tiền", input("tbv2-stakes",
        draft?.stakes_text ?? ((selected.money_manager_id === "MultiChain"
          ? (selected.stake_chains || [selected.stakes || []]).map(chain => chain.join("-")).join("; ")
          : (selected.stakes || []).join("-"))))),
      field("Đặt khi còn (giây)", input(
        "tbv2-bet-when-remaining",
        draft?.bet_when_remaining_seconds ?? selected.bet_when_remaining_seconds ?? 10,
        "number"
      )),
      field("Cắt lãi", input("tbv2-tp", draft?.take_profit ?? selected.take_profit ?? 0, "number")),
      field("Cắt lỗ", input("tbv2-sl", draft?.stop_loss ?? selected.stop_loss ?? 0, "number"))
    );
    const betWhenRemainingInput = grid.querySelector("#tbv2-bet-when-remaining");
    betWhenRemainingInput.closest(".tbv2-field").classList.add("tbv2-field-wide");
    betWhenRemainingInput.min = "3";
    betWhenRemainingInput.step = "1";
    betWhenRemainingInput.title = "Chỉ đặt khi đồng hồ còn từ 3 giây đến số giây này.";
    const activeStrategyId = draft?.strategy_id ?? selected.strategy_id;
    const strategyInputLabels = {
      sequence_follow: "Chuỗi B/P (ví dụ B-P-P)",
      pattern_follow: "Thế B/P (ví dụ BPP-BBP; PP-P)",
    };
    if (strategyInputLabels[activeStrategyId]) {
      grid.append(field(
        strategyInputLabels[activeStrategyId],
        input("tbv2-strategy-input", draft?.strategy_input ?? selected.strategy_input ?? "")
      ));
    }
    configCard.append(grid);
    let stakesInput = grid.querySelector("#tbv2-stakes");
    const stakesField = stakesInput.closest(".tbv2-field");
    stakesField.classList.add("tbv2-field-wide");
    const initialStakesLabel = stakesField.querySelector(".tbv2-label");
    const replacement = textarea(
      "tbv2-stakes",
      selectedManagerId === "MultiChain" ? stakesText : stakesInput.value,
    );
    stakesInput.replaceWith(replacement);
    stakesInput = replacement;
    if (selectedManagerId === "MultiChain") {
      stakesInput.placeholder = "10-20-40\n50-100-200";
      initialStakesLabel.textContent = "Chu\u1ed7i ti\u1ec1n (m\u1ed7i d\u00f2ng m\u1ed9t chu\u1ed7i)";
    }
    bindValueTooltip(stakesInput);
    const controls = el("div", "tbv2-controls");
    const simulationOnly = el("label", "tbv2-check");
    const simulationCheckbox = input("tbv2-simulation-only", "", "checkbox");
    simulationCheckbox.checked = isSimulationOnly;
    simulationOnly.append(
      simulationCheckbox,
      el("span", "", "Mô phỏng")
    );
    const resetOnRecovery = el("label", "tbv2-check");
    const resetCheckbox = input("tbv2-reset-on-recovery", "", "checkbox");
    resetCheckbox.checked = draft?.auto_reset_on_nonnegative_pnl
      ?? !!selected.auto_reset_on_nonnegative_pnl;
    resetOnRecovery.append(resetCheckbox, el("span", "", "Tiền thắng >= 0 tự động quay về mức cược đầu"));
    controls.append(resetOnRecovery); configCard.append(controls);
    const lifecycleActions = el("div", "tbv2-lifecycle-actions tbv2-run-actions");
    const runEnabled = Object.prototype.hasOwnProperty.call(selected, "running")
      ? !!selected.running
      : !!state.run_enabled;
    const toggle = el(
      "button",
      runEnabled ? "tbv2-danger" : "tbv2-primary",
      runEnabled ? "Dừng chạy thật" : "Bắt đầu chạy thật"
    );
    toggle.type = "button";
    toggle.id = "tbv2-run-toggle";
    const realRunLabel = toggle.textContent;
    toggle.textContent = runEnabled ? "Dừng chạy" : "Bắt đầu chạy";
    toggle.setAttribute("aria-label", realRunLabel);
    toggle.dataset.runEnabled = String(runEnabled);
    toggle.disabled = false;
    const lifecycleFeedback = el("span", "tbv2-lifecycle-feedback");
    lifecycleFeedback.dataset.bind = "lifecycle-message";
    lifecycleFeedback.textContent = runEnabled
      ? (state.click_in_progress
        ? "Đang xử lý cược trước; cấu hình mới áp dụng từ lượt kế tiếp."
        : `Chiến lược này đang chạy. ${(snapshot.tabs || []).filter(tab => ((tab.lifecycle || {}).mode || tab.mode) === "live").length} tab ở chế độ live; tab mô phỏng không click chip.`)
      : "Chiến lược này đang dừng.";
    toggle.addEventListener("click", () => lifecycleCommand(
      "set_run_state",
      { tab_id: selected.id, running: !runEnabled },
      lifecycleFeedback
    ));
    lifecycleActions.append(toggle, simulationOnly, lifecycleFeedback);
    configCard.append(lifecycleActions);
    const managerSelect = configCard.querySelector("#tbv2-progression");
    stakesInput = configCard.querySelector("#tbv2-stakes");
    managerSelect.addEventListener("change", () => {
      const managerId = managerSelect.value;
      const isMultiChain = managerId === "MultiChain";
      if (isMultiChain !== (stakesInput.tagName === "TEXTAREA")) {
        const replacement = isMultiChain
          ? textarea("tbv2-stakes", "")
          : input("tbv2-stakes", "");
        stakesInput.replaceWith(replacement);
        stakesInput = replacement;
        bindValueTooltip(stakesInput);
        stakesInput.addEventListener("input", rememberDraft);
        stakesInput.addEventListener("change", rememberDraft);
        stakesInput.closest(".tbv2-field").querySelector(".tbv2-label").textContent = isMultiChain
          ? "Chu\u1ed7i ti\u1ec1n (m\u1ed7i d\u00f2ng m\u1ed9t chu\u1ed7i)"
          : "Chu\u1ed7i ti\u1ec1n";
      }
      const savedConfig = (selected.money_configs || {})[managerId];
      const savedStakes = (savedConfig && savedConfig.stakes) || selected.stakes || [];
      const savedChains = (savedConfig && savedConfig.stake_chains) || [];
      stakesInput.value = isMultiChain
        ? (savedChains.length ? savedChains : [savedStakes]).map(chain => chain.join("-")).join("\n")
        : savedStakes.join("-");
      stakesInput.placeholder = isMultiChain
        ? "10-20-40\n50-100-200"
        : "10-20-40-80";
      stakesInput.title = stakesInput.value || "";
    });
    const autoSave = window.__toolbetUiLocal.autoSave || { timer: null, version: 0 };
    window.__toolbetUiLocal.autoSave = autoSave;
    const saveCurrentDraft = async (version) => {
      if (version !== autoSave.version) return;
      const currentDraft = window.__toolbetUiLocal.drafts[selected.id];
      if (!currentDraft) return;
      const chains = currentDraft.stakes_text.split(/[;\r\n]+/).map(part =>
        part.split(/[,\-\s]+/).map(Number).filter(v => Number.isFinite(v) && v >= 0)
      ).filter(chain => chain.length);
      if (!chains.length) {
        return;
      }
      const managerId = currentDraft.money_manager_id;
      const changed = {
        ...selected,
        name: selected.name,
        strategy_id: currentDraft.strategy_id,
        strategy_input: currentDraft.strategy_input,
        money_manager_id: managerId,
        stakes: chains[0].slice(),
        stake_chains: managerId === "MultiChain" ? chains : [],
        take_profit: number(currentDraft.take_profit),
        stop_loss: number(currentDraft.stop_loss),
        auto_reset_on_nonnegative_pnl: currentDraft.auto_reset_on_nonnegative_pnl,
        bet_when_remaining_seconds: number(currentDraft.bet_when_remaining_seconds),
        enabled: true,
        mode: currentDraft.mode,
      };
      delete changed.status; delete changed.history;
      const saved = await saveTabs(
        tabs.map(tab => tab.id === selected.id ? changed : tab),
        selected.id,
        null,
        true,
        "",
        false
      );
      if (!saved || version !== autoSave.version) return;
      delete window.__toolbetUiLocal.drafts[selected.id];
      render(window.__toolbetUiSnapshot, window.__toolbetUiAssets || {});
    };
    const scheduleAutoSave = () => {
      autoSave.version += 1;
      if (autoSave.timer) window.clearTimeout(autoSave.timer);
      const version = autoSave.version;
      autoSave.timer = window.setTimeout(() => {
        autoSave.timer = null;
        saveCurrentDraft(version);
      }, 500);
    };
    const rememberDraft = () => {
      if (
        renderSessionId
        && renderSessionId !== String(
          window.__toolbetUiLocal.runtimeSessionId || ""
        )
      ) {
        return;
      }
      window.__toolbetUiLocal.drafts[selected.id] = {
        strategy_id: root.querySelector("#tbv2-strategy").value,
        strategy_input: root.querySelector("#tbv2-strategy-input")?.value ?? (selected.strategy_input ?? ""),
        money_manager_id: managerSelect.value,
        stakes_text: stakesInput.value,
        take_profit: root.querySelector("#tbv2-tp").value,
        stop_loss: root.querySelector("#tbv2-sl").value,
        bet_when_remaining_seconds: root.querySelector("#tbv2-bet-when-remaining").value,
        enabled: true,
        auto_reset_on_nonnegative_pnl: resetCheckbox.checked,
        mode: simulationCheckbox.checked ? "simulation" : "live",
      };
      scheduleAutoSave();
    };
    configCard.querySelectorAll("input, textarea, select").forEach(control => {
      if (control === simulationCheckbox) return;
      control.addEventListener("input", rememberDraft);
      control.addEventListener("change", rememberDraft);
    });
    simulationCheckbox.addEventListener("change", () => {
      const simulation = simulationCheckbox.checked;
      executionBadge.classList.toggle("simulation", simulation);
      executionBadge.classList.toggle("live", !simulation);
      executionBadge.textContent = simulation ? "Không click chip" : "LIVE";
      executionBadge.title = simulation
        ? "Mô phỏng: không click chip"
        : "Live: có thể click chip";
      rememberDraft();
      if (autoSave.timer) window.clearTimeout(autoSave.timer);
      autoSave.timer = null;
      saveCurrentDraft(autoSave.version);
    });
    scroll.append(configCard);

    // Tiền thắng belongs to the current operator run.  It is independent
    // from status.pnl, which is a historical strategy replay.
    const tabProfit = Number(selected.run_profit || 0);
    const lastResultSide = displayedDots.at(-1)?.side;
    const statusCard = el("section", "tbv2-card"); statusCard.append(cardTitle("Trạng thái"));
    const statusGrid = el("div", "tbv2-status-grid");
    [["Bàn", tableLabelFor(state), "status-table"], ["Kết quả gần nhất", sideLabel(lastResultSide), "status-last-result"],
     ["Cửa đề xuất", sideLabel(current.side), "status-side"], ["Tiền cược", money(current.stake), "status-stake"],
     ["Mức tiền", `${current.level || 1}/${current.total_levels || 1}`, "status-level"], ["Tiền thắng", money(tabProfit), "status-profit"]]
      .forEach(([label, value, key]) => {
        const item = el("div", "tbv2-status-item");
        const strong = el("strong", "", value); strong.dataset.bind = key;
        if (key === "status-last-result") strong.classList.add(`tbv2-result-${lastResultSide || "unknown"}`);
        if (key === "status-side") strong.classList.add(`tbv2-result-${current.side || "unknown"}`);
        if (key === "status-profit") strong.classList.toggle("negative", tabProfit < 0);
        item.append(el("span", "", label), strong); statusGrid.append(item);
      });
    statusCard.append(statusGrid); scroll.append(statusCard);

    const winLossCard = el("section", "tbv2-card");
    const winLossRoad = renderWinLossRoad(selected.win_loss_history || []);
    winLossRoad.dataset.bind = "win-loss-history";
    winLossCard.append(cardTitle("Chuỗi thắng thua"), winLossRoad);
    scroll.append(winLossCard);

    const resetStatistics = el("button", "tbv2-stats-reset", "↻");
    resetStatistics.type = "button";
    resetStatistics.title = "Reset thống kê";
    resetStatistics.setAttribute("aria-label", "Reset thống kê");
    resetStatistics.addEventListener("click", () => lifecycleCommand(
      "reset_tab_statistics", { tab_id: selected.id }, null
    ));
    const statsCard = el("section", "tbv2-card"); statsCard.append(cardTitle("Thống kê", resetStatistics));
    const stats = el("div", "tbv2-stat-grid");
    [["Thắng/Thua/Hòa", `${status.wins ?? 0}/${status.losses ?? 0}/${status.pushes ?? 0}`, "stats-results"], ["Thắng/Thua liên tiếp", `${status.max_win_streak ?? 0}/${status.max_loss_streak ?? 0}`, "stats-streaks"], ["Tổng cược hợp lệ", status.valid_bets ?? 0, "stats-valid-bets"], ["Tín hiệu", status.signals, "stats-signals"], ["Cược ảo", status.virtual_bets, "stats-virtual-bets"], ["Tiền thắng", money(status.statistics_profit ?? 0), "stats-pnl"]]
      .forEach(([label, value, key]) => {
        const item = el("div", "tbv2-stat");
        const strong = el("strong", number(value) < 0 ? "negative" : "", value ?? 0);
        strong.dataset.bind = key;
        item.append(el("span", "", label), strong); stats.append(item);
      });
    statsCard.append(stats);

    const roadStatus = el(
      "span",
      "tbv2-safe",
      historyView.cached ? "Dữ liệu gần nhất" : ""
    );
    roadStatus.dataset.bind = "road-cache-status";
    roadStatus.hidden = !historyView.cached;
    const roadCard = el("section", "tbv2-card");
    roadCard.append(cardTitle("Lịch sử bàn", roadStatus), renderRoad(displayedDots));
    scroll.append(roadCard, statsCard);
    const historyCard = el("section", "tbv2-card"); historyCard.append(cardTitle("Lịch sử cược"));
    const table = el("table", "tbv2-history-table");
    const thead = el("thead"); const trh = el("tr"); ["Giờ", "Ván", "Cửa", "Cược", "Kết quả", "P&L"].forEach(value => trh.append(el("th", "", value))); thead.append(trh); table.append(thead);
    const tbody = el("tbody"); tbody.dataset.bind = "bet-history-body";
    tbody.append(renderBetHistoryRows(selected.bet_history || []));
    table.append(tbody); historyCard.append(table);
    const pagination = selected.bet_history_pagination || { page: 1, page_size: 10, total: (selected.bet_history || []).length, page_count: 1 };
    const storedPageSize = readHistoryPageSize();
    const preferredPageSize = [10, 20, 50].includes(storedPageSize)
      ? storedPageSize
      : (pagination.page_size || 10);
    const pager = el("div", "tbv2-controls tbv2-history-pager");
    pager.dataset.bind = "bet-history-pager";
    const pageSize = select("tbv2-history-page-size", [10, 20, 50].map(value => ({ id: String(value), label: `${value}/trang` })), String(preferredPageSize));
    const previous = el("button", "tbv2-secondary", "‹"); previous.type = "button"; previous.disabled = pagination.page <= 1;
    const pageLabel = el("span", "tbv2-message", `Trang ${pagination.page}/${pagination.page_count} · ${pagination.total} cược`);
    const next = el("button", "tbv2-secondary", "›"); next.type = "button"; next.disabled = pagination.page >= pagination.page_count;
    previous.dataset.bind = "bet-history-prev";
    previous.dataset.page = String(pagination.page);
    pageLabel.dataset.bind = "bet-history-page-label";
    next.dataset.bind = "bet-history-next";
    next.dataset.page = String(pagination.page);
    const newer = el("button", "tbv2-history-newer", "Có cược mới · Xem mới");
    newer.type = "button";
    newer.hidden = true;
    newer.dataset.bind = "bet-history-newer";
    const requestPage = page => loadHistoryPage(selected.id, page, Number(pageSize.value));
    pageSize.addEventListener("change", () => { saveHistoryPageSize(pageSize.value); requestPage(1); });
    previous.addEventListener("click", () => requestPage(Number(previous.dataset.page || 1) - 1));
    next.addEventListener("click", () => requestPage(Number(next.dataset.page || 1) + 1));
    newer.addEventListener("click", () => requestPage(1));
    pager.append(previous, pageLabel, next, pageSize); historyCard.append(pager, newer); scroll.append(historyCard);
    window.__toolbetUiLocal.betHistoryPage = pagination.page;
    window.__toolbetUiLocal.betHistoryTotal = pagination.total;
    window.__toolbetUiLocal.betHistoryHasNewer = false;
    if (preferredPageSize !== pagination.page_size) {
      queueMicrotask(() => loadHistoryPage(selected.id, 1, preferredPageSize));
    }
    scroll.addEventListener("scroll", () => {
      scrollTrace("scroll_event", {
        scroll_top: scroll.scrollTop,
        revision: snapshot.revision ?? 0,
        runtime_session_id: state.runtime_session_id || "",
      });
    }, { passive: true });
    const loadingCover = el("div", "tbv2-loading-cover");
    loadingCover.setAttribute("role", "status");
    loadingCover.setAttribute("aria-live", "polite");
    loadingCover.append(
      el("span", "tbv2-loading-spinner"),
      el("strong", "", "Đang tải bảng điều khiển"),
      el("span", "tbv2-loading-message", "Đang kết nối bàn và tải dữ liệu…"),
      (() => {
        const skeleton = el("span", "tbv2-loading-skeleton");
        skeleton.append(el("i"), el("i"), el("i"));
        return skeleton;
      })()
    );
    loadingCover.querySelector(".tbv2-loading-message")
      .setAttribute("data-bind", "workspace-loading-message");
    scroll.append(loadingCover);
    setWorkspaceLoading(root, !!state.workspace_loading);
    scroll.scrollTop = firstPanelMount ? 0 : previousScrollTop;
    scrollTrace("scroll_assigned", {
      scroll_top: scroll.scrollTop,
      first_panel_mount: firstPanelMount,
      revision: snapshot.revision ?? 0,
    });
    if (firstPanelMount) {
      requestAnimationFrame(() => {
        scroll.scrollTop = 0;
        scrollTrace("first_mount_animation_frame", {
          scroll_top: scroll.scrollTop,
          revision: snapshot.revision ?? 0,
        });
      });
    }
    if (activeControlId) {
      const nextActive = root.querySelector(`#${CSS.escape(activeControlId)}`);
      if (nextActive) {
        nextActive.focus({ preventScroll: true });
        if (activeSelection && typeof nextActive.setSelectionRange === "function") {
          try { nextActive.setSelectionRange(activeSelection[0], activeSelection[1]); } catch (_) {}
        }
      }
    }
    window.__toolbetUiLocal.structureSignature = structureSignature(snapshot);
    window.__toolbetUiLocal.roadSignature = JSON.stringify({
      cached: historyView.cached,
      dots: displayedDots,
    });
    window.__toolbetUiLocal.winLossHistorySignature = JSON.stringify(
      selected.win_loss_history || []
    );
    window.__toolbetUiLocal.betHistorySignature = JSON.stringify(
      selected.bet_history || []
    );
    return true;
  };

  const patchRuntimeRegions = snapshot => {
    const root = document.getElementById(ROOT_ID);
    if (!root) return false;
    if (
      window.__toolbetUiLocal.structureSignature
      !== structureSignature(snapshot)
    ) {
      return false;
    }

    const { state, selected } = selectedContext(snapshot);
    const historyView = historyDotsFor(state);
    const displayedDots = historyView.dots;
    const status = selected.status || {};
    const current = status.current || {};
    const risk = current.risk || {};
    setWorkspaceLoading(root, !!state.workspace_loading);

    const liveTabs = (snapshot.tabs || []).filter(tab => (
      (tab.lifecycle || {}).mode || tab.mode
    ) === "live").length;
    const runEnabled = Object.prototype.hasOwnProperty.call(selected, "running")
      ? !!selected.running
      : !!state.run_enabled;
    const runToggle = root.querySelector("#tbv2-run-toggle");
    if (runToggle && runToggle.dataset.runEnabled !== String(runEnabled)) {
      const nextToggle = runToggle.cloneNode(false);
      const realRunLabel = runEnabled ? "Dừng chạy thật" : "Bắt đầu chạy thật";
      nextToggle.className = runEnabled ? "tbv2-danger" : "tbv2-primary";
      nextToggle.textContent = runEnabled ? "Dừng chạy" : "Bắt đầu chạy";
      nextToggle.setAttribute("aria-label", realRunLabel);
      nextToggle.dataset.runEnabled = String(runEnabled);
      nextToggle.addEventListener("click", () => lifecycleCommand(
        "set_run_state",
        { tab_id: selected.id, running: !runEnabled },
        root.querySelector('[data-bind="lifecycle-message"]')
      ));
      runToggle.replaceWith(nextToggle);
    }
    setBoundText(
      root,
      "lifecycle-message",
      runEnabled
        ? (state.click_in_progress
          ? "Đang xử lý cược trước; cấu hình mới áp dụng từ lượt kế tiếp."
          : `Chiến lược này đang chạy. ${liveTabs} tab ở chế độ live; tab mô phỏng không click chip.`)
        : "Chiến lược này đang dừng."
    );
    const liveView = liveStatusView(state);
    const liveStatus = setBoundText(
      root,
      "live-execution-status",
      liveView.text
    );
    if (liveStatus) {
      liveStatus.className = `tbv2-live-status ${liveView.kind}`;
    }

    setBoundText(root, "status-table", tableLabelFor(state));
    const lastResultSide = displayedDots.at(-1)?.side || "unknown";
    const lastResult = setBoundText(
      root,
      "status-last-result",
      sideLabel(lastResultSide)
    );
    if (lastResult) {
      lastResult.classList.remove("tbv2-result-player", "tbv2-result-banker", "tbv2-result-tie", "tbv2-result-unknown");
      lastResult.classList.add(`tbv2-result-${lastResultSide}`);
    }
    const suggestedSide = current.side || "unknown";
    const side = setBoundText(root, "status-side", sideLabel(suggestedSide));
    if (side) {
      side.classList.remove("tbv2-result-player", "tbv2-result-banker", "tbv2-result-tie", "tbv2-result-unknown");
      side.classList.add(`tbv2-result-${suggestedSide}`);
    }
    setBoundText(root, "status-stake", money(current.stake));
    setBoundText(
      root,
      "status-level",
      `${current.level || 1}/${current.total_levels || 1}`
    );
    const tabProfit = Number(selected.run_profit || 0);
    const profit = setBoundText(root, "status-profit", money(tabProfit));
    if (profit) profit.classList.toggle("negative", tabProfit < 0);

    const statValues = {
      "stats-results": `${status.wins ?? 0}/${status.losses ?? 0}/${status.pushes ?? 0}`,
      "stats-streaks": `${status.max_win_streak ?? 0}/${status.max_loss_streak ?? 0}`,
      "stats-valid-bets": status.valid_bets ?? ((status.wins ?? 0) + (status.losses ?? 0)),
      "stats-signals": status.signals ?? 0,
      "stats-virtual-bets": status.virtual_bets ?? 0,
      "stats-pnl": money(status.statistics_profit ?? 0),
    };
    Object.entries(statValues).forEach(([key, value]) => {
      const node = setBoundText(root, key, value);
      if (node) node.classList.toggle("negative", number(value) < 0);
    });

    const roadSignature = JSON.stringify({
      cached: historyView.cached,
      dots: displayedDots,
    });
    if (roadSignature !== window.__toolbetUiLocal.roadSignature) {
      const road = root.querySelector(".tbv2-road");
      if (road) {
        const replacement = renderRoad(displayedDots);
        road.replaceChildren(...replacement.childNodes);
      }
      window.__toolbetUiLocal.roadSignature = roadSignature;
    }
    const winLossHistorySignature = JSON.stringify(selected.win_loss_history || []);
    if (winLossHistorySignature !== window.__toolbetUiLocal.winLossHistorySignature) {
      const road = root.querySelector('[data-bind="win-loss-history"]');
      if (road) {
        const replacement = renderWinLossRoad(selected.win_loss_history || []);
        road.replaceChildren(...replacement.childNodes);
      }
      window.__toolbetUiLocal.winLossHistorySignature = winLossHistorySignature;
    }
    const roadCacheStatus = setBoundText(
      root,
      "road-cache-status",
      historyView.cached ? "Dữ liệu gần nhất" : ""
    );
    if (roadCacheStatus) roadCacheStatus.hidden = !historyView.cached;

    const pagination = selected.bet_history_pagination || {
      page: 1,
      page_size: 10,
      total: (selected.bet_history || []).length,
      page_count: 1,
    };
    const displayedPage = Number(window.__toolbetUiLocal.betHistoryPage || pagination.page || 1);
    const displayedTotal = Number(window.__toolbetUiLocal.betHistoryTotal || 0);
    const hasNewerHistory = displayedPage > 1 && (
      Number(pagination.total || 0) > displayedTotal
      || !!window.__toolbetUiLocal.betHistoryHasNewer
    );
    if (hasNewerHistory) window.__toolbetUiLocal.betHistoryHasNewer = true;
    const pagerPage = hasNewerHistory ? displayedPage : pagination.page;
    const pageLabel = root.querySelector('[data-bind="bet-history-page-label"]');
    if (pageLabel) pageLabel.textContent = `Trang ${pagerPage}/${pagination.page_count} · ${pagination.total} cược`;
    const previous = root.querySelector('[data-bind="bet-history-prev"]');
    if (previous) {
      previous.disabled = pagerPage <= 1;
      previous.dataset.page = String(pagerPage);
    }
    const next = root.querySelector('[data-bind="bet-history-next"]');
    if (next) {
      next.disabled = pagerPage >= pagination.page_count;
      next.dataset.page = String(pagerPage);
    }
    const newer = root.querySelector('[data-bind="bet-history-newer"]');
    if (newer) newer.hidden = !hasNewerHistory;

    const betHistorySignature = JSON.stringify(selected.bet_history || []);
    const tbody = root.querySelector('[data-bind="bet-history-body"]');
    if (
      tbody
      && !hasNewerHistory
      && betHistorySignature !== window.__toolbetUiLocal.betHistorySignature
    ) {
      const previousRows = new Map(
        Array.from(tbody.querySelectorAll("tr[data-bet-id]")).map(node => [
          node.dataset.betId,
          node.dataset.betSignature || "",
        ])
      );
      tbody.replaceChildren(renderBetHistoryRows(selected.bet_history || [], previousRows));
      window.__toolbetUiLocal.betHistorySignature = betHistorySignature;
      window.__toolbetUiLocal.betHistoryPage = pagination.page;
    }
    window.__toolbetUiLocal.betHistoryTotal = pagination.total;
    return true;
  };

  const beginRuntimeSession = snapshot => {
    window.__toolbetUiLocal = window.__toolbetUiLocal || {
      selectedId: "",
      drafts: {},
    };
    const nextSessionId = String(snapshot?.state?.runtime_session_id || "");
    const previousSessionId = String(
      window.__toolbetUiLocal.runtimeSessionId || ""
    );
    if (nextSessionId && previousSessionId && nextSessionId !== previousSessionId) {
      window.__toolbetUiLocal.selectedId = "";
      window.__toolbetUiLocal.drafts = {};
      window.__toolbetUiLocal.historyByTable = {};
      window.__toolbetUiLocal.lastHistoryKey = "";
      window.__toolbetUiLocal.lastTableLabel = "";
    }
    if (nextSessionId) {
      window.__toolbetUiLocal.runtimeSessionId = nextSessionId;
    }
    return !!(
      nextSessionId
      && previousSessionId
      && nextSessionId !== previousSessionId
    );
  };

  window.ToolBetUi = {
    install(snapshot, assets) {
      beginRuntimeSession(snapshot);
      window.__toolbetUiSnapshot = clone(snapshot || {});
      window.__toolbetUiAssets = clone(assets || {});
      return render(
        window.__toolbetUiSnapshot,
        window.__toolbetUiAssets
      );
    },
    update(snapshot, assets) {
      const incoming = snapshot || {};
      const current = window.__toolbetUiSnapshot || {};
      const currentSession = String(
        current.state?.runtime_session_id || ""
      );
      const incomingSession = String(
        incoming.state?.runtime_session_id || ""
      );
      const sameSession = currentSession === incomingSession;
      if (
        sameSession
        && number(incoming.revision) < number(current.revision)
      ) {
        return true;
      }
      beginRuntimeSession(incoming);
      window.__toolbetUiSnapshot = clone(incoming);
      if (assets) window.__toolbetUiAssets = clone(assets);
      if (patchRuntimeRegions(window.__toolbetUiSnapshot)) return true;
      return render(
        window.__toolbetUiSnapshot,
        window.__toolbetUiAssets || {}
      );
    },
    present() { return !!document.getElementById(ROOT_ID); },
    snapshot() { return clone(window.__toolbetUiSnapshot || {}); },
    async dispatch(command) { return typeof window.toolbetUiCommand === "function" ? window.toolbetUiCommand(command) : { ok:false, error:"UI command bridge chưa được kết nối" }; },
    remove() { document.getElementById(ROOT_ID)?.remove(); document.getElementById(THEME_ID)?.remove(); document.getElementById(COMPONENTS_ID)?.remove(); }
  };
}
