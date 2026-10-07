"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlutterWebEmulatorPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class FlutterWebEmulatorPanel {
    static createOrShow(context, processManager) {
        const column = vscode.ViewColumn.Two;
        if (FlutterWebEmulatorPanel.currentPanel) {
            FlutterWebEmulatorPanel.currentPanel._panel.reveal(column);
            FlutterWebEmulatorPanel.currentPanel._setMode(false);
            return FlutterWebEmulatorPanel.currentPanel._panel;
        }
        const panel = vscode.window.createWebviewPanel(FlutterWebEmulatorPanel.viewType, 'flutterWebEmulator', column, { enableScripts: true, localResourceRoots: [context.extensionUri], retainContextWhenHidden: true });
        FlutterWebEmulatorPanel.currentPanel = new FlutterWebEmulatorPanel(panel, context, processManager, false);
        return panel;
    }
    static createOrShowMirror(context, processManager, adbManager, deviceId) {
        const column = vscode.ViewColumn.Two;
        if (FlutterWebEmulatorPanel.currentPanel) {
            FlutterWebEmulatorPanel.currentPanel._panel.reveal(column);
            FlutterWebEmulatorPanel.currentPanel._setMode(true, adbManager, deviceId);
            return FlutterWebEmulatorPanel.currentPanel._panel;
        }
        const panel = vscode.window.createWebviewPanel(FlutterWebEmulatorPanel.viewType, 'Android Mirror', column, { enableScripts: true, localResourceRoots: [context.extensionUri], retainContextWhenHidden: true });
        FlutterWebEmulatorPanel.currentPanel = new FlutterWebEmulatorPanel(panel, context, processManager, true, adbManager, deviceId);
        return panel;
    }
    static reload() { FlutterWebEmulatorPanel.currentPanel?._reload(); }
    static rotate() { FlutterWebEmulatorPanel.currentPanel?._rotate(); }
    static dispose() {
        FlutterWebEmulatorPanel.currentPanel?.dispose();
        FlutterWebEmulatorPanel.currentPanel = undefined;
    }
    constructor(panel, context, processManager, isMirrorMode = false, adbManager, deviceId) {
        this._disposables = [];
        this._isPortrait = true;
        this._isMirrorMode = false;
        this._panel = panel;
        this._context = context;
        this._extensionUri = context.extensionUri;
        this._processManager = processManager;
        this._isMirrorMode = isMirrorMode;
        this._adbManager = adbManager;
        this._deviceId = deviceId;
        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.onDidChangeViewState((e) => { if (this._panel.visible)
            this._update(); }, null, this._disposables);
        this._panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'webviewReady':
                    if (this._isMirrorMode && this._adbManager && this._deviceId) {
                        this._startMirror(this._adbManager, this._deviceId);
                    }
                    else if (!this._isMirrorMode) {
                        this._startFlutterProcess();
                    }
                    return;
                case 'reload':
                    this._reload();
                    require('./HotReloadManager').HotReloadManager.getInstance().triggerHotReload();
                    return;
                case 'rotate':
                    this._rotate();
                    return;
                case 'adbTap':
                    this._adbManager?.sendTap(this._deviceId, message.x, message.y);
                    return;
                case 'adbSwipe':
                    this._adbManager?.sendSwipe(this._deviceId, message.x1, message.y1, message.x2, message.y2, message.duration || 200);
                    return;
                case 'adbKey':
                    this._adbManager?.sendKey(this._deviceId, message.keycode);
                    return;
                case 'adbText':
                    this._adbManager?.sendText(this._deviceId, message.text);
                    return;
                case 'stopMirror':
                    this._adbManager?.stopMirror();
                    this._setMode(false);
                    return;
                case 'takeScreenshot':
                    await this._takeScreenshot();
                    return;
                case 'deviceChanged':
                    return;
                case 'openAdbDownload':
                    vscode.env.openExternal(vscode.Uri.parse('https://developer.android.com/tools/releases/platform-tools#downloads'));
                    return;
            }
        }, null, this._disposables);
    }
    _setMode(isMirror, adbManager, deviceId) {
        if (this._isMirrorMode === isMirror && this._deviceId === deviceId)
            return;
        if (this._isMirrorMode)
            this._adbManager?.stopMirror();
        this._isMirrorMode = isMirror;
        if (adbManager)
            this._adbManager = adbManager;
        if (deviceId)
            this._deviceId = deviceId;
        this._panel.title = this._isMirrorMode ? 'Android Mirror' : 'flutterWebEmulator';
        this._panel.webview.postMessage({ command: 'switchMode', mode: this._isMirrorMode ? 'mirror' : 'web' });
        if (this._isMirrorMode && this._adbManager && this._deviceId) {
            this._startMirror(this._adbManager, this._deviceId);
        }
        else if (!this._processManager.isProcessRunning()) {
            this._startFlutterProcess();
        }
    }
    async _startMirror(adbManager, deviceId) {
        this._adbManager = adbManager;
        this._deviceId = deviceId;
        try {
            await adbManager.startMirror(deviceId, this._panel);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Mirror error: ${err.message}`);
        }
    }
    async _startFlutterProcess() {
        try {
            const config = vscode.workspace.getConfiguration('flutterWebEmulator');
            const customFlags = config.get('customFlags', []);
            const url = await this._processManager.startFlutterWebServer(false, customFlags);
            this._panel.webview.postMessage({ command: 'setAppUrl', url });
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Flutter server error: ${msg}`, 'Show Logs').then(selection => {
                if (selection === 'Show Logs' && this._processManager && this._processManager.outputChannel) {
                    this._processManager.outputChannel.show(true);
                }
            });
        }
    }
    async _takeScreenshot() {
        if (!this._adbManager || !this._deviceId)
            return;
        const buf = await this._adbManager.takeScreenshot(this._deviceId);
        if (!buf) {
            vscode.window.showErrorMessage('Screenshot failed');
            return;
        }
        const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file('screenshot.png'), filters: { 'PNG Image': ['png'] } });
        if (uri) {
            require('fs').writeFileSync(uri.fsPath, buf);
            vscode.window.showInformationMessage(`Screenshot saved to ${uri.fsPath}`);
        }
    }
    _reload() {
        this._panel.webview.postMessage({ command: 'reload' });
    }
    _rotate() {
        this._isPortrait = !this._isPortrait;
        this._panel.webview.postMessage({ command: 'rotate', isPortrait: this._isPortrait });
    }
    _update() {
        const webview = this._panel.webview;
        this._panel.title = this._isMirrorMode ? 'Android Mirror' : 'flutterWebEmulator';
        webview.html = this._getHtmlForWebview(webview);
    }
    _getHtmlForWebview(webview) {
        const config = vscode.workspace.getConfiguration('flutterWebEmulator');
        const defaultDeviceName = config.get('defaultDevice', 'iPhone 14');
        const devicePresets = config.get('devicePresets', {});
        const getUri = (filePath) => webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, filePath)));
        const scriptUri = getUri('media/main.js');
        const touchEventsUri = getUri('media/touch-events.js');
        const deviceAnimationsUri = getUri('media/device-animations.js');
        const hotReloadUri = getUri('media/hot-reload.js');
        const styleUri = getUri('media/style.css');
        const deviceEffectsUri = getUri('media/device-effects.css');
        const backgroundUri = getUri('media/background.png');
        const nonce = getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: blob:; style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com; script-src 'nonce-${nonce}'; frame-src http://localhost:* http://127.0.0.1:*; font-src https://fonts.gstatic.com; connect-src https://fonts.googleapis.com;">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&display=swap" rel="stylesheet">
  <link href="${styleUri}" rel="stylesheet" />
  <link href="${deviceEffectsUri}" rel="stylesheet" />
  <title>flutterWebEmulator</title>
  <style>
    /* ─── Width Controls ─── */
    .width-controls {
      position: absolute;
      right: 30px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      gap: 15px;
      z-index: 200;
    }
    .width-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: rgba(255, 255, 255, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      backdrop-filter: blur(10px);
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .width-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.3);
      transform: scale(1.05);
    }
    .width-btn:active {
      transform: scale(0.95);
    }
    
    /* ─── Mirror Layer ─── */
    #mirror-container {
      width: 100%; height: 100%;
      display: none; flex-direction: column;
      align-items: center; justify-content: center;
      background: #000; cursor: crosshair;
      position: absolute; z-index: 5;
    }
    #mirror-img {
      width: 100%;
      height: calc(100% - 48px);
      margin-bottom: 48px;
      object-fit: contain;
      display: none;
    }
    .mirror-status {
      display: flex; flex-direction: column;
      align-items: center; gap: 12px;
      padding: 24px; text-align: center;
      color: #fff; margin-bottom: 48px;
    }
    .mirror-status-icon {
      width: 40px; height: 40px;
      border-radius: 14px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
    }
    .mirror-status-title {
      font-size: 14px; font-weight: 600;
      color: rgba(255,255,255,0.9);
      letter-spacing: 0.01em;
    }
    .mirror-status-sub {
      font-size: 12px;
      color: rgba(255,255,255,0.45);
      max-width: 200px; line-height: 1.6;
    }
    .fps-counter {
      font-size: 10px; font-weight: 600;
      color: rgba(255,255,255,0.35);
      letter-spacing: 0.08em; text-transform: uppercase;
      position: absolute; top: 40px; right: 14px;
      z-index: 10; display: none;
      font-family: 'SF Mono', 'Fira Code', monospace;
    }
    .mirror-controls {
      display: none; gap: 8px; align-items: center;
      margin-top: 14px;
    }
    .ctrl-btn {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.8);
      padding: 7px 16px; border-radius: 8px;
      cursor: pointer; font-size: 12px;
      font-weight: 500; letter-spacing: 0.02em;
      transition: all 0.15s ease;
    }
    .ctrl-btn:hover {
      background: rgba(255,255,255,0.12);
      border-color: rgba(255,255,255,0.2);
      color: #fff;
    }
    .ctrl-btn.danger { border-color: rgba(255,59,48,0.3); color: rgba(255,100,90,0.9); }
    .ctrl-btn.danger:hover { background: rgba(255,59,48,0.12); border-color: rgba(255,59,48,0.5); color: #ff6b6b; }
    .ctrl-btn.primary {
      background: #0a84ff; border-color: #0a84ff;
      color: #fff;
    }
    .ctrl-btn.primary:hover { background: #0974e0; border-color: #0974e0; }

    .adb-key-bar {
      display: none; gap: 6px; margin-top: 8px; flex-wrap: wrap; justify-content: center;
    }
    .key-btn {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.7);
      padding: 5px 12px; border-radius: 6px;
      cursor: pointer; font-size: 11px; font-weight: 500;
      transition: all 0.15s ease;
      letter-spacing: 0.02em;
    }
    .key-btn:hover {
      background: rgba(255,255,255,0.12);
      color: #fff;
    }

    #flutter-app { position: absolute; z-index: 1; }
    #loading-overlay { z-index: 2; }

    /* ─── ADB Setup Overlay ─── */
    .adb-setup-overlay {
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      z-index: 100;
      display: none;
      flex-direction: column;
      align-items: center; justify-content: center;
      padding: 20px;
      border-radius: inherit;
    }
    .adb-setup-overlay.active {
      display: flex;
    }
    .pw-card {
      width: 100%; max-width: none; height: 100%;
      margin: 0;
      background: transparent;
      border: none;
      border-radius: inherit;
      padding: 24px 16px;
      box-shadow: none;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .pw-header {
      display: flex; align-items: center;
      gap: 10px; margin-bottom: 12px;
      position: relative;
    }
    .pw-icon {
      width: 40px; height: 40px;
      border-radius: 14px;
      background: linear-gradient(135deg, #30d158, #00a832);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .pw-title {
      font-size: 15px; font-weight: 800; line-height: 1.1; margin-bottom: 2px;
      background: linear-gradient(to right, #fff, rgba(255,255,255,0.7));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .pw-subtitle {
      font-size: 12px; color: rgba(255,255,255,0.4);
      margin-top: 2px; font-weight: 500;
    }
    .pw-desc {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
      line-height: 1.4; margin-bottom: 16px;
    }
    .pw-features {
      list-style: none; padding: 0; margin: 0 0 12px;
      display: flex; flex-direction: column; gap: 4px;
    }
    .pw-features li {
      display: flex; align-items: center; gap: 8px;
      font-size: 11px; color: rgba(255,255,255,0.75);
      font-weight: 400;
    }
    .pw-feature-dot {
      width: 14px; height: 14px; border-radius: 50%;
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 10px; font-weight: 900;
    }
    .pw-feature-dot::after { content: '✓'; }
    .pw-buy-btn {
      width: 100%; padding: 10px;
      border-radius: 14px; border: none;
      background: linear-gradient(135deg, #30d158, #00a832);
      color: #fff; font-weight: 700;
      font-size: 14px; letter-spacing: 0.01em;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      margin-bottom: 12px;
      display: flex; align-items: center;
      justify-content: center; gap: 10px;
    }
    .pw-verify-btn {
      width: 100%; box-sizing: border-box;
      padding: 8px 10px;
      border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.05);
      color: rgba(255,255,255,0.8);
      font-size: 12px; font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .pw-verify-btn:hover { background: rgba(255,255,255,0.1); color: #fff; border-color: rgba(255,255,255,0.2); }
  </style>
</head>
<body style="background-image: url('${backgroundUri}'); background-size: cover; background-position: center; background-repeat: no-repeat;">
  <!-- Width Controls -->
  <div class="width-controls">
    <button class="width-btn" id="width-plus" title="Increase Width">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </button>
    <button class="width-btn" id="width-minus" title="Decrease Width">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </button>
  </div>

  <div class="iphone-flutterWebEmulator">
    <div class="iphone-device ${this._isPortrait ? 'portrait' : 'landscape'}" id="phone-frame">

      <div class="iphone-notch" id="notch">
        <span class="notch-camera"></span>
        <span class="notch-speaker"></span>
      </div>

      <div class="iphone-screen" id="screen">

        <!-- Web flutterWebEmulator -->
        <iframe id="flutter-app" src="about:blank" frameborder="0"></iframe>
        <div id="loading-overlay" class="loading-overlay" role="status">
          <div class="ld-stage-label" id="ld-stage">Initializing</div>
          <div class="ld-track"><div class="ld-fill" id="ld-fill"></div></div>
          <div class="ld-status" id="ld-status">Starting Flutter web server...</div>
          <div class="ld-elapsed" id="ld-elapsed"></div>
          <div class="ld-hint" id="ld-hint">First build compiles Dart to JavaScript — subsequent runs are much faster.</div>
        </div>

        <div id="error-screen" class="error-screen">
          <div class="err-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="40" height="40"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div class="err-title">Launch Failed</div>
          <div class="err-msg" id="err-msg">Something went wrong while starting the Flutter server.</div>
          <button class="err-btn" onclick="vscode.postMessage({ command: 'reload' })">Retry</button>
          <div class="err-hint">Check the "flutterWebEmulator" Output channel for detailed logs.</div>
        </div>

        <!-- Hot Reload Overlay -->
        <div id="hot-reload-overlay">
          <div class="hr-pill" id="hr-pill"></div>
        </div>

        <!-- ADB Mirror -->
        <div id="mirror-container">
          <div class="mirror-status" id="mirror-status">
            <div class="mirror-status-icon">
              <svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)" width="22" height="22">
                <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/>
              </svg>
            </div>
            <div class="mirror-status-title">Connecting to device</div>
            <div class="mirror-status-sub">Make sure USB debugging is enabled on your phone</div>
          </div>
          <img id="mirror-img" alt="Device screen" />
          <div class="android-nav-bar" id="android-nav-bar" style="display:none;">
            <button class="nav-btn" data-keycode="4" title="Back">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            </button>
            <button class="nav-btn" data-keycode="3" title="Home">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            </button>
            <button class="nav-btn" data-keycode="187" title="Recents">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>
            </button>
          </div>
        </div>
        <span class="fps-counter" id="fps-counter"></span>

        <!-- Payment Wall -->
        <div class="payment-wall-overlay" id="payment-wall">
          <div class="pw-card">
            <div class="pw-header">
              <div class="pw-icon">
                <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              </div>
              <div>
                <div class="pw-title">Get Premium</div>
                <div class="pw-subtitle" id="pw-subtitle">trial has ended</div>
              </div>
            </div>

            <div style="display: flex; gap: 6px; margin-bottom: 8px; width: 100%;">
              <div class="pw-price-container" style="flex: 1; margin-bottom: 0; padding: 6px;">
                <div class="pw-price">
                  <span class="pw-price-amount" style="font-size: 18px;">$0.99</span>
                </div>
              </div>
              <button class="pw-buy-btn" id="pw-buy-btn" style="flex: 1.5; margin-bottom: 0; padding: 6px; font-size: 12px;">
                Get Pro
              </button>
            </div>

            <div style="display: flex; gap: 6px; margin-bottom: 12px; width: 100%;">
              <div class="pw-price-container" style="flex: 1; margin-bottom: 0; padding: 6px; background: rgba(236, 72, 153, 0.1); border-color: rgba(236, 72, 153, 0.3);">
                <div class="pw-price">
                  <span class="pw-price-amount" style="font-size: 18px; color: #ec4899;">$9.99</span>
                </div>
              </div>
              <button class="pw-buy-btn" id="pw-buy-source-btn" style="flex: 1.5; margin-bottom: 0; padding: 6px; font-size: 12px; background: linear-gradient(135deg, #ec4899, #8b5cf6);">
                Get Code & Guide
              </button>
            </div>

            <div class="pw-input-row">
              <input type="text" class="pw-input" id="pw-key" placeholder="License key" spellcheck="false" autocomplete="off" />
              <button class="pw-verify-btn" id="pw-verify-btn">Verify</button>
            </div>
            
            <div class="pw-divider" style="margin-top: 12px; margin-bottom: 8px;">
              <div class="pw-divider-line"></div>
              <div class="pw-divider-text">What's included</div>
              <div class="pw-divider-line"></div>
            </div>

            <ul class="pw-features" style="margin-bottom: 0;">
              <li><span class="pw-feature-dot"></span>Pixel-perfect emulation</li>
              <li><span class="pw-feature-dot"></span>Real-time ADB mirroring</li>
              <li><span class="pw-feature-dot"></span>Instant hot reload</li>
              <li><span class="pw-feature-dot"></span>Premium device presets</li>
              <li><span class="pw-feature-dot"></span>Premium screenshot toolkit</li>
            </ul>
            <div class="pw-error" id="pw-error"></div>
            <div class="pw-success" id="pw-success"></div>
          </div>
        </div>

        <!-- ADB Setup Guide -->
        <div class="adb-setup-overlay" id="adb-setup">
          <div class="pw-card">
            <div class="pw-header">
              <div class="pw-icon" style="background: linear-gradient(135deg, #30d158, #00a832);">
                <svg viewBox="0 0 24 24" fill="#fff" width="22" height="22"><path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C7.08 3.33 6 5.05 6 7h12c0-1.95-1.08-3.67-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/></svg>
              </div>
              <div>
                <div class="pw-title">ADB Not Found</div>
                <div class="pw-subtitle">Required for Android mirroring</div>
              </div>
            </div>
            <p class="pw-desc">Android Debug Bridge (ADB) must be installed and available in your system PATH to use device mirroring.</p>
            <ul class="pw-features">
              <li><span class="pw-feature-dot" style="background:#30d158;"></span>Download Android Platform Tools</li>
              <li><span class="pw-feature-dot" style="background:#30d158;"></span>Extract and add the folder to your PATH</li>
              <li><span class="pw-feature-dot" style="background:#30d158;"></span>Enable USB Debugging on your Android device</li>
              <li><span class="pw-feature-dot" style="background:#30d158;"></span>Connect your phone via USB and retry</li>
            </ul>
            <button class="pw-buy-btn" id="pw-adb-download-btn" style="background:#30d158;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Platform Tools
            </button>
            <button class="pw-verify-btn" id="pw-adb-close-btn" style="width:100%;padding:10px;margin-top:6px;">Dismiss</button>
          </div>
        </div>

      </div><!-- /screen -->

      <div class="iphone-home-indicator" id="home-indicator"></div>
    </div><!-- /phone-frame -->

    <!-- Hardware buttons -->
    <div class="iphone-buttons" id="iphone-buttons">
      <div class="btn-power" data-keycode="26" title="Power"></div>
      <div class="btn-volume btn-up" data-keycode="24" title="Volume Up"></div>
      <div class="btn-volume btn-down" data-keycode="25" title="Volume Down"></div>
    </div>



    <!-- Mirror Controls -->
    <div class="mirror-controls" id="mirror-controls">
      <button class="ctrl-btn primary" onclick="takeScreenshot()">Screenshot</button>
      <button class="ctrl-btn danger" onclick="stopMirror()">Stop Mirror</button>
    </div>

    <div class="adb-key-bar" id="adb-key-bar">
      <button class="key-btn" data-keycode="26">Power</button>
      <button class="key-btn" data-keycode="24">Vol +</button>
      <button class="key-btn" data-keycode="25">Vol -</button>
      <button class="key-btn" data-keycode="66">Enter</button>
      <button class="key-btn" data-keycode="4">Back</button>
      <button class="key-btn" data-keycode="84">Search</button>
    </div>

  </div><!-- /iphone-flutterWebEmulator -->

  <script nonce="${nonce}">
    const devicePresets = ${JSON.stringify(devicePresets)};
    const currentDeviceName = '${defaultDeviceName}';
    const isPortraitInitial = ${this._isPortrait};
    let isMirrorMode = ${this._isMirrorMode};
    const vscode = acquireVsCodeApi();

    // ── Stage-based loading system ──────────────────────────────────────
    const STAGES = [
      { at: 0,    pct: 4,  label: 'Initializing',         status: 'Starting Flutter web server...',           hint: 'First build compiles Dart to JavaScript — subsequent runs are much faster.' },
      { at: 8,    pct: 12, label: 'Resolving packages',   status: 'Resolving pub dependencies...',            hint: null },
      { at: 18,   pct: 28, label: 'Compiling',            status: 'Compiling Dart to JavaScript...',          hint: 'This step takes the longest on first run.' },
      { at: 45,   pct: 52, label: 'Bundling',             status: 'Bundling assets and web resources...',     hint: null },
      { at: 75,   pct: 72, label: 'Starting server',      status: 'Starting local web server...',            hint: null },
      { at: 110,  pct: 86, label: 'Almost ready',         status: 'Waiting for server to respond...',        hint: 'Large projects can take 2–4 minutes on first build.' },
      { at: 160,  pct: 93, label: 'Still working',        status: 'Build is taking longer than usual...',    hint: 'This is normal for large or complex Flutter projects.' },
      { at: 240,  pct: 97, label: 'Finalizing',           status: 'Hang tight — nearly there...',            hint: null },
    ];

    let ldStartTime = Date.now();
    let ldStageIdx = 0;
    let ldTimer = null;
    const ldFill   = document.getElementById('ld-fill');
    const ldStage  = document.getElementById('ld-stage');
    const ldStatus = document.getElementById('ld-status');
    const ldElapsed = document.getElementById('ld-elapsed');
    const ldHint   = document.getElementById('ld-hint');

    function ldSetStage(s) {
      if (ldFill)  ldFill.style.width  = s.pct + '%';
      if (ldStage) ldStage.textContent = s.label;
      if (ldStatus) ldStatus.textContent = s.status;
      if (ldHint && s.hint !== null) { ldHint.textContent = s.hint; ldHint.style.display = 'block'; }
      else if (ldHint && s.hint === null) ldHint.style.display = 'none';
    }

    function ldTick() {
      const elapsed = Math.floor((Date.now() - ldStartTime) / 1000);
      if (ldElapsed) {
        if (elapsed < 5) ldElapsed.textContent = '';
        else if (elapsed < 60) ldElapsed.textContent = elapsed + 's elapsed';
        else ldElapsed.textContent = Math.floor(elapsed / 60) + 'm ' + (elapsed % 60) + 's elapsed';
      }
      while (ldStageIdx < STAGES.length - 1 && elapsed >= STAGES[ldStageIdx + 1].at) {
        ldStageIdx++;
        ldSetStage(STAGES[ldStageIdx]);
      }
      ldTimer = setTimeout(ldTick, 1000);
    }

    ldSetStage(STAGES[0]);
    ldTimer = setTimeout(ldTick, 1000);

    // DOM refs
    const flutterApp = document.getElementById('flutter-app');
    const loadingOverlay = document.getElementById('loading-overlay');
    const mirrorContainer = document.getElementById('mirror-container');
    const mirrorImg = document.getElementById('mirror-img');
    const mirrorStatus = document.getElementById('mirror-status');
    const fpsCounter = document.getElementById('fps-counter');
    const notch = document.getElementById('notch');
    const homeIndicator = document.getElementById('home-indicator');
    const androidNavBar = document.getElementById('android-nav-bar');
    const mirrorControls = document.getElementById('mirror-controls');
    const adbKeyBar = document.getElementById('adb-key-bar');

    function updateUiMode(mode) {
      if (mode === 'mirror') {
        flutterApp.style.display = 'none';
        loadingOverlay.style.display = 'none';
        mirrorContainer.style.display = 'flex';
        fpsCounter.style.display = 'block';
        mirrorControls.style.display = 'flex';
        adbKeyBar.style.display = 'flex';
        notch.classList.add('android-punch-hole');
        homeIndicator.style.display = 'none';
        androidNavBar.style.display = 'flex';
      } else {
        flutterApp.style.display = 'block';
        loadingOverlay.style.display = 'flex';
        mirrorContainer.style.display = 'none';
        fpsCounter.style.display = 'none';
        mirrorControls.style.display = 'none';
        adbKeyBar.style.display = 'none';
        notch.classList.remove('android-punch-hole');
        homeIndicator.style.display = 'block';
        androidNavBar.style.display = 'none';
      }
    }

    // ADB mirror interaction
    let frameCount = 0, lastFpsTime = Date.now();
    let swipeStart = null;
    let deviceWidth = 1080, deviceHeight = 2400;

    mirrorContainer.addEventListener('mousedown', (e) => {
      const rect = mirrorImg.getBoundingClientRect();
      swipeStart = { x: e.clientX - rect.left, y: e.clientY - rect.top, t: Date.now() };
    });

    mirrorContainer.addEventListener('mouseup', (e) => {
      if (!swipeStart) return;
      const rect = mirrorImg.getBoundingClientRect();
      const ex = e.clientX - rect.left, ey = e.clientY - rect.top;
      const dx = ex - swipeStart.x, dy = ey - swipeStart.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const scaleX = deviceWidth / rect.width;
      const scaleY = deviceHeight / rect.height;

      if (dist < 8) {
        vscode.postMessage({ command: 'adbTap', x: Math.round(ex * scaleX), y: Math.round(ey * scaleY) });
      } else {
        const elapsed = Date.now() - swipeStart.t;
        vscode.postMessage({
          command: 'adbSwipe',
          x1: Math.round(swipeStart.x * scaleX), y1: Math.round(swipeStart.y * scaleY),
          x2: Math.round(ex * scaleX), y2: Math.round(ey * scaleY),
          duration: Math.min(Math.max(elapsed, 80), 600)
        });
      }
      swipeStart = null;
    });

    // Event listeners for UI elements
    document.getElementById('pw-adb-download-btn')?.addEventListener('click', () => vscode.postMessage({ command: 'openAdbDownload' }));
    document.getElementById('pw-adb-close-btn')?.addEventListener('click', () => {
      document.getElementById('adb-setup')?.classList.remove('active');
    });

    // Bind data-keycode elements
    document.querySelectorAll('[data-keycode]').forEach(el => {
      el.addEventListener('click', (e) => {
        const keycode = parseInt(el.getAttribute('data-keycode'));
        if (!isNaN(keycode)) {
          if (mirrorContainer.style.display === 'flex' || el.closest('#iphone-buttons') || el.closest('#adb-key-bar')) {
            vscode.postMessage({ command: 'adbKey', keycode });
          }
        }
      });
    });

    window.stopMirror = () => vscode.postMessage({ command: 'stopMirror' });
    window.takeScreenshot = () => vscode.postMessage({ command: 'takeScreenshot' });

    // Width Controls Logic
    let widthModifier = 0;
    document.getElementById('width-plus').addEventListener('click', () => {
      widthModifier += 20;
      document.documentElement.style.setProperty('--width-modifier', widthModifier + 'px');
    });
    document.getElementById('width-minus').addEventListener('click', () => {
      widthModifier -= 20;
      document.documentElement.style.setProperty('--width-modifier', widthModifier + 'px');
    });

    // Message handler
    window.addEventListener('message', (event) => {
      const msg = event.data;

      switch (msg.command) {
        case 'switchMode':
          isMirrorMode = (msg.mode === 'mirror');
          updateUiMode(msg.mode);
          break;

        case 'adbMirrorStarted':
          mirrorStatus.style.display = 'none';
          mirrorImg.style.display = 'block';
          break;

        case 'adbFrame': {
          mirrorImg.src = 'data:image/png;base64,' + msg.data;
          frameCount++;
          const now = Date.now();
          if (now - lastFpsTime >= 1000) {
            fpsCounter.textContent = frameCount + ' fps';
            frameCount = 0;
            lastFpsTime = now;
          }
          break;
        }

        case 'showAdbSetup': {
          const adbSetup = document.getElementById('adb-setup');
          if (adbSetup) adbSetup.classList.add('active');
          break;
        }

        case 'loadingDone':
          if (ldTimer) { clearTimeout(ldTimer); ldTimer = null; }
          if (ldFill) ldFill.style.width = '100%';
          if (ldStage) ldStage.textContent = 'Ready';
          if (ldStatus) ldStatus.textContent = 'App is running.';
          if (ldElapsed) ldElapsed.textContent = '';
          if (ldHint) ldHint.style.display = 'none';
          break;

        case 'adbMirrorStopped':
          mirrorImg.style.display = 'none';
          mirrorStatus.style.display = 'flex';
          mirrorStatus.innerHTML = \`
            <div class="mirror-status-icon">
              <svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)" width="22" height="22">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 5v4.59L7.41 8 6 9.41l5 5 5-5-1.41-1.41L13 11.59V7h-2z"/>
              </svg>
            </div>
            <div class="mirror-status-title">Mirror stopped</div>
            <div class="mirror-status-sub">Use the command palette to start a new session</div>
          \`;
          break;
      }
    });

    // Init
    vscode.postMessage({ command: 'webviewReady' });
    updateUiMode(isMirrorMode ? 'mirror' : 'web');
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
  <script nonce="${nonce}" src="${touchEventsUri}"></script>
  <script nonce="${nonce}" src="${deviceAnimationsUri}"></script>
  <script nonce="${nonce}" src="${hotReloadUri}"></script>
</body>
</html>`;
    }
    dispose() {
        this._adbManager?.stopMirror();
        this._processManager.stopFlutterWebServer();
        FlutterWebEmulatorPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length)
            this._disposables.pop()?.dispose();
    }
}
exports.FlutterWebEmulatorPanel = FlutterWebEmulatorPanel;
FlutterWebEmulatorPanel.viewType = 'flutterWebEmulator';
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}
//# sourceMappingURL=FlutterWebEmulatorPanel.js.map