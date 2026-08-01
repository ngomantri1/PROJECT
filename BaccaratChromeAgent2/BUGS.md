# Bugs

## Current / not yet live-confirmed

- Automatic re-entry was not observed with runtime 0.1.0 because Chrome ran a cached Service Worker; no `recovery-probe` events were emitted although NativeHost sent pulses.
- Runtime 0.1.1 and a new versioned directory were built to force Service Worker registration, but live recovery after installation is not yet confirmed.
- If no valid table bookmark exists, recovery logs `recovery-skip-no-bookmark` and cannot know which table to reopen.
- If the provider removes `webMain.jsp` entirely, current recovery retries controller/probe failures but has no browser-level navigation fallback.

## Fixed in source/build

- NativeHost emits an independent one-second watchdog pulse.
- Recovery uses live `webMain.jsp` context and three consecutive non-`GAME_TABLE` observations, not stale betting ticks.
- Recovery commands resolve a fresh controller frame before each send and lock checks for 10 seconds after `load_table`.
- Extension version 0.1.1 prevents the previously observed cached 0.1.0 Service Worker from remaining active.

## Evidence locations

- Recovery: `service-worker.js` functions `findLiveRecoveryController`, `handleRecoveryProbeObservation`, `probeRecoveryTab`, `runRecoveryProbeCycle`, `sendRecoveryCommand`.
- Context bridge: `content-bridge.js` function `readFrameRecoveryContext` and `probe_recovery_context` handler.
- Pulse: `NativeHost/Program.cs` watchdog task.
- Log: `%LocalAppData%\\BaccaratChromeAgent\\logs\\YYYYMMDD.log`.
