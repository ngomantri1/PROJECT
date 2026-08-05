# TODO

## Highest priority

- Confirm a 30k split places the full amount and produces `[BETQ][DONE] ok=1` with the expected visible delta.
- Reconcile C# pending/history with JS execution so `ok=0`, `delta=0` or partial placement cannot finalize as a full bet.
- Capture a complete gray/frozen WebView incident with `[Web][PROCESS-FAILED]`, `[PopupWeb][PROCESS-FAILED]` and `[PopupWeb][STUCK-*]` markers.
- Implement and validate automatic re-entry when the provider leaves the game iframe. This WebView2 project does not contain the ChromeAgent pull-probe mechanism.

## Sequence and settlement

- Retest shoe-change, same-shoe shuffle reset, winner-shoe-change and late `TARGET-RETARGET` paths.
- Confirm `AwaitingFinalWinnerAfterShoeReset`, `SettleTargetTableId/Shoe/Round` and ambiguous multi-match behavior.
- Retest DOM bootstrap plus CDP/network-only append when DOM and network disagree.

## Betting and strategy

- Keep the JS stale-round drop disabled during the current test window; decide the long-term policy later.
- Verify chip 10k scanning/placement and the 20k+10k split path.
- Soak-test strategy 18 (`SmartPrevAdvancedTask`) against its documented `seg1/seg3` rules.

## Refactoring

- Split authority/context reset, roadInfo sequence state and pending settlement out of `MainWindow.xaml.cs`.
