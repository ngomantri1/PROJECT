function updateCharacterCount() {
  const t = document.getElementById("Text");
  const c = document.getElementById("charCount");
  const cost = document.getElementById("pointCost");
  const sticky = document.getElementById("stickyPointCost");
  const rateEl = document.querySelector('input[name="VoiceId"]:checked');
  if (!t || !c) return;
  const len = t.value.trim().length;
  const rate = rateEl ? parseFloat(rateEl.dataset.rate) : 1;
  const point = Math.ceil(len * rate);
  c.textContent = len.toLocaleString("vi-VN");
  const label = `${point.toLocaleString("vi-VN")} điểm`;
  if (cost) cost.textContent = label;
  if (sticky) sticky.textContent = label;
}

const voiceStorageKey = "adamvoice.selectedVoiceId";
const presetStorageKey = "adamvoice.selectedPreset";
const draftTextStorageKey = "adamvoice.draftText";
const recentVoiceStorageKey = "adamvoice.recentVoiceIds";
let sharedHistoryAudio;
let activeHistoryButton = null;
let previewAudio;
let activePreviewButton = null;
let currentVoicePickerFilter = "all";
let isGeneratingVoice = false;
let bypassVoiceConfirm = false;

function isMobileComposerViewport() {
  return window.matchMedia("(max-width: 900px)").matches;
}

document.addEventListener("input", (e) => {
  if (e.target.id === "Text") {
    saveDraftText();
    updateCharacterCount();
  }
  if (e.target.name === "VoiceId") updateCharacterCount();
});

document.addEventListener("change", (e) => {
  if (e.target.name === "VoiceId") {
    localStorage.setItem(voiceStorageKey, e.target.value);
    rememberRecentVoice(e.target.value);
    updateSelectedVoiceCard();
    refreshVoicePickerSelection();
    updateCharacterCount();
  }
});

window.addEventListener("load", () => {
  closeVoicePicker();
  restoreDraftText();
  restoreVoiceSelection();
  restorePresetSelection();
  const selectedVoice = getSelectedVoiceRadio();
  if (selectedVoice) rememberRecentVoice(selectedVoice.value);
  bindVoiceFormAsync();
  updateSelectedVoiceCard();
  refreshVoicePickerSelection();
  filterVoicePickerList();
  switchComposerPanel("voice");
  closeMobileComposerPanel();
  updateCharacterCount();
  scheduleAutoDismissAlerts();
});

function setPreset(name) {
  document.querySelectorAll(".preset").forEach((x) => x.classList.remove("active"));
  const b = document.querySelector(`[data-preset="${name}"]`);
  if (b) b.classList.add("active");
  const map = {
    normal: [1, 0.5, 0.8, 0.4],
    funny: [1.05, 0.35, 0.85, 0.6],
    ad: [1.08, 0.45, 0.85, 0.55],
    story: [0.95, 0.65, 0.85, 0.25],
    news: [1, 0.7, 0.8, 0.2],
    trend: [1.12, 0.35, 0.9, 0.65]
  };
  const v = map[name] || map.normal;
  ["Speed", "Stability", "Similarity", "Style"].forEach((id, i) => {
    const el = document.getElementById(id);
    const out = document.getElementById(`${id}Value`);
    if (el) {
      el.value = v[i];
      if (out) out.textContent = v[i];
    }
  });
  localStorage.setItem(presetStorageKey, name);
}

function restoreVoiceSelection() {
  const savedVoiceId = localStorage.getItem(voiceStorageKey);
  if (!savedVoiceId) return;
  const savedVoice = document.querySelector(`input[name="VoiceId"][value="${savedVoiceId}"]`);
  if (savedVoice) savedVoice.checked = true;
}

function restorePresetSelection() {
  const savedPreset = localStorage.getItem(presetStorageKey);
  if (savedPreset) {
    setPreset(savedPreset);
    return;
  }
  setPreset("normal");
}

function saveDraftText() {
  const t = document.getElementById("Text");
  if (!t) return;
  localStorage.setItem(draftTextStorageKey, t.value);
}

function restoreDraftText() {
  const t = document.getElementById("Text");
  if (!t) return;
  const saved = localStorage.getItem(draftTextStorageKey);
  if (saved !== null) t.value = saved;
}

