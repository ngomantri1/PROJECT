"""Stable, privacy-preserving device identity for license activation."""

from __future__ import annotations

import hashlib
import json
import os
import platform
import subprocess
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


def baccarat_chrome_agent_device_fingerprint() -> str:
    """Match BaccaratChromeAgent2's legacy Worker ``deviceId`` algorithm.

    The raw hardware values never leave this function.  Only the SHA-256 hash
    is returned to the lease Worker, matching the C# reference implementation.
    """

    parts = [_windows_machine_guid()]
    if os.name == "nt":
        command = (
            "$disk=(Get-CimInstance Win32_PhysicalMedia -ErrorAction SilentlyContinue "
            "| Select-Object -First 1 -ExpandProperty SerialNumber);"
            "if([string]::IsNullOrWhiteSpace($disk)){$disk=(Get-CimInstance Win32_DiskDrive "
            "-ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty SerialNumber)};"
            "$mac=([System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() "
            "| Where-Object {$_.NetworkInterfaceType -ne [System.Net.NetworkInformation.NetworkInterfaceType]::Loopback "
            "-and $_.OperationalStatus -eq [System.Net.NetworkInformation.OperationalStatus]::Up} "
            "| Select-Object -First 1).GetPhysicalAddress().ToString();"
            "[pscustomobject]@{uuid=(Get-CimInstance Win32_ComputerSystemProduct -ErrorAction SilentlyContinue "
            "| Select-Object -First 1 -ExpandProperty UUID);cpu=(Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue "
            "| Select-Object -First 1 -ExpandProperty ProcessorId);disk=$disk;mac=$mac} | ConvertTo-Json -Compress"
        )
        try:
            completed = subprocess.run(
                ["powershell", "-NoProfile", "-NonInteractive", "-Command", command],
                capture_output=True,
                text=True,
                timeout=8,
                check=False,
            )
            if completed.returncode == 0 and completed.stdout.strip():
                values = json.loads(completed.stdout)
                parts.extend(
                    str(values.get(key) or "").strip()
                    for key in ("uuid", "cpu", "disk", "mac")
                )
        except (OSError, subprocess.SubprocessError, ValueError, json.JSONDecodeError):
            pass
    raw = "|".join(part for part in parts if part)
    if not raw:
        raw = platform.node() or "unknown-device"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
