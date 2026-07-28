# A6 release checks

Run `verify-release.ps1` before every release. It validates the runtime hash,
fixed extension ID, absence of private-key files, and (when `-InstallRoot` is
provided) the Native Host allowed origin.

Manual acceptance checks for every Setup build:

1. Clean Windows user: install Setup, open Desktop, choose `Dang Nhap Tool`.
   Chrome must open with the Tool profile and Desktop must show game data.
   `chrome://extensions` must not be required.
2. Close Desktop and reopen it. The ChromeProfile session must still be present.
3. Build a later manifest version, install the newer Setup, close the Tool
   Chrome window, then open Desktop. The active runtime must be
   `extension\v<new-version>`.
4. Change one file below the active runtime directory. Desktop must reject it
   with the checksum status before Chrome starts.
5. Confirm the installed Native Host manifest allows only the extension ID in
   `extension-runtime.json`.
6. On a managed machine, set or receive a policy that blocks command-line
   extensions. Desktop must show the policy status, including the policy name,
   rather than waiting for a bridge handshake.
