(() => {
  const KEY = "__resultWsProbe";
  if (window[KEY] && typeof window[KEY].stop === "function") {
    window[KEY].stop();
  }

  const state = {
    origDispatch: null,
    panel: null,
    hits: [],
    lastSig: "",
    installedAt: Date.now()
  };

  function ensurePanel() {
    if (state.panel) return state.panel;
    const el = document.createElement("div");
    el.style.cssText = [
      "position:fixed",
      "top:12px",
      "right:12px",
      "z-index:2147483647",
      "min-width:420px",
      "max-width:980px",
      "padding:10px 12px",
      "background:rgba(0,0,0,.86)",
      "color:#9ff7c2",
      "font:12px/1.45 Consolas,Menlo,monospace",
      "white-space:pre-wrap",
      "border:1px solid rgba(120,255,180,.45)",
      "border-radius:8px"
    ].join(";");
    document.body.appendChild(el);
    state.panel = el;
    return el;
  }

  function render() {
    const panel = ensurePanel();
    const last = state.hits[0] || null;
    const lines = [
      "Result sequence WS probe",
      "Hits: " + state.hits.length
    ];
    if (last) {
      lines.push("URL: " + last.url);
      lines.push("Path: " + last.path);
      lines.push("Seq: " + last.seq.join("-"));
      lines.push("Raw: " + last.preview);
    } else {
      lines.push("Chưa thấy candidate sequence.");
    }
    lines.push("");
    lines.push("API:");
    lines.push("- __resultWsProbe.report()");
    lines.push("- __resultWsProbe.hits()");
    lines.push("- __resultWsProbe.clear()");
    lines.push("- __resultWsProbe.stop()");
    panel.textContent = lines.join("\n");
  }

  function isSmallIntResult(v) {
    if (typeof v === "number") return Number.isInteger(v) && v >= 3 && v <= 18;
    if (typeof v === "string" && /^\d{1,2}$/.test(v)) {
      const n = parseInt(v, 10);
      return n >= 3 && n <= 18;
    }
    return false;
  }

  function toInt(v) {
    return typeof v === "number" ? v : parseInt(v, 10);
  }

  function findSequences(value, path, out, seen) {
    if (out.length >= 40) return;
    if (!value) return;
    if (typeof value === "object") {
      if (seen.has(value)) return;
      seen.add(value);
    }

    if (Array.isArray(value)) {
      if (value.length >= 3 && value.every(isSmallIntResult)) {
        out.push({
          path: path || "$",
          seq: value.map(toInt)
        });
      }
      for (let i = 0; i < value.length; i += 1) {
        findSequences(value[i], (path || "$") + "[" + i + "]", out, seen);
      }
      return;
    }

    if (typeof value === "string") {
      const nums = value.match(/\d{1,2}/g);
      if (nums && nums.length >= 3) {
        const ints = nums.map(x => parseInt(x, 10)).filter(n => n >= 3 && n <= 18);
        if (ints.length >= 3) {
          out.push({
            path: path || "$",
            seq: ints
          });
        }
      }
      return;
    }

    if (typeof value === "object") {
      const keys = Object.keys(value);
      for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i];
        findSequences(value[k], (path || "$") + "." + k, out, seen);
      }
    }
  }

  function previewOf(obj) {
    try {
      const s = JSON.stringify(obj);
      return s.length > 260 ? s.slice(0, 260) + "..." : s;
    } catch (_) {
      return String(obj);
    }
  }

  function pushHit(url, path, seq, raw) {
    const sig = url + "|" + path + "|" + seq.join(",");
    if (sig === state.lastSig) return;
    state.lastSig = sig;
    state.hits.unshift({
      at: new Date().toISOString(),
      url,
      path,
      seq: seq.slice(),
      preview: previewOf(raw)
    });
    if (state.hits.length > 60) state.hits.length = 60;
    render();
  }

  function handleText(url, text) {
    if (!text || typeof text !== "string") return;
    let raw = null;
    try {
      raw = JSON.parse(text);
    } catch (_) {
      const seqs = [];
      findSequences(text, "$", seqs, new Set());
      for (let i = 0; i < seqs.length; i += 1) {
        pushHit(url, seqs[i].path, seqs[i].seq, text);
      }
      return;
    }

    const seqs = [];
    findSequences(raw, "$", seqs, new Set());
    for (let i = 0; i < seqs.length; i += 1) {
      pushHit(url, seqs[i].path, seqs[i].seq, raw);
    }
  }

  function install() {
    const proto = window.WebSocket && window.WebSocket.prototype;
    if (!proto || typeof proto.dispatchEvent !== "function") {
      console.warn("[result-ws-probe] WebSocket.prototype.dispatchEvent not available");
      render();
      return false;
    }

    state.origDispatch = proto.dispatchEvent;
    proto.dispatchEvent = function patchedDispatch(ev) {
      try {
        if (ev && ev.type === "message") {
          const url = String((this && this.url) || "");
          const data = ev.data;
          if (typeof data === "string") {
            handleText(url, data);
          }
        }
      } catch (_) {}
      return state.origDispatch.apply(this, arguments);
    };
    return true;
  }

  function report() {
    console.table(state.hits.map((h, i) => ({
      "#": i,
      at: h.at,
      path: h.path,
      seq: h.seq.join("-"),
      url: h.url,
      raw: h.preview
    })));
    return state.hits.slice();
  }

  function clear() {
    state.hits = [];
    state.lastSig = "";
    render();
  }

  function stop() {
    try {
      if (window.WebSocket && window.WebSocket.prototype && state.origDispatch) {
        window.WebSocket.prototype.dispatchEvent = state.origDispatch;
      }
    } catch (_) {}
    state.origDispatch = null;
    if (state.panel) {
      try {
        state.panel.remove();
      } catch (_) {}
      state.panel = null;
    }
  }

  window[KEY] = {
    report,
    hits() {
      return state.hits.slice();
    },
    clear,
    stop
  };

  install();
  render();
  console.log("[result-ws-probe] started");
})();