function clearText() {
  const t = document.getElementById("Text");
  if (!t) return;
  t.value = "";
  localStorage.setItem(draftTextStorageKey, "");
  updateCharacterCount();
  t.focus();
}

function getSelectedVoiceRadio() {
  return document.querySelector('input[name="VoiceId"]:checked');
}

function getSelectedVoiceData() {
  const radio = getSelectedVoiceRadio();
  if (!radio) return null;
  return {
    id: radio.value,
    name: radio.dataset.name || "Chưa chọn giọng",
    description: radio.dataset.description || "",
    avatar: radio.dataset.avatar || "🎙️",
    rate: radio.dataset.rate || "1",
    isCustom: radio.dataset.isCustom === "true"
  };
}

function updateSelectedVoiceCard() {
  const voice = getSelectedVoiceData();
  const avatar = document.getElementById("selectedVoiceAvatar");
  const name = document.getElementById("selectedVoiceName");
  const desc = document.getElementById("selectedVoiceDescription");
  const rate = document.getElementById("selectedVoiceRate");
  const type = document.getElementById("selectedVoiceType");
  if (!avatar || !name || !desc || !rate || !type) return;
  if (!voice) {
    avatar.textContent = "🎙️";
    name.textContent = "Chưa chọn giọng";
    desc.textContent = "Hãy mở popup để chọn giọng phù hợp.";
    rate.textContent = "x1 điểm";
    type.textContent = "Giọng hệ thống";
    return;
  }
  avatar.textContent = voice.avatar;
  name.textContent = voice.name;
  desc.textContent = voice.description || "Giọng đã sẵn sàng để tạo audio.";
  rate.textContent = `x${voice.rate} điểm`;
  type.textContent = voice.isCustom ? "Giọng của bạn" : "Giọng hệ thống";
}

function rememberRecentVoice(voiceId) {
  if (!voiceId) return;
  const recent = getRecentVoiceIds().filter((x) => x !== String(voiceId));
  recent.unshift(String(voiceId));
  localStorage.setItem(recentVoiceStorageKey, JSON.stringify(recent.slice(0, 8)));
}

