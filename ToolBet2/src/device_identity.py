"""Stable, privacy-preserving device identity for license activation."""

from __future__ import annotations

import hashlib
import os
import platform
import uuid


def _windows_machine_guid() -> str:
    if os.name != "nt":
        return ""
    try:
        import winreg

        with winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r"SOFTWARE\Microsoft\Cryptography",
            0,
            winreg.KEY_READ | winreg.KEY_WOW64_64KEY,
        ) as key:
            value, _ = winreg.QueryValueEx(key, "MachineGuid")
            return str(value or "")
    except OSError:
        return ""


def device_fingerprint(*, namespace: str = "toolbet-v2") -> str:
    """Return a one-way identifier; raw hardware values never leave this function."""

    machine = _windows_machine_guid()
    fallback = "|".join(
        (
            platform.node(),
            platform.machine(),
            platform.system(),
            str(uuid.getnode()),
        )
    )
    material = f"{namespace}|{machine or fallback}".encode("utf-8")
    return hashlib.sha256(material).hexdigest()
