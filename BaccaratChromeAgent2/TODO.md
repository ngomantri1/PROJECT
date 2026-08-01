# TODO

## Highest priority

- Install `artifacts/installer/BaccaratChromeAgent-Setup-0.1.1.exe` and perform a real out-to-hall test.
- Confirm: `watchdog-pulse-received` -> `recovery-probe` -> `recovery-probe-stale` -> `recovery-start` -> `recovery-command` -> `recovery-success-game-context`.
- If recovery starts but does not enter the table, inspect `recovery-controller-resolve-failed`, `recovery-command-delivery-failed` and `recovery-result`.
- Validate a table card outside the visible scroll area and a recreated `webMain` frame.

## Code cleanup

- Remove the deprecated push-context handler from `service-worker.js` after live validation; it is currently unreachable compatibility scaffolding.
- Add probe tab-count/frame diagnostics if 0.1.1 still produces no probe entries.
- Reconsider table bookmark fallback when provider ticks expose an invalid/zero table ID.

## Cross-project

- Port only confirmed recovery behavior to `BaccaratSexyCasino2` after ChromeAgent live validation; do not copy NativeHost architecture into WebView2 without a separate design decision.
