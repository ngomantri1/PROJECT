"""Signed license lease contracts shared by the client and license server."""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Iterable

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def format_utc(value: datetime) -> str:
    aware = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return aware.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def canonical_json(payload: dict[str, Any]) -> bytes:
    return json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


class LicenseStatus(str, Enum):
    DISABLED = "disabled"
    VALID = "valid"
    GRACE = "grace"
    EXPIRED = "expired"
    REVOKED = "revoked"
    DEVICE_MISMATCH = "device_mismatch"
    CAPABILITY_MISSING = "capability_missing"
    INVALID_SIGNATURE = "invalid_signature"
    UNAVAILABLE = "unavailable"
    ACCOUNT_IN_USE = "account_in_use"
    LOGGED_OUT = "logged_out"


@dataclass(frozen=True, slots=True)
class LicenseLease:
    lease_id: str
    account_id: str
    username: str
    plan: str
    capabilities: frozenset[str]
    device_id: str
    issued_at: datetime
    expires_at: datetime
    refresh_until: datetime

    @classmethod
    def from_claims(cls, claims: dict[str, Any]) -> "LicenseLease":
        required = (
            "lease_id",
            "account_id",
            "username",
            "plan",
            "device_id",
            "issued_at",
            "expires_at",
            "refresh_until",
        )
        if any(not str(claims.get(key) or "").strip() for key in required):
            raise ValueError("lease claims are incomplete")
        capabilities = frozenset(
            str(value).strip()
            for value in claims.get("capabilities") or []
            if str(value).strip()
        )
        issued_at = parse_utc(str(claims["issued_at"]))
        expires_at = parse_utc(str(claims["expires_at"]))
        refresh_until = parse_utc(str(claims["refresh_until"]))
        if not issued_at < expires_at <= refresh_until:
            raise ValueError("lease timestamps are inconsistent")
        return cls(
            lease_id=str(claims["lease_id"]),
            account_id=str(claims["account_id"]),
            username=str(claims["username"]),
            plan=str(claims["plan"]),
            capabilities=capabilities,
            device_id=str(claims["device_id"]),
            issued_at=issued_at,
            expires_at=expires_at,
            refresh_until=refresh_until,
        )

    def to_claims(self) -> dict[str, Any]:
        return {
            "lease_id": self.lease_id,
            "account_id": self.account_id,
            "username": self.username,
            "plan": self.plan,
            "capabilities": sorted(self.capabilities),
            "device_id": self.device_id,
            "issued_at": format_utc(self.issued_at),
            "expires_at": format_utc(self.expires_at),
            "refresh_until": format_utc(self.refresh_until),
        }


@dataclass(frozen=True, slots=True)
class SignedLease:
    claims: dict[str, Any]
    signature: str
    algorithm: str = "Ed25519"

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "SignedLease":
        if str(raw.get("algorithm") or "") != "Ed25519":
            raise ValueError("unsupported lease signature algorithm")
        claims = raw.get("claims")
        if not isinstance(claims, dict):
            raise ValueError("lease claims are missing")
        signature = str(raw.get("signature") or "")
        if not signature:
            raise ValueError("lease signature is missing")
        return cls(claims=dict(claims), signature=signature)

    def to_dict(self) -> dict[str, Any]:
        return {
            "algorithm": self.algorithm,
            "claims": dict(self.claims),
            "signature": self.signature,
        }


@dataclass(frozen=True, slots=True)
class LicenseDecision:
    allowed: bool
    status: LicenseStatus
    reason: str
    capability: str = ""
    lease: LicenseLease | None = None

    def to_dict(self) -> dict[str, Any]:
        lease = self.lease
        return {
            "allowed": self.allowed,
            "status": self.status.value,
            "reason": self.reason,
            "capability": self.capability,
            "username": lease.username if lease else "",
            "plan": lease.plan if lease else "",
            "capabilities": sorted(lease.capabilities) if lease else [],
            "device_id": lease.device_id if lease else "",
            "expires_at": format_utc(lease.expires_at) if lease else "",
            "refresh_until": format_utc(lease.refresh_until) if lease else "",
        }


def generate_ed25519_keypair() -> tuple[bytes, bytes]:
    private_key = Ed25519PrivateKey.generate()
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return private_pem, public_pem


def sign_lease(
    private_key_pem: bytes,
    *,
    lease_id: str,
    account_id: str,
    username: str,
    plan: str,
    capabilities: Iterable[str],
    device_id: str,
    issued_at: datetime,
    expires_at: datetime,
    refresh_until: datetime,
) -> SignedLease:
    lease = LicenseLease(
        lease_id=lease_id,
        account_id=account_id,
        username=username,
        plan=plan,
        capabilities=frozenset(str(value) for value in capabilities),
        device_id=device_id,
        issued_at=issued_at,
        expires_at=expires_at,
        refresh_until=refresh_until,
    )
    claims = lease.to_claims()
    private_key = serialization.load_pem_private_key(
        private_key_pem, password=None
    )
    if not isinstance(private_key, Ed25519PrivateKey):
        raise ValueError("license private key must be Ed25519")
    signature = private_key.sign(canonical_json(claims))
    return SignedLease(
        claims=claims,
        signature=base64.urlsafe_b64encode(signature).decode("ascii"),
    )


def verify_signed_lease(
    signed: SignedLease | dict[str, Any],
    public_key_pem: bytes,
) -> LicenseLease:
    envelope = (
        signed if isinstance(signed, SignedLease) else SignedLease.from_dict(signed)
    )
    public_key = serialization.load_pem_public_key(public_key_pem)
    if not isinstance(public_key, Ed25519PublicKey):
        raise ValueError("license public key must be Ed25519")
    try:
        signature = base64.urlsafe_b64decode(envelope.signature.encode("ascii"))
        public_key.verify(signature, canonical_json(envelope.claims))
    except (InvalidSignature, ValueError) as exc:
        raise ValueError("license signature is invalid") from exc
    return LicenseLease.from_claims(envelope.claims)
