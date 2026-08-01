# Architecture

## Modules

- `src/BaccaratChromeAgent.Desktop`: WPF control panel and launcher.
- `src/BaccaratChromeAgent.Engine`: C# session/state and business logic.
- `src/BaccaratChromeAgent.Protocol`: Native Messaging and desktop-pipe models.
- `src/BaccaratChromeAgent.NativeHost/Program.cs`: Native Messaging, desktop pipe and watchdog pulse.
- `src/BaccaratChromeAgent.Extension/service-worker.js`: bridge, frame routing, bookmarks and recovery state machine.
- `src/BaccaratChromeAgent.Extension/content-bridge.js`: isolated-world bridge and context probe response.
- `src/BaccaratChromeAgent.Extension/legacy-v4_js_xoc_dia_live.js`: copied legacy provider runtime.

## Recovery flow

1. NativeHost sends `watchdog_pulse` every second.
2. Service worker resolves `/player/webMain.jsp` with `chrome.webNavigation.getAllFrames(...)`.
3. It sends `probe_recovery_context` to that exact frame.
4. `content-bridge.js` classifies visible `iframeGame`/`iframeGameHall` state.
5. Three consecutive non-`GAME_TABLE` observations start recovery.
6. `detect`, `go_hall` and `load_table` each resolve the controller again before sending.
7. A `GAME_TABLE` probe clears misses and completes recovery.

`GAME_HALL` is the table-list state; `GAME_TABLE` is the active game state. Recovery is separate from betting ticks. The 10-second `RECOVERY_CHECK_LOCK_MS` protects table loading.
