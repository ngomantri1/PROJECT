; Build with installer\build-installer.ps1. ExtensionId comes from manifest.key.
#ifndef ExtensionId
  #error ExtensionId is required.
#endif
#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif

#define AppName "Baccarat Chrome Agent"
#define HostName "com.abx.baccarat_chrome_agent"

[Setup]
AppId={{E5AC8206-4F5A-4E76-909A-7F6D4A0BCAA1}
AppName={#AppName}
AppVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\BaccaratChromeAgent
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir=..\artifacts\installer
OutputBaseFilename=BaccaratChromeAgent-Setup-{#AppVersion}
Compression=lzma
SolidCompression=yes
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible

[Files]
Source: "..\artifacts\publish\desktop\*"; DestDir: "{app}\desktop"; Flags: recursesubdirs ignoreversion
Source: "..\artifacts\publish\nativehost\*"; DestDir: "{app}\nativehost"; Flags: recursesubdirs ignoreversion
Source: "..\artifacts\publish\browser\*"; DestDir: "{app}\browser"; Flags: recursesubdirs ignoreversion
Source: "..\artifacts\publish\extension\*"; DestDir: "{app}\extension\v{#AppVersion}"; Flags: recursesubdirs ignoreversion
Source: "..\artifacts\publish\extension\extension-runtime.json"; DestDir: "{app}\extension"; Flags: ignoreversion

[Registry]
Root: HKCU; Subkey: "Software\Google\Chrome\NativeMessagingHosts\{#HostName}"; ValueType: string; ValueName: ""; ValueData: "{app}\nativehost\{#HostName}.json"; Flags: uninsdeletekey

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\desktop\BaccaratChromeAgent.Desktop.exe"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\desktop\BaccaratChromeAgent.Desktop.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\desktop\BaccaratChromeAgent.Desktop.exe"; Description: "Open {#AppName}"; Flags: nowait postinstall skipifsilent

[Tasks]
Name: "desktopicon"; Description: "Create a desktop icon"; Flags: unchecked

[UninstallDelete]
Type: filesandordirs; Name: "{app}\extension"
Type: filesandordirs; Name: "{app}\browser"

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  ManifestPath, NativePath, Contents: String;
begin
  if CurStep = ssPostInstall then
  begin
    ManifestPath := ExpandConstant('{app}\nativehost\{#HostName}.json');
    NativePath := ExpandConstant('{app}\nativehost\BaccaratChromeAgent.NativeHost.exe');
    StringChange(NativePath, '\', '\\');
    Contents := '{' + #13#10 +
      '  "name": "{#HostName}",' + #13#10 +
      '  "description": "Baccarat Chrome Agent Native Host",' + #13#10 +
      '  "path": "' + NativePath + '",' + #13#10 +
      '  "type": "stdio",' + #13#10 +
      '  "allowed_origins": ["chrome-extension://{#ExtensionId}/"]' + #13#10 +
      '}';
    SaveStringToFile(ManifestPath, Contents, False);
  end;
end;