function getRecentVoiceIds() {
  try {
    const raw = localStorage.getItem(recentVoiceStorageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function openVoicePicker() {
  const modal = document.getElementById("voicePickerModal");
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  filterVoicePickerList();
  const search = document.getElementById("voiceSearchInput");
  if (search) search.focus();
}

function closeVoicePicker() {
  const modal = document.getElementById("voicePickerModal");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  stopPreviewAudio();
}

function setVoicePickerFilter(filter) {
  currentVoicePickerFilter = filter;
  document.querySelectorAll(".voice-picker-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.voiceFilter === filter);
  });
  filterVoicePickerList();
}

function filterVoicePickerList() {
  const search = document.getElementById("voiceSearchInput");
  const keyword = (search?.value || "").trim().toLowerCase();
  const recentIds = getRecentVoiceIds();
  let visibleCount = 0;
  document.querySelectorAll(".voice-picker-item").forEach((item) => {
    const id = item.dataset.voiceId || "";
    const name = (item.dataset.voiceName || "").toLowerCase();
    const desc = (item.dataset.voiceDescription || "").toLowerCase();
    const isCustom = item.dataset.voiceCustom === "true";
    const matchKeyword = !keyword || name.includes(keyword) || desc.includes(keyword);
    let matchFilter = true;
    if (currentVoicePickerFilter === "mine") matchFilter = isCustom;
    if (currentVoicePickerFilter === "recent") matchFilter = recentIds.includes(id);
    item.hidden = !(matchKeyword && matchFilter);
    item.style.order = currentVoicePickerFilter === "recent" ? String(Math.max(0, recentIds.indexOf(id))) : "0";
    if (!item.hidden) visibleCount++;
  });
  const empty = document.getElementById("voicePickerEmpty");
  if (empty) empty.hidden = visibleCount > 0;
}

function refreshVoicePickerSelection() {
  const selectedId = getSelectedVoiceRadio()?.value;
  document.querySelectorAll(".voice-picker-item").forEach((item) => {
    const selected = item.dataset.voiceId === selectedId;
    item.classList.toggle("selected", selected);
  });
  document.querySelectorAll("[data-voice-check]").forEach((el) => {
    el.classList.toggle("active", el.dataset.voiceCheck === selectedId);
  });
}

function selectVoiceFromPicker(voiceId) {
  const radio = document.querySelector(`input[name="VoiceId"][value="${voiceId}"]`);
  if (!radio) return;
  radio.checked = true;
  localStorage.setItem(voiceStorageKey, radio.value);
  rememberRecentVoice(radio.value);
  updateSelectedVoiceCard();
  refreshVoicePickerSelection();
  filterVoicePickerList();
  updateCharacterCount();
  closeVoicePicker();
}

function getPreviewAudio() {
  if (previewAudio) return previewAudio;
  previewAudio = new Audio();
  previewAudio.addEventListener("ended", () => setPreviewButtonState(activePreviewButton, false));
  previewAudio.addEventListener("pause", () => {
    if (!previewAudio.ended) setPreviewButtonState(activePreviewButton, false);
  });
  return previewAudio;
}

async function previewVoice(voiceId, button) {
  if (!button) return;
  const audio = getPreviewAudio();
  const sameVoice = button.dataset.previewVoiceId === String(voiceId);
  if (activePreviewButton === button && !audio.paused && sameVoice) {
    stopPreviewAudio();
    return;
  }
  try {
    setPreviewButtonLoading(button, true);
    stopSharedHistoryAudio();
    if (activePreviewButton && activePreviewButton !== button) setPreviewButtonState(activePreviewButton, false);
    const res = await fetch(`${window.location.pathname}?handler=PreviewVoice&voiceId=${voiceId}`);
    const data = await res.json();
    if (!data.ok || !data.audioUrl) {
      alert(data.message || "Không thể nghe thử giọng.");
      return;
    }
    activePreviewButton = button;
    button.dataset.previewVoiceId = String(voiceId);
    audio.src = data.audioUrl;
    await audio.play();
    setPreviewButtonState(button, true);
  } catch {
    alert("Không thể nghe thử giọng lúc này.");
  } finally {
    setPreviewButtonLoading(button, false);
  }
}

function stopPreviewAudio() {
  if (previewAudio) {
    previewAudio.pause();
    previewAudio.currentTime = 0;
  }
  setPreviewButtonState(activePreviewButton, false);
  activePreviewButton = null;
}

function setPreviewButtonLoading(button, isLoading) {
  if (!button) return;
  button.disabled = isLoading;
  button.classList.toggle("is-loading", isLoading);
  if (isLoading) button.innerHTML = '<span class="btn-spinner preview-spinner" aria-hidden="true"></span>';
  else if (!button.classList.contains("is-playing")) button.textContent = "▶";
}

function setPreviewButtonState(button, isPlaying) {
  if (!button) return;
  button.classList.toggle("is-playing", isPlaying);
  if (button.classList.contains("is-loading")) return;
  button.textContent = isPlaying ? "❚❚" : "▶";
}

function switchComposerPanel(panel) {
  document.querySelectorAll(".composer-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.panelTab === panel);
  });
  document.querySelectorAll(".composer-panel").forEach((content) => {
    content.classList.toggle("active", content.dataset.panel === panel);
  });
  syncMobileComposerPanel(panel);
}

function syncMobileComposerPanel(panel) {
  document.querySelectorAll("[data-mobile-panel-button]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mobilePanelButton === panel);
  });
  const side = document.getElementById("composerSidePanel");
  if (side) side.dataset.activePanel = panel;
}

function openMobileComposerPanel(panel) {
  switchComposerPanel(panel);
  const side = document.getElementById("composerSidePanel");
  if (!side || !isMobileComposerViewport()) return;
  document.body.classList.add("composer-sheet-open");
  document.getElementById("composerMobileSheetBackdrop")?.classList.add("is-visible");
  side.classList.add("is-mobile-visible");
}

