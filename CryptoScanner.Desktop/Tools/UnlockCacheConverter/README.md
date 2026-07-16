# UnlockCacheConverter

Converts manually collected unlock data into CryptoScanner `unlock-cache.json` schema `1.0`.

This tool does not call APIs, does not scrape websites, and does not copy the output into AppData. Import the generated file with the app's `IMPORT UNLOCK` button.

## CSV input

Required columns:

```text
coin_id,symbol,unlock_30d_pct,unlock_90d_pct
```

Recommended columns:

```text
next_unlock_at,percentage_basis,source,source_url,verified_at,confidence
```

`percentage_basis` must be:

```text
CURRENT_CIRCULATING_SUPPLY
```

## Usage

```powershell
dotnet run --project .\Tools\UnlockCacheConverter -- `
  --input .\test-data\unlock-import\manual-real-unlock-test.csv `
  --output .\test-data\unlock-import\converted-unlock-cache.json `
  --updated-at 2026-07-16T04:30:00+07:00
```

Then import `converted-unlock-cache.json` in the desktop app.

## Validation

The converter rejects:

- Missing both `coin_id` and `symbol`.
- Missing `unlock_30d_pct` or `unlock_90d_pct`.
- Percentages outside 0-100.
- `unlock_90d_pct < unlock_30d_pct`.
- Duplicate `coin_id`.
- Duplicate `symbol`.
- `percentage_basis` other than `CURRENT_CIRCULATING_SUPPLY`.

