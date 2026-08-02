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
      },
      strategies: strategyTabs.strategies || [],
      moneyManagers: strategyTabs.money_managers || [],
      lifecycleMode: lifecycle.mode || selected.mode || "simulation",
      autoBet: !!state.auto_bet,
      license: state.license || {},
    });
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
      window.__toolbetUiSnapshot.tabs = clone(next.tabs || tabs);
      window.__toolbetUiSnapshot.state.strategy_tabs = clone(next);
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
      snapshot.tabs = tabs.map(tab => tab.id === data.tab_id
        ? { ...tab, mode: data.mode || tab.mode, lifecycle: { ...(tab.lifecycle || {}), ...data } }
        : tab);
      snapshot.state.strategy_tabs.tabs = clone(snapshot.tabs);
      if (Object.prototype.hasOwnProperty.call(data, "auto_bet")) snapshot.state.auto_bet = !!data.auto_bet;
      if (message) message.textContent = data.mode === "live"
        ? "Tab đã nắm quyền quyết định; AutoBettor vẫn tắt cho đến khi xác nhận riêng."
        : "Đã cập nhật trạng thái tab.";
      render(snapshot, window.__toolbetUiAssets || {});
      return true;
    } catch (error) {
      if (message) message.textContent = String(error && error.message ? error.message : error);
      return false;
    }
  };

  const renderRoad = dots => {
    const road = el("div", "tbv2-road");
    (dots || []).forEach(item => {
      const dot = el("span", `tbv2-dot ${item.side || ""}`);
      dot.title = item.label || item.side || ""; road.append(dot);
    });
    if (!road.childElementCount) road.append(el("span", "tbv2-empty", "Chưa có kết quả"));
    return road;
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
    const risk = current.risk || {};

    let root = document.getElementById(ROOT_ID);
    const previousScrollTop = root?.querySelector(".tbv2-scroll")?.scrollTop || 0;
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
    const brand = el("div", "tbv2-brand"); brand.append(el("strong", "", "ToolBet v2"), el("span", "", "Strategy Workspace"));
    const activeMode = ((selected.lifecycle || {}).mode || selected.mode || "simulation");
    const mode = el("span", `tbv2-mode ${activeMode}`, MODE_LABELS[activeMode] || activeMode);
    mode.id = "tbv2-active-mode";
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
    headerActions.append(mode);
    header.append(brand, headerActions); shell.append(header);
    bindDrag(root, header);

    const tabsBar = el("nav", "tbv2-tabs");
    tabs.forEach(tab => {
      const button = el("button", `tbv2-tab ${tab.id === selectedId ? "active" : ""}`, tab.name || "Chiến lược");
      button.type = "button"; button.dataset.tabId = tab.id;
      button.addEventListener("click", () => {
        window.__toolbetUiLocal.selectedId = tab.id;
        saveTabs(tabs, tab.id, null, true);
      });
      tabsBar.append(button);
    });
    const add = el("button", "tbv2-tab-add", "+"); add.type = "button"; add.title = "Thêm chiến lược";
    add.disabled = tabs.length >= 5;
    add.addEventListener("click", () => {
      const id = (crypto.randomUUID ? crypto.randomUUID() : `tab-${Date.now()}`).replaceAll("-", "");
      const next = { id, name: `Chiến lược ${tabs.length + 1}`, enabled: true, strategy_id: "legacy_patterns", stakes: [0,100,110,120,130], progression_mode: "loss_up_win_reset", money_manager_id: "IncreaseWhenLose", stake_chains: [], stop_loss: 0, take_profit: 0 };
      saveTabs([...tabs, next], id, null, true);
    });
    tabsBar.append(add); shell.append(tabsBar);

    const scroll = el("div", "tbv2-scroll"); shell.append(scroll);
    const configCard = el("section", "tbv2-card tbv2-config-card");
    configCard.append(cardTitle("Chiến lược & Chuỗi tiền", el("span", "tbv2-safe", "Không click chip")));
    const grid = el("div", "tbv2-form-grid");
    grid.append(
      field("Tên tab", input("tbv2-name", draft?.name ?? selected.name ?? "Chiến lược")),
      field("Chiến lược", select("tbv2-strategy", (state.strategy_tabs || {}).strategies || [], draft?.strategy_id ?? selected.strategy_id)),
      field("Quản lý vốn", select("tbv2-progression",
        (state.strategy_tabs || {}).money_managers || [],
        draft?.money_manager_id ?? selected.money_manager_id ?? "IncreaseWhenLose")),
      field("Chuỗi tiền", input("tbv2-stakes",
        draft?.stakes_text ?? ((selected.money_manager_id === "MultiChain"
          ? (selected.stake_chains || [selected.stakes || []]).map(chain => chain.join("-")).join("; ")
          : (selected.stakes || []).join("-"))))),
      field("Cắt lãi", input("tbv2-tp", draft?.take_profit ?? selected.take_profit ?? 0, "number")),
      field("Cắt lỗ", input("tbv2-sl", draft?.stop_loss ?? selected.stop_loss ?? 0, "number"))
    );
    configCard.append(grid);
    const controls = el("div", "tbv2-controls");
    const enabled = el("label", "tbv2-check");
    const checkbox = input("tbv2-enabled", "", "checkbox");
    checkbox.checked = draft?.enabled ?? (selected.enabled !== false);
    enabled.append(checkbox, el("span", "", "Bật tab này"));
    const simulationOnly = el("label", "tbv2-check");
    const simulationCheckbox = input("tbv2-simulation-only", "", "checkbox");
    simulationCheckbox.checked = (
      draft?.mode ?? activeMode
    ) !== "live";
    simulationOnly.append(
      simulationCheckbox,
      el("span", "", "Chỉ mô phỏng/test")
    );
    const remove = el("button", "tbv2-danger", "Đóng tab"); remove.type = "button"; remove.disabled = tabs.length <= 1;
    controls.append(enabled, simulationOnly, remove); configCard.append(controls);
    const message = el(
      "div",
      "tbv2-message",
      draft ? "Đang chờ lưu tự động vào SQLite." : "Dữ liệu tab được lưu tự động vào SQLite."
    );
    configCard.append(message);
    const managerSelect = configCard.querySelector("#tbv2-progression");
    const stakesInput = configCard.querySelector("#tbv2-stakes");
    managerSelect.addEventListener("change", () => {
      const managerId = managerSelect.value;
      const savedConfig = (selected.money_configs || {})[managerId];
      const savedStakes = (savedConfig && savedConfig.stakes) || selected.stakes || [];
      const savedChains = (savedConfig && savedConfig.stake_chains) || [];
      stakesInput.value = managerId === "MultiChain"
        ? (savedChains.length ? savedChains : [savedStakes]).map(chain => chain.join("-")).join("; ")
        : savedStakes.join("-");
      stakesInput.placeholder = managerId === "MultiChain"
        ? "10-20-40; 50-100-200"
        : "10-20-40-80";
    });
    const autoSave = window.__toolbetUiLocal.autoSave || { timer: null, version: 0 };
    window.__toolbetUiLocal.autoSave = autoSave;
    const saveCurrentDraft = async (version) => {
      if (version !== autoSave.version) return;
      const currentDraft = window.__toolbetUiLocal.drafts[selected.id];
      if (!currentDraft) return;
      const name = currentDraft.name.trim();
      const chains = currentDraft.stakes_text.split(";").map(part =>
        part.split(/[,\-\s]+/).map(Number).filter(v => Number.isFinite(v) && v >= 0)
      ).filter(chain => chain.length);
      if (!name || !chains.length) {
        message.textContent = "Tên tab và chuỗi tiền hợp lệ sẽ được lưu tự động.";
        return;
      }
      const managerId = currentDraft.money_manager_id;
      const changed = {
        ...selected,
        name,
        strategy_id: currentDraft.strategy_id,
        money_manager_id: managerId,
        stakes: chains[0].slice(),
        stake_chains: managerId === "MultiChain" ? chains : [],
        take_profit: number(currentDraft.take_profit),
        stop_loss: number(currentDraft.stop_loss),
        enabled: currentDraft.enabled,
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
      message.textContent = "Đã lưu tự động vào SQLite.";
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
        name: root.querySelector("#tbv2-name").value,
        strategy_id: root.querySelector("#tbv2-strategy").value,
        money_manager_id: managerSelect.value,
        stakes_text: stakesInput.value,
        take_profit: root.querySelector("#tbv2-tp").value,
        stop_loss: root.querySelector("#tbv2-sl").value,
        enabled: checkbox.checked,
        mode: simulationCheckbox.checked ? "simulation" : "live",
      };
      message.textContent = "Đang chờ lưu tự động vào SQLite.";
      scheduleAutoSave();
      const runToggle = root.querySelector("#tbv2-run-toggle");
      if (runToggle && !autoBet) {
        runToggle.hidden = simulationCheckbox.checked;
      }
    };
    configCard.querySelectorAll("input, select").forEach(control => {
      control.addEventListener("input", rememberDraft);
      control.addEventListener("change", rememberDraft);
    });
    remove.addEventListener("click", () => {
      const remaining = tabs.filter(tab => tab.id !== selected.id);
      saveTabs(remaining, (remaining[0] || {}).id || "", message, false, selected.id);
    });
    scroll.append(configCard);

    const lifecycle = selected.lifecycle || { mode: selected.mode || "simulation" };
    const lifecycleCard = el("section", "tbv2-card tbv2-lifecycle-card");
    lifecycleCard.append(cardTitle("Chạy chương trình", el("span", `tbv2-mode ${lifecycle.mode || "simulation"}`, MODE_LABELS[lifecycle.mode] || "MÔ PHỎNG/TEST")));
    const lifecycleActions = el("div", "tbv2-lifecycle-actions");
    const autoBet = !!state.auto_bet;
    const liveTabs = tabs.filter(tab => (
      (tab.lifecycle || {}).mode || tab.mode
    ) === "live").length;
    const toggle = el(
      "button",
      autoBet ? "tbv2-danger" : "tbv2-primary",
      autoBet ? "Dừng chạy thật" : "Bắt đầu chạy thật"
    );
    toggle.type = "button";
    toggle.id = "tbv2-run-toggle";
    toggle.disabled = !autoBet && liveTabs === 0;
    // Only hide the start action for a simulation tab. A visible stop action
    // remains mandatory while a real-running session is active.
    toggle.hidden = !autoBet && simulationCheckbox.checked;
    toggle.addEventListener("click", () => lifecycleCommand(
      "set_run_state",
      { running: !autoBet },
      lifecycleMessage
    ));
    lifecycleActions.append(toggle);
    const lifecycleMessage = el(
      "div",
      "tbv2-message",
      autoBet
        ? `Đang chạy thật ${liveTabs} tab. Các tab có thể đặt cả hai cửa trong cùng ván.`
        : `${liveTabs} tab chọn Chạy thật. Tích “Chỉ mô phỏng/test” để tab không đặt tiền.`
    );
    lifecycleMessage.dataset.bind = "lifecycle-message";
    lifecycleCard.append(lifecycleActions, lifecycleMessage);
    scroll.append(lifecycleCard);

    const statusCard = el("section", "tbv2-card"); statusCard.append(cardTitle("Trạng thái"));
    const statusGrid = el("div", "tbv2-status-grid");
    [["Bàn", tableLabelFor(state), "status-table"], ["Kết quả gần nhất", sideLabel(displayedDots.at(-1)?.side), "status-last-result"],
     ["Cửa đề xuất", sideLabel(current.side), "status-side"], ["Tiền cược ảo", money(current.stake), "status-stake"],
     ["Mức tiền", `${current.level || 1}/${current.total_levels || 1}`, "status-level"], ["Risk", risk.allowed ? "Cho phép mô phỏng" : (risk.reason || "Chờ tín hiệu"), "status-risk"]]
      .forEach(([label, value, key]) => {
        const item = el("div", "tbv2-status-item");
        const strong = el("strong", "", value); strong.dataset.bind = key;
        item.append(el("span", "", label), strong); statusGrid.append(item);
      });
    const reason = el("div", "tbv2-reason", current.reason || "Chưa có tín hiệu.");
    reason.dataset.bind = "status-reason";
    statusCard.append(statusGrid, reason); scroll.append(statusCard);

    const statsCard = el("section", "tbv2-card"); statsCard.append(cardTitle("Thống kê"));
    const stats = el("div", "tbv2-stat-grid");
    [["Thắng", status.wins, "stats-wins"], ["Thua", status.losses, "stats-losses"], ["Hòa", status.pushes, "stats-pushes"], ["Tín hiệu", status.signals, "stats-signals"], ["Cược ảo", status.virtual_bets, "stats-virtual-bets"], ["P&L ảo", money(status.pnl), "stats-pnl"]]
      .forEach(([label, value, key]) => {
        const item = el("div", "tbv2-stat");
        const strong = el("strong", number(value) < 0 ? "negative" : "", value ?? 0);
        strong.dataset.bind = key;
        item.append(el("span", "", label), strong); stats.append(item);
      });
    statsCard.append(stats); scroll.append(statsCard);

    const roadStatus = el(
      "span",
      "tbv2-safe",
      historyView.cached ? "Dữ liệu gần nhất" : ""
    );
    roadStatus.dataset.bind = "road-cache-status";
    roadStatus.hidden = !historyView.cached;
    const roadCard = el("section", "tbv2-card");
    roadCard.append(cardTitle("Lịch sử bàn", roadStatus), renderRoad(displayedDots));
    scroll.append(roadCard);
    const historyCard = el("section", "tbv2-card"); historyCard.append(cardTitle("Lịch sử mô phỏng của tab"));
    const table = el("table", "tbv2-history-table");
    const thead = el("thead"); const trh = el("tr"); ["Ván", "W/L/H", "Cược", "P&L"].forEach(value => trh.append(el("th", "", value))); thead.append(trh); table.append(thead);
    const tbody = el("tbody"); tbody.dataset.bind = "simulation-history-body";
    (selected.history || []).slice(-12).reverse().forEach(row => {
      const tr = el("tr"); [row.history_size, `${row.wins}/${row.losses}/${row.pushes}`, row.virtual_bets, money(row.pnl)].forEach(value => tr.append(el("td", "", value))); tbody.append(tr);
    });
    if (!tbody.childElementCount) { const tr = el("tr"); const td = el("td", "tbv2-empty", "Chưa có snapshot mô phỏng"); td.colSpan = 4; tr.append(td); tbody.append(tr); }
    table.append(tbody); historyCard.append(table); scroll.append(historyCard);
    scroll.scrollTop = previousScrollTop;
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
    window.__toolbetUiLocal.simulationHistorySignature = JSON.stringify(
      selected.history || []
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
    const lifecycle = selected.lifecycle || {
      mode: selected.mode || "simulation",
    };

    const liveTabs = (snapshot.tabs || []).filter(tab => (
      (tab.lifecycle || {}).mode || tab.mode
    ) === "live").length;
    setBoundText(
      root,
      "lifecycle-message",
      state.auto_bet
        ? `Đang chạy thật ${liveTabs} tab. Các tab có thể đặt cả hai cửa trong cùng ván.`
        : `${liveTabs} tab chọn Chạy thật. Tích “Chỉ mô phỏng/test” để tab không đặt tiền.`
    );

    setBoundText(root, "status-table", tableLabelFor(state));
    setBoundText(
      root,
      "status-last-result",
      sideLabel(displayedDots.at(-1)?.side)
    );
    setBoundText(root, "status-side", sideLabel(current.side));
    setBoundText(root, "status-stake", money(current.stake));
    setBoundText(
      root,
      "status-level",
      `${current.level || 1}/${current.total_levels || 1}`
    );
    setBoundText(
      root,
      "status-risk",
      risk.allowed
        ? "Cho phép mô phỏng"
        : (risk.reason || "Chờ tín hiệu")
    );
    setBoundText(
      root,
      "status-reason",
      current.reason || "Chưa có tín hiệu."
    );

    const statValues = {
      "stats-wins": status.wins ?? 0,
      "stats-losses": status.losses ?? 0,
      "stats-pushes": status.pushes ?? 0,
      "stats-signals": status.signals ?? 0,
      "stats-virtual-bets": status.virtual_bets ?? 0,
      "stats-pnl": money(status.pnl),
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
    const roadCacheStatus = setBoundText(
      root,
      "road-cache-status",
      historyView.cached ? "Dữ liệu gần nhất" : ""
    );
    if (roadCacheStatus) roadCacheStatus.hidden = !historyView.cached;

    const simulationHistorySignature = JSON.stringify(
      selected.history || []
    );
    const tbody = root.querySelector('[data-bind="simulation-history-body"]');
    if (
      tbody
      && simulationHistorySignature
        !== window.__toolbetUiLocal.simulationHistorySignature
    ) {
      const fragment = document.createDocumentFragment();
      (selected.history || []).slice(-12).reverse().forEach(row => {
        const tr = el("tr");
        [
          row.history_size,
          `${row.wins}/${row.losses}/${row.pushes}`,
          row.virtual_bets,
          money(row.pnl),
        ].forEach(value => tr.append(el("td", "", value)));
        fragment.append(tr);
      });
      if (!fragment.childNodes.length) {
        const tr = el("tr");
        const td = el(
          "td",
          "tbv2-empty",
          "Chưa có snapshot mô phỏng"
        );
        td.colSpan = 4;
        tr.append(td);
        fragment.append(tr);
      }
      tbody.replaceChildren(fragment);
      window.__toolbetUiLocal.simulationHistorySignature =
        simulationHistorySignature;
    }
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