function closeMobileComposerPanel() {
  const side = document.getElementById("composerSidePanel");
  if (!side) return;
  document.body.classList.remove("composer-sheet-open");
  document.getElementById("composerMobileSheetBackdrop")?.classList.remove("is-visible");
  side.classList.remove("is-mobile-visible");
  document.querySelectorAll("[data-mobile-panel-button]").forEach((button) => {
    button.classList.remove("active");
  });
}

function toggleMobileComposerPanel(panel) {
  const side = document.getElementById("composerSidePanel");
  const isSamePanel = side?.dataset.activePanel === panel && side.classList.contains("is-mobile-visible");
  if (isSamePanel) {
    closeMobileComposerPanel();
    return;
  }
  openMobileComposerPanel(panel);
}

function bindVoiceFormAsync() {
  const form = document.getElementById("voiceForm");
  if (!form || form.dataset.asyncBound === "true") return;
  form.dataset.asyncBound = "true";
  form.addEventListener("submit", (e) => {
    if (e.defaultPrevented || form.dataset.asyncGenerate !== "true") return;
    e.preventDefault();
    if (isGeneratingVoice) return;
    submitVoiceFormAsync(form);
  });
}

async function submitVoiceFormAsync(form) {
  focusRecentHistoryPanel();
  const pendingItem = insertPendingHistoryItem();
  setCreateButtonsBusy(true);
  try {
    const formData = new FormData(form);
    const url = `${window.location.pathname}?handler=Generate`;
    const res = await fetch(url, {
      method: "POST",
      body: formData,
      headers: { "X-Requested-With": "XMLHttpRequest" }
    });
    const data = await res.json();
    if (data.redirectUrl) {
      window.location.href = data.redirectUrl;
      return;
    }
    renderIndexMessages(data);
    updatePointBalance(data.currentBalance);
    if (data.ok) {
      renderRecentHistoryList(data.recentJobs || []);
      focusRecentHistoryPanel();
      return;
    }
    if (pendingItem) pendingItem.remove();
    ensureRecentHistoryEmptyState();
  } catch {
    if (pendingItem) pendingItem.remove();
    ensureRecentHistoryEmptyState();
    renderIndexMessages({
      ok: false,
      message: "Tạo giọng lỗi, vui lòng thử lại.",
      currentBalance: null,
      lowPointWarning: null
    });
  } finally {
    setCreateButtonsBusy(false);
  }
}

function focusRecentHistoryPanel() {
  if (isMobileComposerViewport()) openMobileComposerPanel("history");
  else switchComposerPanel("history");
  const container = document.getElementById("recentHistoryList");
  if (!container) return;
  requestAnimationFrame(() => {
    container.scrollTop = 0;
  });
}

function setCreateButtonsBusy(isBusy) {
  isGeneratingVoice = isBusy;
  const main = document.getElementById("mainCreateButton");
  const mobile = document.querySelector("[data-create-mobile]");
  [main, mobile].forEach((button) => {
    if (!button) return;
    button.disabled = isBusy;
    button.classList.toggle("is-busy", isBusy);
    if (button === main) {
      button.innerHTML = isBusy ? '<span class="btn-spinner" aria-hidden="true"></span> Đang tạo giọng...' : "🎙️ Tạo giọng nói";
    } else {
      button.textContent = isBusy ? "Đang tạo..." : "Tạo giọng";
    }
  });
}

function insertPendingHistoryItem() {
  const container = document.getElementById("recentHistoryList");
  if (!container) return null;
  const empty = container.querySelector(".history-empty");
  if (empty) empty.remove();
  const voice = getSelectedVoiceData();
  const text = document.getElementById("Text")?.value?.trim() || "Đang chuẩn bị nội dung...";
  const preview = text.length > 30 ? `${text.slice(0, 30)}...` : text;
  const count = text.length.toLocaleString("vi-VN");
  const item = document.createElement("div");
  item.className = "history-item history-item-pending is-active";
  item.setAttribute("data-pending-item", "true");
  item.innerHTML = `
    <div class="play history-play history-play-pending" aria-hidden="true">
      <span class="history-eq"><span></span><span></span><span></span></span>
    </div>
    <div class="history-main">
      <b>${escapeHtml(preview || "Đang tạo giọng mới...")}</b><span class="muted history-subline">${escapeHtml(voice?.name || "Giọng đã chọn")} • ${count} ký tự</span>
    </div>
    <div class="history-side">
      <div class="muted history-time">Đang tạo...</div>
    </div>
    <div class="history-audio-bar history-audio-bar-pending">
      <span class="history-pending-status">Đang tạo giọng...</span>
    </div>
  `;
  container.prepend(item);
  return item;
}

