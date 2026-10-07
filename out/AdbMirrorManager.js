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
exports.AdbMirrorManager = void 0;
const vscode = __importStar(require("vscode"));
const child_process = __importStar(require("child_process"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class AdbMirrorManager {
    constructor() {
        this.isStreaming = false;
        this.streamPort = 27183;
        this._resolvedAdbPath = null;
    }
    static getInstance() {
        if (!AdbMirrorManager.instance) {
            AdbMirrorManager.instance = new AdbMirrorManager();
        }
        return AdbMirrorManager.instance;
    }
    /**
     * Resolve ADB path with full priority chain:
     * 1. User-configured path in settings
     * 2. Bundled platform-tools inside the extension (per-platform subfolder)
     * 3. Bundled platform-tools in extension root (flat layout)
     * 4. System PATH fallback
     *
     * Bundled layout expected inside extension root:
     *   platform-tools/
     *     win/    adb.exe  AdbWinApi.dll  AdbWinUsbApi.dll
     *     mac/    adb
     *     linux/  adb
     */
    getAdbPath() {
        // Cache after first resolution
        if (this._resolvedAdbPath)
            return this._resolvedAdbPath;
        // 1. User setting
        const configPath = vscode.workspace.getConfiguration('flutterWebEmulator').get('adbPath');
        if (configPath && configPath.trim() !== '') {
            this._resolvedAdbPath = `"${configPath.trim()}"`;
            return this._resolvedAdbPath;
        }
        // Extension root is one level above the compiled /out directory
        const extRoot = path.join(__dirname, '..');
        const plat = process.platform; // 'win32' | 'darwin' | 'linux'
        const candidates = [];
        if (plat === 'win32') {
            candidates.push(path.join(extRoot, 'platform-tools', 'win', 'adb.exe'), path.join(extRoot, 'platform-tools', 'adb.exe'), path.join(extRoot, 'adb.exe'));
        }
        else if (plat === 'darwin') {
            candidates.push(path.join(extRoot, 'platform-tools', 'mac', 'adb'), path.join(extRoot, 'platform-tools', 'adb'), path.join(extRoot, 'adb'));
        }
        else {
            // linux
            candidates.push(path.join(extRoot, 'platform-tools', 'linux', 'adb'), path.join(extRoot, 'platform-tools', 'adb'), path.join(extRoot, 'adb'));
        }
        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                // Ensure executable bit on mac/linux
                if (plat !== 'win32') {
                    try {
                        fs.chmodSync(candidate, 0o755);
                    }
                    catch (_) { /* ignore */ }
                }
                this._resolvedAdbPath = `"${candidate}"`;
                return this._resolvedAdbPath;
            }
        }
        // 3. Fallback: hope it's on PATH
        this._resolvedAdbPath = 'adb';
        return this._resolvedAdbPath;
    }
    /**
     * Returns true if ADB is available (bundled or system).
     * Also surfaces which path was resolved for diagnostics.
     */
    async isAdbAvailable() {
        return new Promise((resolve) => {
            child_process.exec(`${this.getAdbPath()} version`, (error) => {
                resolve(!error);
            });
        });
    }
    /** Returns the resolved ADB path for display in UI */
    getResolvedAdbPath() {
        return this.getAdbPath();
    }
    /** True when ADB was found bundled inside the extension */
    isBundled() {
        const p = this.getAdbPath();
        const extRoot = path.join(__dirname, '..');
        return p.includes(extRoot);
    }
    async getConnectedDevices() {
        return new Promise((resolve) => {
            child_process.exec(`${this.getAdbPath()} devices -l`, (error, stdout) => {
                if (error) {
                    resolve([]);
                    return;
                }
                const lines = stdout.trim().split('\n').slice(1);
                const devices = [];
                for (const line of lines) {
                    if (!line.trim())
                        continue;
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 2 && parts[1] === 'device') {
                        const id = parts[0];
                        const modelMatch = line.match(/model:(\S+)/);
                        const productMatch = line.match(/product:(\S+)/);
                        const name = modelMatch
                            ? modelMatch[1].replace(/_/g, ' ')
                            : productMatch
                                ? productMatch[1].replace(/_/g, ' ')
                                : id;
                        devices.push({ id, name, status: 'connected' });
                    }
                    else if (parts.length >= 2 && parts[1] === 'unauthorized') {
                        devices.push({ id: parts[0], name: 'Unauthorized Device', status: 'unauthorized' });
                    }
                    else if (parts.length >= 2 && parts[1] === 'offline') {
                        devices.push({ id: parts[0], name: 'Offline Device', status: 'offline' });
                    }
                }
                resolve(devices);
            });
        });
    }
    async getDeviceInfo(deviceId) {
        return new Promise((resolve) => {
            const adb = this.getAdbPath();
            let model = 'Unknown Device';
            let android = '';
            let resolution = '';
            let pending = 3;
            const done = () => { if (--pending === 0)
                resolve({ model, android, resolution }); };
            child_process.exec(`${adb} -s ${deviceId} shell getprop ro.product.model`, (e, s) => {
                if (!e && s.trim())
                    model = s.trim();
                done();
            });
            child_process.exec(`${adb} -s ${deviceId} shell getprop ro.build.version.release`, (e, s) => {
                if (!e && s.trim())
                    android = s.trim();
                done();
            });
            child_process.exec(`${adb} -s ${deviceId} shell wm size`, (e, s) => {
                const m = s && s.match(/(\d+x\d+)/);
                if (m)
                    resolution = m[1];
                done();
            });
        });
    }
    async isScrcpyAvailable() {
        return new Promise((resolve) => {
            child_process.exec('scrcpy --version', (error) => { resolve(!error); });
        });
    }
    async startMirror(deviceId, panel) {
        this.panel = panel;
        if (this.isStreaming)
            this.stopMirror();
        const hasScrcpy = await this.isScrcpyAvailable();
        if (hasScrcpy) {
            await this.startScrcpyMirror(deviceId);
        }
        else {
            await this.startAdbScreencapStream(deviceId);
        }
    }
    async startScrcpyMirror(deviceId) {
        return new Promise((resolve, reject) => {
            const args = ['-s', deviceId, '--no-display', '--no-audio', '--max-size', '400', '--bit-rate', '2M', '--port', String(this.streamPort)];
            this.mirrorProcess = child_process.spawn('scrcpy', args, { shell: true });
            this.isStreaming = true;
            this.mirrorProcess.stderr?.on('data', (data) => {
                const msg = data.toString();
                if (msg.includes('Device:') || msg.includes('INFO')) {
                    resolve();
                    this.panel?.webview.postMessage({ command: 'adbMirrorStarted', method: 'scrcpy', port: this.streamPort });
                }
            });
            this.mirrorProcess.on('error', (err) => { this.isStreaming = false; reject(err); });
            this.mirrorProcess.on('exit', () => {
                this.isStreaming = false;
                this.panel?.webview.postMessage({ command: 'adbMirrorStopped' });
            });
            setTimeout(() => {
                if (this.isStreaming) {
                    resolve();
                    this.panel?.webview.postMessage({ command: 'adbMirrorStarted', method: 'scrcpy', port: this.streamPort });
                }
            }, 3000);
        });
    }
    async startAdbScreencapStream(deviceId) {
        this.isStreaming = true;
        this.panel?.webview.postMessage({ command: 'adbMirrorStarted', method: 'screencap', deviceId });
        const captureFrame = () => {
            if (!this.isStreaming)
                return;
            child_process.exec(`${this.getAdbPath()} -s ${deviceId} exec-out screencap -p`, { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
                if (!error && stdout && this.isStreaming) {
                    const base64Data = Buffer.isBuffer(stdout) ? stdout.toString('base64') : Buffer.from(stdout).toString('base64');
                    this.panel?.webview.postMessage({ command: 'adbFrame', data: base64Data });
                }
                if (this.isStreaming)
                    setTimeout(captureFrame, 100);
            });
        };
        captureFrame();
    }
    stopMirror() {
        this.isStreaming = false;
        if (this.frameInterval) {
            clearInterval(this.frameInterval);
            this.frameInterval = undefined;
        }
        if (this.mirrorProcess) {
            try {
                if (process.platform === 'win32') {
                    child_process.execSync(`taskkill /pid ${this.mirrorProcess.pid} /T /F`);
                }
                else {
                    this.mirrorProcess.kill('SIGTERM');
                }
            }
            catch (e) {
                console.error('Error stopping mirror process:', e);
            }
            this.mirrorProcess = undefined;
        }
        this.panel?.webview.postMessage({ command: 'adbMirrorStopped' });
    }
    sendTap(deviceId, x, y) {
        child_process.exec(`${this.getAdbPath()} -s ${deviceId} shell input tap ${Math.round(x)} ${Math.round(y)}`);
    }
    sendSwipe(deviceId, x1, y1, x2, y2, duration = 200) {
        child_process.exec(`${this.getAdbPath()} -s ${deviceId} shell input swipe ${Math.round(x1)} ${Math.round(y1)} ${Math.round(x2)} ${Math.round(y2)} ${duration}`);
    }
    sendKey(deviceId, keycode) {
        child_process.exec(`${this.getAdbPath()} -s ${deviceId} shell input keyevent ${keycode}`);
    }
    sendText(deviceId, text) {
        const escaped = text.replace(/['"\\]/g, '\\$&').replace(/ /g, '%s');
        child_process.exec(`${this.getAdbPath()} -s ${deviceId} shell input text "${escaped}"`);
    }
    async takeScreenshot(deviceId) {
        return new Promise((resolve) => {
            child_process.exec(`${this.getAdbPath()} -s ${deviceId} exec-out screencap -p`, { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 }, (error, stdout) => {
                if (error) {
                    resolve(null);
                    return;
                }
                resolve(Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout));
            });
        });
    }
    dispose() { this.stopMirror(); }
}
exports.AdbMirrorManager = AdbMirrorManager;
//# sourceMappingURL=AdbMirrorManager.js.map