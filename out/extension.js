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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const FlutterWebEmulatorPanel_1 = require("./FlutterWebEmulatorPanel");
const FlutterProcessManager_1 = require("./FlutterProcessManager");
const HotReloadManager_1 = require("./HotReloadManager");
const AdbMirrorManager_1 = require("./AdbMirrorManager");
const WEBSITE_URL = 'https://flutterwebemulator.site';
function activate(context) {
    console.log('flutterWebEmulator extension is now active');
    const processManager = new FlutterProcessManager_1.FlutterProcessManager();
    const hotReloadManager = HotReloadManager_1.HotReloadManager.getInstance();
    const adbMirrorManager = AdbMirrorManager_1.AdbMirrorManager.getInstance();
    // Status bar items
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = '$(play) Flutter flutterWebEmulator';
    statusBarItem.tooltip = 'Start flutterWebEmulator';
    statusBarItem.command = 'flutterWebEmulator.start';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    const adbStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    adbStatusBarItem.text = '$(device-mobile) Android Mirror';
    adbStatusBarItem.tooltip = 'Mirror your Android device screen inside VS Code';
    adbStatusBarItem.command = 'flutterWebEmulator.startAdbMirror';
    adbStatusBarItem.show();
    context.subscriptions.push(adbStatusBarItem);
    const startCommand = vscode.commands.registerCommand('flutterWebEmulator.start', async () => {
        const panel = FlutterWebEmulatorPanel_1.FlutterWebEmulatorPanel.createOrShow(context, processManager);
        if (panel) {
            await vscode.commands.executeCommand('workbench.action.moveEditorToRightGroup');
            hotReloadManager.initialize(panel, processManager);
        }
    });
    const reloadCommand = vscode.commands.registerCommand('flutterWebEmulator.reload', () => {
        FlutterWebEmulatorPanel_1.FlutterWebEmulatorPanel.reload();
        hotReloadManager.triggerHotReload();
    });
    const rotateCommand = vscode.commands.registerCommand('flutterWebEmulator.rotate', () => {
        FlutterWebEmulatorPanel_1.FlutterWebEmulatorPanel.rotate();
    });
    const thanksCommand = vscode.commands.registerCommand('flutterWebEmulator.showThanks', () => {
        vscode.window.showInformationMessage('Thank you for using flutterWebEmulator!');
    });
    const websiteCommand = vscode.commands.registerCommand('flutterWebEmulator.openWebsite', () => {
        openWebsiteInChrome();
    });
    const adbMirrorCommand = vscode.commands.registerCommand('flutterWebEmulator.startAdbMirror', async () => {
        const adbAvailable = await adbMirrorManager.isAdbAvailable();
        if (!adbAvailable) {
            // Bundled ADB should always be present — this only fires if something
            // went wrong with the extension installation (missing platform-tools folder).
            vscode.window.showErrorMessage('Bundled ADB not found. Try reinstalling the extension. If the issue persists, set a manual ADB path in settings.', 'Open Settings').then(sel => {
                if (sel === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'flutterWebEmulator.adbPath');
                }
            });
            return;
        }
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Scanning for Android devices...' }, async () => {
            const devices = await adbMirrorManager.getConnectedDevices();
            if (devices.length === 0) {
                vscode.window.showWarningMessage('No Android devices found. Enable USB Debugging on your phone and reconnect.');
                return;
            }
            const unauthorized = devices.filter(d => d.status === 'unauthorized');
            if (unauthorized.length > 0) {
                vscode.window.showWarningMessage(`${unauthorized.length} device(s) awaiting authorization — check your phone for the USB debugging prompt.`);
            }
            const connected = devices.filter(d => d.status === 'connected');
            if (connected.length === 0)
                return;
            let deviceId;
            if (connected.length === 1) {
                deviceId = connected[0].id;
            }
            else {
                const pick = await vscode.window.showQuickPick(connected.map(d => ({ label: d.name, detail: d.id, description: 'connected', id: d.id })), { placeHolder: 'Select a device to mirror' });
                if (!pick)
                    return;
                deviceId = pick.id;
            }
            const panel = FlutterWebEmulatorPanel_1.FlutterWebEmulatorPanel.createOrShowMirror(context, processManager, adbMirrorManager, deviceId);
            if (panel) {
                await vscode.commands.executeCommand('workbench.action.moveEditorToRightGroup');
                const deviceName = connected.find(d => d.id === deviceId)?.name || deviceId;
                vscode.window.showInformationMessage(`Mirroring ${deviceName}...`);
            }
        });
    });
    const stopAdbMirrorCommand = vscode.commands.registerCommand('flutterWebEmulator.stopAdbMirror', () => {
        adbMirrorManager.stopMirror();
        vscode.window.showInformationMessage('Android mirroring stopped.');
    });
    const screenshotCommand = vscode.commands.registerCommand('flutterWebEmulator.screenshot', async () => {
        // Trigger via webview message
        FlutterWebEmulatorPanel_1.FlutterWebEmulatorPanel.currentPanel?._panel?.webview.postMessage({ command: 'requestScreenshot' });
    });
    context.subscriptions.push(startCommand, reloadCommand, rotateCommand, thanksCommand, websiteCommand, adbMirrorCommand, stopAdbMirrorCommand, screenshotCommand);
}
async function openWebsiteInChrome() {
    try {
        const terminal = vscode.window.createTerminal('flutterWebEmulator');
        const platform = process.platform;
        let cmd = '';
        if (platform === 'win32')
            cmd = `start chrome "${WEBSITE_URL}"`;
        else if (platform === 'darwin')
            cmd = `open -a "Google Chrome" "${WEBSITE_URL}"`;
        else
            cmd = `google-chrome "${WEBSITE_URL}" || xdg-open "${WEBSITE_URL}"`;
        terminal.sendText(cmd);
        terminal.hide();
    }
    catch {
        vscode.env.openExternal(vscode.Uri.parse(WEBSITE_URL));
    }
}
function deactivate() {
    try {
        FlutterWebEmulatorPanel_1.FlutterWebEmulatorPanel.dispose();
        HotReloadManager_1.HotReloadManager.getInstance().dispose();
        AdbMirrorManager_1.AdbMirrorManager.getInstance().dispose();
    }
    catch (e) {
        console.error('Deactivation error:', e);
    }
}
//# sourceMappingURL=extension.js.map