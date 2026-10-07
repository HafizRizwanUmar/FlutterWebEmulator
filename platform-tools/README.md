# Bundled ADB Platform Tools

This folder must contain the ADB binaries for all three platforms.
The extension ships these files so users never need to install ADB manually.

## Required file structure

```
platform-tools/
  win/
    adb.exe
    AdbWinApi.dll
    AdbWinUsbApi.dll
  mac/
    adb
  linux/
    adb
```

## How to populate (one-time setup before publishing)

### Windows files
1. Download: https://dl.google.com/android/repository/platform-tools-latest-windows.zip
2. Extract the zip
3. From the extracted `platform-tools/` folder, copy these 3 files into `platform-tools/win/`:
   - `adb.exe`
   - `AdbWinApi.dll`
   - `AdbWinUsbApi.dll`

### Mac file
1. Download: https://dl.google.com/android/repository/platform-tools-latest-darwin.zip
2. Extract the zip
3. Copy `platform-tools/adb` into `platform-tools/mac/adb`

### Linux file
1. Download: https://dl.google.com/android/repository/platform-tools-latest-linux.zip
2. Extract the zip
3. Copy `platform-tools/adb` into `platform-tools/linux/adb`

## Notes
- The extension automatically sets +x (executable) permissions on Mac/Linux at runtime
- Total size after adding all binaries: ~6–8 MB added to the extension
- The `.vscodeignore` file is already configured to include these files in the packaged extension
- ADB binaries are redistributable under the Android Open Source Project license

## Quick download script (run from repo root)

```bash
# Linux
curl -L https://dl.google.com/android/repository/platform-tools-latest-linux.zip -o /tmp/pt-linux.zip
unzip /tmp/pt-linux.zip platform-tools/adb -d /tmp/pt-linux
cp /tmp/pt-linux/platform-tools/adb platform-tools/linux/adb

# Mac (run on a Mac or use the zip directly)
curl -L https://dl.google.com/android/repository/platform-tools-latest-darwin.zip -o /tmp/pt-mac.zip
unzip /tmp/pt-mac.zip platform-tools/adb -d /tmp/pt-mac
cp /tmp/pt-mac/platform-tools/adb platform-tools/mac/adb

# Windows (run in PowerShell)
Invoke-WebRequest https://dl.google.com/android/repository/platform-tools-latest-windows.zip -OutFile pt-win.zip
Expand-Archive pt-win.zip -DestinationPath pt-win
Copy-Item pt-win/platform-tools/adb.exe platform-tools/win/
Copy-Item pt-win/platform-tools/AdbWinApi.dll platform-tools/win/
Copy-Item pt-win/platform-tools/AdbWinUsbApi.dll platform-tools/win/
```
