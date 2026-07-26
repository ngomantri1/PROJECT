; Build with: ISCC /DExtensionId=<stable Chrome extension ID> /DExtensionUrl=<unlisted Web Store URL> BaccaratChromeAgent.iss
#ifndef ExtensionId
  #error ExtensionId is required. Use the permanent Chrome Web Store extension ID.
#endif
#ifndef ExtensionUrl
  #define ExtensionUrl ""
#endif

#define AppName "Baccarat Chrome Agent"
#define AppVersion "0.1.0"
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

[Registry]
Root: HKCU; Subkey: "Software\Google\Chrome\NativeMessagingHosts\{#HostName}"; ValueType: string; ValueName: ""; ValueData: "{app}\nativehost\{#HostName}.json"; Flags: uninsdeletekey

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\desktop\BaccaratChromeAgent.Desktop.exe"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\desktop\BaccaratChromeAgent.Desktop.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\desktop\BaccaratChromeAgent.Desktop.exe"; Description: "Mở {#AppName}"; Flags: nowait postinstall skipifsilent
Filename: "{#ExtensionUrl}"; Description: "Cài Chrome extension"; Flags: postinstall shellexec skipifsilent; Check: HasExtensionUrl

[Tasks]
Name: "desktopicon"; Description: "Tạo biểu tượng ngoài Desktop"; Flags: unchecked

[Code]
function HasExtensionUrl: Boolean;
begin
  Result := '{#ExtensionUrl}' <> '';
end;

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