function renderRecentHistoryList(jobs) {
  const container = document.getElementById("recentHistoryList");
  if (!container) return;
  stopSharedHistoryAudio();
  if (!Array.isArray(jobs) || jobs.length === 0) {
    container.innerHTML = '<p class="muted history-empty">Chưa có file nào.</p>';
    return;
  }
  container.innerHTML = jobs.map(renderRecentHistoryItem).join("");
}

function ensureRecentHistoryEmptyState() {
  const container = document.getElementById("recentHistoryList");
  if (!container || container.children.length > 0) return;
  container.innerHTML = '<p class="muted history-empty">Chưa có file nào.</p>';
}

function renderRecentHistoryItem(job) {
  return `
    <div class="history-item" data-audio-item>
      <button type="button" class="play history-play" data-audio-url="${escapeHtml(job.audioUrl)}" data-state="idle" onclick="toggleHistoryAudio(this)" aria-label="Phát audio">
        <span class="play-icon">▶</span>
      </button>
      <div class="history-main">
        <b>${escapeHtml(job.textPreview)}</b><span class="muted history-subline">${escapeHtml(job.voiceName)} • ${formatNumber(job.characterCount)} ký tự</span>
      </div>
      <div class="history-side">
        <div class="muted history-time">${escapeHtml(job.createdAtText)}</div>
        <a class="history-download" href="${escapeHtml(job.audioUrl)}" download aria-label="Tải MP3">⬇</a>
      </div>
      <div class="history-audio-bar" hidden>
        <span class="history-audio-current">0:00</span>
        <input type="range" class="history-progress" min="0" max="100" step="0.1" value="0" oninput="seekHistoryAudio(this)" aria-label="Tua audio" />
        <span class="history-audio-duration">0:00</span>
      </div>
    </div>
  `;
}

function renderIndexMessages(result) {
  const stack = document.getElementById("indexMessageStack");
  if (!stack) return;
  const blocks = [];
  if (result.message) {
    blocks.push(`<div class="alert ${result.ok ? "ok alert-floating" : "err"}"${result.ok ? ' data-auto-dismiss="2000"' : ""}>${escapeHtml(result.message)}</div>`);
  }
  if (typeof result.currentBalance === "number" && typeof result.lowPointWarning === "number" && result.currentBalance <= result.lowPointWarning) {
    blocks.push(`<div class="alert warn">Điểm của anh sắp hết: <b>${formatNumber(result.currentBalance)} điểm</b>. Nên mua thêm điểm để không bị gián đoạn.</div>`);
  }
  stack.innerHTML = blocks.join("");
  scheduleAutoDismissAlerts();
}

function scheduleAutoDismissAlerts() {
  document.querySelectorAll(".alert[data-auto-dismiss]").forEach((alert) => {
    if (alert.dataset.dismissScheduled === "true") return;
    alert.dataset.dismissScheduled = "true";
    const delay = parseInt(alert.dataset.autoDismiss || "3000", 10);
    window.setTimeout(() => {
      alert.classList.add("is-hiding");
      window.setTimeout(() => {
        alert.remove();
      }, 280);
    }, Number.isFinite(delay) ? delay : 3000);
  });
}

function updatePointBalance(value) {
  if (typeof value !== "number") return;
  const label = `${formatNumber(value)} điểm`;
  document.querySelectorAll("[data-point-balance]").forEach((el) => {
    el.textContent = label;
  });
  document.querySelectorAll("[data-point-balance-card]").forEach((el) => {
    el.setAttribute("title", label);
  });
}

function stopSharedHistoryAudio() {
  if (sharedHistoryAudio) {
    sharedHistoryAudio.pause();
    sharedHistoryAudio.currentTime = 0;
  }
  if (activeHistoryButton) {
    resetHistoryItem(activeHistoryButton, true);
    activeHistoryButton = null;
  }
}

