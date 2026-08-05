# Bugs

## Open

- Automatic re-entry after the provider leaves `singleBacTable.jsp` is not implemented in this WebView2 project; stale accepted display state can remain while the game iframe is gone.
- C# records pending bets optimistically. JS `ok=0`, zero delta or partial split can still be followed by network settlement and produce an incorrect history result.
- A split bet can place only part of the requested amount when a later denomination does not reflect on the target side.
- Long-running gray/frozen WebView behavior has not been reproduced with a complete incident log; the current sample does not establish a renderer crash.
- Reset settlement and rare multi-match pending-row cases still require live confirmation.

## Fixed or mitigated

- `gamehall.jsp` is excluded from real sequence authority after bootstrap.
- Phase/bootstrap guards and `prog >= 3` reduce early bet sends.
- JS DOM split placement retries and checks visible stake movement before confirmation.
- Popup watchdog checks `HasRecentGameSignal(...)` before navigating away from a wrapper URL.
- WebView2 process-failure diagnostics record process kind and optional reason/exit information.
- Reset pending rows carry target table/shoe/round information; ambiguous multi-match settlement is held instead of written as `RESET-DUP`.

## Evidence locations

- Main logic: `MainWindow.xaml.cs`, including `ArmPopupTransitWatch(...)`, `HasRecentGameSignal(...)`, `FinalizeLastBet(...)` and reset helpers.
- Bridge: `WebView2LiveBridge.cs`.
- Provider/bet runtime: `v4_js_xoc_dia_live.js`, especially `cwBet(...)` and the bet queue.
- Logs: `%LocalAppData%\\BaccaratSexyCasino3\\logs`.
