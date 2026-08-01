# Current State

Updated: 2026-08-01

`BaccaratChromeAgent2` is the Chrome successor. WPF/C# communicates with a Manifest V3 extension through Native Messaging; the extension injects the legacy provider runtime and bridges ticks, bets, recovery and display state.

Confirmed: extension version is `0.1.1`; NativeHost emits `watchdog_pulse` every second; the service worker resolves live `/player/webMain.jsp` and probes its iframe context; three consecutive non-`GAME_TABLE` observations start recovery; each recovery command resolves a fresh controller frame; `load_table` locks probes for 10 seconds.

The pre-`0.1.1` failure was confirmed as a cached `0.1.0` Service Worker: NativeHost emitted pulses but logs had no `recovery-probe`. JavaScript/.NET/release verification passed and `artifacts/installer/BaccaratChromeAgent-Setup-0.1.1.exe` was created. Live recovery after installing 0.1.1 remains to be confirmed.

Continue with `ARCHITECTURE.md`, `TODO.md`, `BUGS.md` and `%LocalAppData%\\BaccaratChromeAgent\\logs\\YYYYMMDD.log`.
