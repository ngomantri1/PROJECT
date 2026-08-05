# Current State

Updated: 2026-08-01

`BaccaratSexyCasino3` is the legacy WPF/WebView2 application. C# owns UI, authority selection, sequence/history and task execution; `v4_js_xoc_dia_live.js` collects provider data, exposes Canvas Watch and executes queued bets.

Confirmed: `singleBacTable.jsp` is preferred for live data; `gamehall.jsp` is lobby context only; post-bootstrap sequence append is CDP/network-first; bet gating includes bootstrap/changing-shoe guards and `prog >= 3`; JS chip splits validate visible stake movement; WebView2 process-failure diagnostics are enabled; popup recovery checks `HasRecentGameSignal(...)` before navigating away.

Not confirmed: a renderer crash has not been proven by the supplied short log, and complete automatic re-entry after a provider context drop is not implemented in this project. Pending/history is still optimistic until JS proves actual placement.

Continue with `ARCHITECTURE.md`, `MainWindow.xaml.cs`, `WebView2LiveBridge.cs`, `v4_js_xoc_dia_live.js` and `%LocalAppData%\\BaccaratSexyCasino3\\logs`.
