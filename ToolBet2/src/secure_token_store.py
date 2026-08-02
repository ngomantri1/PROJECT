"""Windows DPAPI storage for refresh tokens with a testable fallback."""

from __future__ import annotations

import base64
import ctypes
import json
import os
from ctypes import wintypes
from pathlib import Path


class _DataBlob(ctypes.Structure):
    _fields_ = [
        ("cbData", wintypes.DWORD),
        ("pbData", ctypes.POINTER(ctypes.c_byte)),
    ]


def _blob(data: bytes) -> tuple[_DataBlob, ctypes.Array]:
    buffer = ctypes.create_string_buffer(data)
    return (
        _DataBlob(
            len(data),
            ctypes.cast(buffer, ctypes.POINTER(ctypes.c_byte)),
        ),
        buffer,
    )


def _dpapi_protect(data: bytes) -> bytes:
    source, source_buffer = _blob(data)
    output = _DataBlob()
    if not ctypes.windll.crypt32.CryptProtectData(
        ctypes.byref(source),
        "ToolBet License",
        None,
        None,
        None,
        0x01,
        ctypes.byref(output),
    ):
        raise ctypes.WinError()
    try:
        return ctypes.string_at(output.pbData, output.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(output.pbData)
        del source_buffer


def _dpapi_unprotect(data: bytes) -> bytes:
    source, source_buffer = _blob(data)
    output = _DataBlob()
    if not ctypes.windll.crypt32.CryptUnprotectData(
        ctypes.byref(source),
        None,
        None,
        None,
        None,
        0x01,
        ctypes.byref(output),
    ):
        raise ctypes.WinError()
    try:
        return ctypes.string_at(output.pbData, output.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(output.pbData)
        del source_buffer


class SecureTokenStore:
    def __init__(self, path: str | Path, *, allow_plaintext_for_tests: bool = False):
        self.path = Path(path)
        self._allow_plaintext = bool(allow_plaintext_for_tests)

    def save(self, payload: dict) -> None:
        raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        if os.name == "nt":
            protected = _dpapi_protect(raw)
            envelope = {
                "version": 1,
                "protection": "windows-dpapi",
                "data": base64.b64encode(protected).decode("ascii"),
            }
        elif self._allow_plaintext:
            envelope = {
                "version": 1,
                "protection": "test-only",
                "data": base64.b64encode(raw).decode("ascii"),
            }
        else:
            raise RuntimeError("secure token storage requires Windows DPAPI")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(envelope), encoding="utf-8")

    def load(self) -> dict | None:
        if not self.path.exists():
            return None
        try:
            envelope = json.loads(self.path.read_text(encoding="utf-8"))
            protected = base64.b64decode(str(envelope["data"]), validate=True)
            if envelope.get("protection") == "windows-dpapi" and os.name == "nt":
                raw = _dpapi_unprotect(protected)
            elif envelope.get("protection") == "test-only" and self._allow_plaintext:
                raw = protected
            else:
                return None
            payload = json.loads(raw.decode("utf-8"))
            return payload if isinstance(payload, dict) else None
        except (OSError, ValueError, KeyError, json.JSONDecodeError):
            return None

    def clear(self) -> None:
        if self.path.exists():
            self.path.unlink()
