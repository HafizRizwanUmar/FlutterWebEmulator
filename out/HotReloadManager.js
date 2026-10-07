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
exports.HotReloadManager = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class HotReloadManager {
    constructor() {
        this.isEnabled = true;
        this.debounceDelay = 350;
        this.reloadQueue = [];
        this.isReloading = false;
    }
    static getInstance() {
        if (!HotReloadManager.instance) {
            HotReloadManager.instance = new HotReloadManager();
        }
        return HotReloadManager.instance;
    }
    initialize(panel, processManager) {
        this.panel = panel;
        this.processManager = processManager;
        const config = vscode.workspace.getConfiguration('flutterWebEmulator');
        this.isEnabled = config.get('autoReload', true);
        this.setupFileWatcher();
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('flutterWebEmulator.autoReload')) {
                this.isEnabled = vscode.workspace.getConfiguration('flutterWebEmulator').get('autoReload', true);
            }
        });
    }
    setupFileWatcher() {
        if (this.fileWatcher)
            this.fileWatcher.dispose();
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders)
            return;
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspaceRoot, '**/*.dart'));
        this.fileWatcher.onDidChange(uri => this.handleFileChange(uri));
        this.fileWatcher.onDidCreate(uri => this.handleFileChange(uri));
        this.fileWatcher.onDidDelete(uri => this.handleFileChange(uri));
    }
    handleFileChange(uri) {
        if (this.debounceTimer)
            clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            if (!this.isEnabled)
                return;
            const workspaceFolders = vscode.workspace.workspaceFolders;
            const workspaceRoot = workspaceFolders ? workspaceFolders[0].uri.fsPath : '';
            const relativePath = path.relative(workspaceRoot, uri.fsPath);
            // Ignore changes in .dart_tool
            if (relativePath.includes('.dart_tool') || !relativePath.endsWith('.dart'))
                return;
            this.panel?.webview.postMessage({ command: 'fileChanged', fileName: relativePath, autoReload: this.isEnabled });
            this.panel?.webview.postMessage({ command: 'reloadStarted', fileName: relativePath });
            this.enqueueReload(uri.fsPath);
        }, this.debounceDelay);
    }
    enqueueReload(filePath) {
        const last = this.reloadQueue.length ? this.reloadQueue[this.reloadQueue.length - 1] : undefined;
        if (last === filePath)
            return;
        this.reloadQueue.push(filePath);
        this.processReloadQueue();
    }
    async processReloadQueue() {
        if (this.isReloading || !this.reloadQueue.length || !this.processManager)
            return;
        this.isReloading = true;
        this.reloadQueue.shift();
        try {
            // Use Hot Restart for web-server target — Hot Reload is unreliable in Flutter Web
            this.processManager.triggerHotRestart();
            await new Promise(res => setTimeout(res, 500));
        }
        catch (error) {
            console.error('Hot reload error:', error);
            this.panel?.webview.postMessage({ command: 'reloadError', message: String(error) });
        }
        finally {
            this.isReloading = false;
            if (this.reloadQueue.length)
                setTimeout(() => this.processReloadQueue(), 300);
        }
    }
    triggerHotReload() {
        if (this.processManager)
            this.processManager.triggerHotReload();
    }
    triggerHotRestart() {
        if (this.processManager)
            this.processManager.triggerHotRestart();
    }
    setAutoReloadEnabled(enabled) {
        this.isEnabled = enabled;
        vscode.workspace.getConfiguration('flutterWebEmulator').update('autoReload', enabled, vscode.ConfigurationTarget.Global);
    }
    dispose() {
        this.fileWatcher?.dispose();
        if (this.debounceTimer)
            clearTimeout(this.debounceTimer);
    }
}
exports.HotReloadManager = HotReloadManager;
//# sourceMappingURL=HotReloadManager.js.map