function getSharedHistoryAudio() {
  if (sharedHistoryAudio) return sharedHistoryAudio;
  sharedHistoryAudio = new Audio();
  sharedHistoryAudio.preload = "metadata";
  sharedHistoryAudio.addEventListener("loadedmetadata", syncActiveHistoryProgress);
  sharedHistoryAudio.addEventListener("durationchange", syncActiveHistoryProgress);
  sharedHistoryAudio.addEventListener("timeupdate", syncActiveHistoryProgress);
  sharedHistoryAudio.addEventListener("play", () => setHistoryButtonState(activeHistoryButton, "playing"));
  sharedHistoryAudio.addEventListener("pause", () => {
    if (activeHistoryButton && !sharedHistoryAudio.ended) setHistoryButtonState(activeHistoryButton, "paused");
  });
  sharedHistoryAudio.addEventListener("ended", () => {
    syncActiveHistoryProgress();
    if (sharedHistoryAudio) sharedHistoryAudio.currentTime = 0;
    syncActiveHistoryProgress();
    setHistoryButtonState(activeHistoryButton, "idle");
  });
  return sharedHistoryAudio;
}

function toggleHistoryAudio(button) {
  if (!button) return;
  const url = button.dataset.audioUrl;
  if (!url) return;
  stopPreviewAudio();
  const audio = getSharedHistoryAudio();
  if (activeHistoryButton && activeHistoryButton !== button) resetHistoryItem(activeHistoryButton, true);
  openHistoryItem(button);
  if (activeHistoryButton !== button || audio.src !== new URL(url, window.location.href).href) {
    activeHistoryButton = button;
    audio.src = url;
    audio.currentTime = 0;
    syncActiveHistoryProgress();
    audio.play().catch(() => setHistoryButtonState(button, "idle"));
    return;
  }
  activeHistoryButton = button;
  if (audio.paused) {
    if (audio.duration && audio.currentTime >= audio.duration - 0.05) audio.currentTime = 0;
    audio.play().catch(() => setHistoryButtonState(button, "idle"));
    return;
  }
  audio.pause();
}

function seekHistoryAudio(input) {
  if (!input || !sharedHistoryAudio || !activeHistoryButton) return;
  const item = input.closest("[data-audio-item]");
  if (!item || activeHistoryButton.closest("[data-audio-item]") !== item) return;
  if (!Number.isFinite(sharedHistoryAudio.duration) || sharedHistoryAudio.duration <= 0) return;
  sharedHistoryAudio.currentTime = sharedHistoryAudio.duration * (parseFloat(input.value || "0") / 100);
  syncActiveHistoryProgress();
}

function syncActiveHistoryProgress() {
  if (!activeHistoryButton) return;
  const item = activeHistoryButton.closest("[data-audio-item]");
  if (!item) return;
  const current = item.querySelector(".history-audio-current");
  const duration = item.querySelector(".history-audio-duration");
  const progress = item.querySelector(".history-progress");
  const audio = sharedHistoryAudio;
  if (!audio || !current || !duration || !progress) return;
  const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  const durationTime = Number.isFinite(audio.duration) ? audio.duration : 0;
  current.textContent = formatAudioTime(currentTime);
  duration.textContent = formatAudioTime(durationTime);
  progress.value = durationTime > 0 ? ((currentTime / durationTime) * 100).toString() : "0";
}

function openHistoryItem(button) {
  const item = button.closest("[data-audio-item]");
  const bar = item?.querySelector(".history-audio-bar");
  if (item) item.classList.add("is-active");
  if (bar) bar.hidden = false;
}

function resetHistoryItem(button, hideBar) {
  if (!button) return;
  const item = button.closest("[data-audio-item]");
  const bar = item?.querySelector(".history-audio-bar");
  const current = item?.querySelector(".history-audio-current");
  const duration = item?.querySelector(".history-audio-duration");
  const progress = item?.querySelector(".history-progress");
  setHistoryButtonState(button, "idle");
  if (progress) progress.value = "0";
  if (current) current.textContent = "0:00";
  if (duration) duration.textContent = "0:00";
  if (item && hideBar) item.classList.remove("is-active");
  if (bar && hideBar) bar.hidden = true;
}

