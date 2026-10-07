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
exports.FlutterProcessManager = void 0;
const vscode = __importStar(require("vscode"));
const child_process = __importStar(require("child_process"));
const readline = __importStar(require("readline"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class FlutterProcessManager {
    constructor() {
        this.isRunning = false;
        this.commandQueue = [];
        this.processingQueue = false;
        this.outputChannel = vscode.window.createOutputChannel('flutterWebEmulator');
    }
    async startFlutterWebServer(useExperimentalHotReload = false, customFlags = []) {
        if (this.isRunning) {
            if (this.serverUrl)
                return this.serverUrl;
            return new Promise((resolve, reject) => {
                const checkInterval = setInterval(() => {
                    if (this.serverUrl) {
                        clearInterval(checkInterval);
                        resolve(this.serverUrl);
                    }
                    else if (!this.isRunning) {
                        clearInterval(checkInterval);
                        reject(new Error('Flutter process exited while waiting for URL. Check the Output channel for details.'));
                    }
                }, 500);
                setTimeout(() => {
                    clearInterval(checkInterval);
                    reject(new Error('Timeout waiting for Flutter server URL. Check the Output channel for logs.'));
                }, 60000);
            });
        }
        return new Promise((resolve, reject) => {
            try {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders) {
                    reject(new Error('No workspace folder is open'));
                    return;
                }
                const workspaceRoot = workspaceFolders[0].uri.fsPath;
                if (!fs.existsSync(path.join(workspaceRoot, 'pubspec.yaml'))) {
                    const errMsg = 'No pubspec.yaml found in the root of your workspace. Open a Flutter project folder to use the flutterWebEmulator.';
                    this.outputChannel.appendLine(`[ERROR] ${errMsg}`);
                    reject(new Error(errMsg));
                    return;
                }
                const args = ['run', '-d', 'web-server', '--web-port', '0'];
                args.push(...customFlags);
                this.outputChannel.clear();
                this.outputChannel.appendLine(`Starting Flutter Web Server with args: ${args.join(' ')}`);
                this.flutterProcess = child_process.spawn('flutter', args, { cwd: workspaceRoot, shell: true });
                this.isRunning = true;
                let lastErrorLine = '';
                const rl = readline.createInterface({ input: this.flutterProcess.stdout, crlfDelay: Infinity });
                rl.on('line', (line) => {
                    console.log('Flutter output:', line);
                    this.outputChannel.appendLine(line);
                    if (line.trim()) lastErrorLine = line.trim();
                    // Standard match for http://localhost:port or 127.0.0.1
                    const urlMatch = line.match(/(https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0):\d+)/i);
                    if (urlMatch) {
                        let url = urlMatch[1];
                        // Normalize IPs to localhost to prevent Content-Security-Policy violations
                        url = url.replace('[::1]', 'localhost').replace('0.0.0.0', 'localhost').replace('127.0.0.1', 'localhost');
                        this.serverUrl = url;
                        this.outputChannel.appendLine(`[flutterWebEmulator] Server URL detected: ${this.serverUrl}`);
                        resolve(this.serverUrl);
                    }
                    const lower = line.toLowerCase();
                    // Detect successful hot restart / reload completion
                    if (lower.includes('restarted application') ||
                        lower.includes('hot restart') ||
                        lower.includes('reloaded') ||
                        lower.includes('synced') ||
                        lower.includes('application finished restarting')) {
                        const panel = require('./FlutterWebEmulatorPanel').FlutterWebEmulatorPanel.currentPanel;
                        if (panel) {
                            panel._panel.webview.postMessage({ command: 'hotReloadFinished' });
                        }
                    }
                    // Detect real Flutter compilation/build errors only
                    // Must start with 'error:' or be a build/compilation failure line
                    // We deliberately exclude runtime app logs — they don't indicate a build failure
                    const isCompileError = (lower.startsWith('error:') ||
                        lower.includes('compilation failed') ||
                        lower.includes('build failed') ||
                        lower.includes('compiler message: error:') ||
                        (lower.includes('dart:') && lower.includes('error:') && lower.startsWith('lib/')));
                    if (isCompileError) {
                        const panel = require('./FlutterWebEmulatorPanel').FlutterWebEmulatorPanel.currentPanel;
                        if (panel) {
                            panel._panel.webview.postMessage({ command: 'reloadError', message: line.trim() });
                        }
                    }
                });
                this.flutterProcess.stderr.on('data', (data) => {
                    const str = data.toString();
                    console.error(`Flutter stderr: ${str}`);
                    this.outputChannel.appendLine(`[STDERR] ${str}`);
                    if (str.trim()) lastErrorLine = str.trim();
                });
                this.flutterProcess.on('error', (error) => {
                    this.isRunning = false;
                    this.outputChannel.appendLine(`[ERROR] Process error: ${error.message}`);
                    if (error.code === 'ENOENT') {
                        reject(new Error(`Flutter not found in PATH. Install Flutter and ensure it's in your system PATH.`));
                    }
                    else {
                        reject(new Error(`Flutter process error: ${error.message}`));
                    }
                });
                this.flutterProcess.on('exit', (code) => {
                    this.isRunning = false;
                    this.outputChannel.appendLine(`[PROCESS] Flutter exited with code ${code}`);
                    if (code !== 0 && !this.serverUrl) {
                        const panel = require('./FlutterWebEmulatorPanel').FlutterWebEmulatorPanel.currentPanel;
                        if (panel) {
                            panel._panel.webview.postMessage({
                                command: 'launchError',
                                message: `Flutter process exited with code ${code}. Check the Output channel for logs.`
                            });
                        }
                        reject(new Error(`Flutter exited with code ${code}. ${lastErrorLine ? 'Last log: ' + lastErrorLine : ''}`));
                    }
                });
                setTimeout(() => {
                    if (!this.serverUrl)
                        reject(new Error('Timeout: Flutter web server did not start within 5 minutes'));
                }, 300000);
            }
            catch (error) {
                this.isRunning = false;
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        });
    }
    stopFlutterWebServer() {
        if (this.flutterProcess && this.isRunning) {
            try {
                this.flutterProcess.stdin.write('q\n');
                setTimeout(() => {
                    if (this.flutterProcess && !this.flutterProcess.killed) {
                        if (process.platform === 'win32') {
                            child_process.execSync(`taskkill /pid ${this.flutterProcess.pid} /T /F`);
                        }
                        else {
                            process.kill(-this.flutterProcess.pid, 'SIGTERM');
                        }
                    }
                }, 2000);
            }
            catch (error) {
                console.error('Error stopping Flutter:', error);
            }
            this.flutterProcess = undefined;
            this.serverUrl = undefined;
            this.isRunning = false;
        }
    }
    triggerHotReload() {
        if (this.isRunning)
            this.enqueueCommand('r');
    }
    triggerHotRestart() {
        if (this.isRunning)
            this.enqueueCommand('R');
    }
    enqueueCommand(cmd) {
        const last = this.commandQueue.length ? this.commandQueue[this.commandQueue.length - 1] : undefined;
        if (last === cmd)
            return;
        this.commandQueue.push(cmd);
        this.processCommandQueue();
    }
    processCommandQueue() {
        if (this.processingQueue)
            return;
        if (!this.flutterProcess || !this.isRunning) {
            this.commandQueue = [];
            return;
        }
        this.processingQueue = true;
        const processNext = () => {
            if (!this.commandQueue.length) {
                this.processingQueue = false;
                return;
            }
            const cmd = this.commandQueue.shift();
            try {
                const ok = this.flutterProcess.stdin.write(cmd + '\n', 'utf8', (err) => {
                    if (err)
                        console.error('stdin write error:', err);
                    setTimeout(processNext, 150);
                });
                if (!ok) {
                    const onDrain = () => { this.flutterProcess.stdin.off('drain', onDrain); setTimeout(processNext, 50); };
                    this.flutterProcess.stdin.on('drain', onDrain);
                }
            }
            catch (error) {
                console.error('processCommandQueue error:', error);
                this.processingQueue = false;
            }
        };
        setImmediate(processNext);
    }
    isProcessRunning() { return this.isRunning; }
    getServerUrl() { return this.serverUrl; }
}
exports.FlutterProcessManager = FlutterProcessManager;
//# sourceMappingURL=FlutterProcessManager.js.map