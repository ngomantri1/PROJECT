"""Manage and run the ToolBet license authority.

The server directory/private key must be deployed separately from customer builds.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.license_contracts import generate_ed25519_keypair, utc_now
from src.license_server import LicenseAuthorityError, LicenseAuthorityStore


def _authority(args) -> LicenseAuthorityStore:
    private_path = Path(args.private_key)
    if not private_path.exists():
        raise SystemExit("Missing private key; run license_server.py init first")
    return LicenseAuthorityStore(
        args.database,
        private_key_pem=private_path.read_bytes(),
        lease_minutes=args.lease_minutes,
        refresh_days=args.refresh_days,
    )


def command_init(args) -> None:
    private_path = Path(args.private_key)
    public_path = Path(args.public_key)
    if private_path.exists() or public_path.exists():
        raise SystemExit("Refusing to overwrite an existing license key")
    private_pem, public_pem = generate_ed25519_keypair()
    private_path.parent.mkdir(parents=True, exist_ok=True)
    public_path.parent.mkdir(parents=True, exist_ok=True)
    private_path.write_bytes(private_pem)
    public_path.write_bytes(public_pem)
    print(f"Private key: {private_path} (SERVER ONLY)")
    print(f"Public key:  {public_path} (copy to ToolBet clients)")


def command_account(args) -> None:
    password = os.environ.get("TOOLBET_LICENSE_PASSWORD", "")
    if not password:
        raise SystemExit("Set TOOLBET_LICENSE_PASSWORD for this command")
    authority = _authority(args)
    account_id = authority.upsert_account(
        args.username,
        password,
        plan=args.plan,
        capabilities=[
            value.strip()
            for value in args.capabilities.split(",")
            if value.strip()
        ],
        expires_at=utc_now() + timedelta(days=args.days),
        max_devices=args.max_devices,
    )
    print(f"Account ready: {args.username} ({account_id})")


def command_revoke(args) -> None:
    if not _authority(args).revoke_account(args.username):
        raise SystemExit("Account not found")
    print(f"Revoked: {args.username}")


def command_release_device(args) -> None:
    if not _authority(args).release_device(args.username, args.device_id):
        raise SystemExit("Account/device not found or already released")
    print(f"Released device for {args.username}: {args.device_id}")


def command_serve(args) -> None:
    authority = _authority(args)

    class Handler(BaseHTTPRequestHandler):
        server_version = "ToolBetLicense/1"

        def log_message(self, format, *values):
            print(f"{self.address_string()} - {format % values}")

        def _json(self, status: int, payload: dict) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            try:
                length = min(int(self.headers.get("Content-Length") or 0), 65536)
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                if self.path == "/v1/auth/login":
                    result = authority.authenticate(
                        str(payload.get("username") or ""),
                        str(payload.get("password") or ""),
                        str(payload.get("device_id") or ""),
                    )
                    self._json(200, result.to_dict())
                elif self.path == "/v1/auth/refresh":
                    result = authority.refresh(
                        str(payload.get("refresh_token") or ""),
                        str(payload.get("device_id") or ""),
                    )
                    self._json(200, result.to_dict())
                elif self.path == "/v1/auth/logout":
                    authority.logout(
                        str(payload.get("refresh_token") or ""),
                        str(payload.get("device_id") or ""),
                    )
                    self._json(200, {"ok": True})
                else:
                    self._json(404, {"code": "not_found", "error": "Not found"})
            except LicenseAuthorityError as exc:
                self._json(
                    exc.http_status,
                    {"code": exc.code, "error": str(exc)},
                )
            except (ValueError, json.JSONDecodeError):
                self._json(
                    400, {"code": "bad_request", "error": "Invalid request"}
                )

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"License server listening on http://{args.host}:{args.port}")
    print("Use a TLS reverse proxy for any non-local deployment.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser()
    root.add_argument("--database", default="server_data/license.db")
    root.add_argument("--private-key", default="server_data/license_private.pem")
    root.add_argument("--public-key", default="server_data/license_public.pem")
    root.add_argument("--lease-minutes", type=int, default=15)
    root.add_argument("--refresh-days", type=int, default=30)
    commands = root.add_subparsers(dest="command", required=True)
    init = commands.add_parser("init")
    init.set_defaults(func=command_init)
    account = commands.add_parser("account")
    account.add_argument("username")
    account.add_argument("--plan", default="pilot")
    account.add_argument(
        "--capabilities", default="workspace,simulation,live_bet"
    )
    account.add_argument("--days", type=int, default=30)
    account.add_argument("--max-devices", type=int, default=1)
    account.set_defaults(func=command_account)
    revoke = commands.add_parser("revoke")
    revoke.add_argument("username")
    revoke.set_defaults(func=command_revoke)
    release = commands.add_parser("release-device")
    release.add_argument("username")
    release.add_argument("device_id")
    release.set_defaults(func=command_release_device)
    serve = commands.add_parser("serve")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8765)
    serve.set_defaults(func=command_serve)
    return root


if __name__ == "__main__":
    args = parser().parse_args()
    args.func(args)
