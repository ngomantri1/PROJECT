# ToolBet License Deployment

## Security boundary

- `scripts/license_server.py` and the Ed25519 **private key** belong only on the
  license server.
- Customer builds receive only the Ed25519 public key.
- ToolBet stores the signed lease and refresh token with Windows DPAPI. The
  cached payload is also bound to the hashed device identity.
- Production traffic must use HTTPS. Plain HTTP is accepted only for
  `localhost` development.

Do not copy `server_data/`, the server database or the private key into a
customer package.

## 1. Initialize the authority

Run on the license server:

```powershell
cd D:\PROJECT\ToolBet2
.\.venv\Scripts\python.exe .\scripts\license_server.py init
```

This creates:

- `server_data/license_private.pem` — server only.
- `server_data/license_public.pem` — copy to each customer build as
  `data/license_public.pem`.

Existing keys are never overwritten by the command.

## 2. Create or extend an account

The password is passed through an environment variable so it is not stored in
shell history:

```powershell
$env:TOOLBET_LICENSE_PASSWORD = "a-strong-customer-password"
.\.venv\Scripts\python.exe .\scripts\license_server.py account customer01 `
  --plan pilot `
  --capabilities workspace,simulation,live_bet `
  --days 30 `
  --max-devices 1
Remove-Item Env:TOOLBET_LICENSE_PASSWORD
```

Plans are labels. Capabilities are the actual gates:

- `workspace` — pass Tool Login and open the Game Login/workspace.
- `simulation` — reserved for simulation plan enforcement.
- `live_bet` — permit RiskDecision to approve a real bet.

Passwords are PBKDF2-SHA256 hashes. Refresh tokens are stored by SHA-256 hash.

## 3. Run the server

Local pilot:

```powershell
.\.venv\Scripts\python.exe .\scripts\license_server.py serve `
  --host 127.0.0.1 `
  --port 8765
```

For customer deployment, put this service behind an HTTPS reverse proxy and
point `license.api_url` to that HTTPS endpoint. Do not expose the development
HTTP endpoint to the Internet.

## 4. Enable the customer client

Copy only the public key to `data/license_public.pem`, then configure:

```yaml
license:
  enabled: true
  api_url: "https://license.example.com"
  public_key_path: "data/license_public.pem"
  cache_path: "data/license_session.bin"
  timeout_seconds: 8
  grace_minutes: 60
  refresh_before_minutes: 5
```

When `license.enabled: false`, the existing local Tool account remains available
for development. A release/pilot package should set it to `true`.

## 5. Revoke and release devices

Revoke the complete account/license:

```powershell
.\.venv\Scripts\python.exe .\scripts\license_server.py revoke customer01
```

Release one activation slot:

```powershell
.\.venv\Scripts\python.exe .\scripts\license_server.py release-device `
  customer01 DEVICE_ID
```

The workspace header displays the current plan/status. The license server
checks revoke during refresh. When blocked, ToolBet disables and demotes live
authority immediately. If a bet is already pending, it keeps the collector
alive until that result is resolved and persisted, then exits the Game session.

## Lease behavior

- Default signed lease: 15 minutes.
- Default refresh lifetime: 30 days, bounded by entitlement expiry.
- Refresh tokens rotate on every successful refresh.
- Offline grace is bounded by both client configuration and the signed
  `refresh_until`.
- Invalid signature, device mismatch, explicit revoke and capability mismatch
  fail closed.

## 6. BaccaratChromeAgent2 compatibility provider

When the operational license is managed by the existing BaccaratChromeAgent2
deployment, ToolBet can use the same GitHub records and Cloudflare Worker
single-device lease:

```yaml
license:
  enabled: true
  provider: "baccarat_chrome_agent2"
  github_raw_base_url: "https://raw.githubusercontent.com"
  github_owner: "ngomantri1"
  github_repo: "licenses"
  github_branch: "main"
  github_license_path: "auto"
  lease_base_url: "https://net88.ngomantri1.workers.dev/lease/auto"
  lease_app_id: "BaccaratChromeAgent"
  heartbeat_seconds: 600
```

The client reads `auto/{username}.json` (`exp` and `pass`), acquires the
account lease, sends heartbeats, and releases it on logout. Passwords,
session/client identifiers and the one-way device fingerprint remain in
memory only. This provider is fail-closed: loss of the Worker lease or an
expired GitHub record blocks `live_bet`; it does not use the signed-license
offline grace path.