function setHistoryButtonState(button, state) {
  if (!button) return;
  const icon = button.querySelector(".play-icon");
  const item = button.closest("[data-audio-item]");
  button.dataset.state = state;
  button.setAttribute("aria-label", state === "playing" ? "Tạm dừng audio" : "Phát audio");
  if (icon) icon.textContent = state === "playing" ? "❚❚" : "▶";
  if (item) item.classList.toggle("is-playing", state === "playing");
}

function formatAudioTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatNumber(value) {
  const number = Number(value || 0);
  return number.toLocaleString("vi-VN");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function playUrl(url) {
  const button = [...document.querySelectorAll("[data-audio-url]")].find((x) => x.dataset.audioUrl === url);
  if (button) {
    toggleHistoryAudio(button);
    return;
  }
  const audio = getSharedHistoryAudio();
  const resolvedUrl = new URL(url, window.location.href).href;
  if (audio.src !== resolvedUrl) {
    audio.src = url;
    audio.currentTime = 0;
    audio.play();
    return;
  }
  if (audio.paused) {
    audio.play();
    return;
  }
  audio.pause();
}

function toggleSidebar(show) {
  const s = document.getElementById("sidebar");
  const o = document.getElementById("mobileOverlay");
  if (!s || !o) return;
  s.classList.toggle("open", show);
  o.classList.toggle("show", show);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const confirmModal = document.getElementById("createVoiceConfirmModal");
    if (confirmModal && !confirmModal.hidden) {
      closeCreateVoiceConfirm();
      return;
    }
    const modal = document.getElementById("voicePickerModal");
    if (modal && !modal.hidden) {
      closeVoicePicker();
      return;
    }
    const side = document.getElementById("composerSidePanel");
    if (side && side.classList.contains("is-mobile-visible")) {
      closeMobileComposerPanel();
      return;
    }
    toggleSidebar(false);
  }
});

document.addEventListener("click", (e) => {
  const modal = document.getElementById("voicePickerModal");
  if (modal && !modal.hidden && e.target === modal) closeVoicePicker();
  const confirmModal = document.getElementById("createVoiceConfirmModal");
  if (confirmModal && !confirmModal.hidden && e.target === confirmModal) closeCreateVoiceConfirm();
});

window.addEventListener("resize", () => {
  if (!isMobileComposerViewport()) closeMobileComposerPanel();
});

function copyText(text) {
  navigator.clipboard?.writeText(text).then(() => alert(`Đã sao chép: ${text}`)).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    alert(`Đã sao chép: ${text}`);
  });
}

function confirmCreateVoice() {
  if (bypassVoiceConfirm) {
    bypassVoiceConfirm = false;
    return true;
  }
  const text = document.getElementById("Text");
  const voice = getSelectedVoiceData();
  if (!text) return true;
  const len = text.value.trim().length;
  if (len <= 0) {
    renderIndexMessages({
      ok: false,
      message: "Anh chưa nhập nội dung."
    });
    text.focus();
    return false;
  }
  const rate = voice ? parseFloat(voice.rate) : 1;
  const point = Math.ceil(len * rate);
  openCreateVoiceConfirm({
    characters: len,
    voiceName: voice?.name || "Giọng đã chọn",
    points: point
  });
  return false;
}

function openCreateVoiceConfirm(summary) {
  const modal = document.getElementById("createVoiceConfirmModal");
  if (!modal) return;
  const chars = document.getElementById("confirmVoiceChars");
  const voiceName = document.getElementById("confirmVoiceName");
  const points = document.getElementById("confirmVoicePoints");
  if (chars) chars.textContent = `${formatNumber(summary.characters)} ký tự`;
  if (voiceName) voiceName.textContent = summary.voiceName;
  if (points) points.textContent = `${formatNumber(summary.points)} điểm`;
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeCreateVoiceConfirm() {
  const modal = document.getElementById("createVoiceConfirmModal");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
}

function acceptCreateVoiceConfirm() {
  bypassVoiceConfirm = true;
  closeCreateVoiceConfirm();
  document.getElementById("voiceForm")?.requestSubmit();
}
