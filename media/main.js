// Flutter Web Emulator — main.js  v4.0
'use strict';

const emuState = {
  isPortrait: true,
  appUrl: '',
  devControlsVisible: false,
  currentDevice: null,
};

document.addEventListener('DOMContentLoaded', () => {
  setupIframeHandlers();
  setupPhysicalButtons();
  setupKeyboardShortcuts();
  // Apply default device dimensions on load
  if (typeof currentDeviceName === 'string') changeDevice(currentDeviceName);
});

/* ── iframe ────────────────────────────────────────────────────────────── */
function setupIframeHandlers() {
  const iframe = document.getElementById('flutter-app');
  if (!iframe) return;
  iframe.classList.add('app-loading');
  iframe.addEventListener('load', () => {
    if (!emuState.appUrl) return;
    // Inject scrollbar-killing CSS into the loaded Flutter app
    suppressScrollbarsInIframe(iframe);
    hideLoadingOverlay();
    iframe.classList.remove('app-loading');
    iframe.classList.add('app-loaded');
    flashHotReload();
  });
}

/**
 * Inject a <style> tag into the iframe document to kill all scrollbars
 * and force the body to match the viewport — gives a native app feel.
 */
function suppressScrollbarsInIframe(iframe) {
  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    // Remove any existing injected style
    const existing = doc.getElementById('__emu_no_scroll__');
    if (existing) existing.remove();
    const style = doc.createElement('style');
    style.id = '__emu_no_scroll__';
    style.textContent = [
      '::-webkit-scrollbar { display: none !important; width: 0 !important; }',
      'html, body { overflow: hidden !important; overscroll-behavior: none !important;',
      '  scrollbar-width: none !important; -ms-overflow-style: none !important; }',
    ].join(' ');
    (doc.head || doc.documentElement).appendChild(style);
  } catch (e) {
    // Cross-origin or not yet loaded — silently ignore
  }
}

/* ── Physical Buttons ──────────────────────────────────────────────────── */
function setupPhysicalButtons() {
  btnBind('.btn-power',           'powerButton');
  btnBind('.btn-volume.btn-up',   'volumeUp');
  btnBind('.btn-volume.btn-down', 'volumeDown');
}

function btnBind(selector, command) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.addEventListener('mousedown', () => el.classList.add('pressed'));
  el.addEventListener('mouseup',   () => { el.classList.remove('pressed'); vscode.postMessage({ command }); });
  el.addEventListener('mouseleave',() => el.classList.remove('pressed'));
}

/* ── Keyboard Shortcuts ─────────────────────────────────────────────────── */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && e.key === 'r') { e.preventDefault(); triggerManualReload(); }
    if (mod &&  e.shiftKey && e.key === 'R') { e.preventDefault(); doRotate(); }
    if (mod && e.key === 'd')                { e.preventDefault(); toggleDevControls(); }
  });
}



/* ── Device Switching ───────────────────────────────────────────────────── */
/**
 * Apply a device preset by name.
 * Sets --pw and --ph as CSS vars, but clamps --pw so the phone always
 * fits within the available panel width (no horizontal overflow / scrollbar).
 */
function changeDevice(name) {
  if (typeof devicePresets !== 'object' || !devicePresets[name]) return;
  emuState.currentDevice = name;
  const { width: w, height: h } = devicePresets[name];
  applyDeviceDimensions(w, h, emuState.isPortrait);
  vscode.postMessage({ command: 'deviceChanged', device: name });
}

function applyDeviceDimensions(logicalW, logicalH, isPortrait) {
  const root = document.documentElement;
  // Portrait: w=logical width, h=logical height
  // Landscape: swap
  const physW = isPortrait ? logicalW : logicalH;
  const physH = isPortrait ? logicalH : logicalW;
  const ratio = physW / physH; // e.g. 390/844 = 0.4622

  // Height: use CSS var (viewport-based), read its computed value
  const viewH = window.innerHeight;
  const maxH = Math.min(viewH * 0.92, 780);

  // Width: derived from height keeping aspect ratio, but also capped to viewport width
  const derivedW = maxH * ratio;
  const maxW = window.innerWidth * (isPortrait ? 0.44 : 0.88);
  const finalW = Math.min(derivedW, maxW);
  // If width-constrained, recalculate height
  const finalH = finalW < derivedW ? finalW / ratio : maxH;

  root.style.setProperty('--base-pw', Math.round(finalW) + 'px');
  root.style.setProperty('--base-ph', Math.round(finalH) + 'px');
}

/* ── Actions ────────────────────────────────────────────────────────────── */
function triggerManualReload() {
  vscode.postMessage({ command: 'reload' });
  // We don't refresh the iframe immediately here because the extension
  // will send a 'hotReloadFinished' message once compilation is actually done.
}

function refreshAppIframe() {
  const iframe = document.getElementById('flutter-app');
  if (iframe && emuState.appUrl) {
    const u = new URL(emuState.appUrl);
    u.searchParams.set('_t', Date.now());
    iframe.classList.remove('app-loaded');
    iframe.classList.add('app-loading');
    iframe.src = u.toString();
  }
}

function doRotate() {
  emuState.isPortrait = !emuState.isPortrait;
  const device = document.querySelector('.iphone-device');
  if (device) {
    device.classList.toggle('portrait',   emuState.isPortrait);
    device.classList.toggle('landscape', !emuState.isPortrait);
    device.classList.add('rotating');
    setTimeout(() => device.classList.remove('rotating'), 560);
  }
  // Reapply dimensions with flipped orientation
  if (emuState.currentDevice && typeof devicePresets === 'object') {
    const p = devicePresets[emuState.currentDevice];
    if (p) applyDeviceDimensions(p.width, p.height, emuState.isPortrait);
  }
  vscode.postMessage({ command: 'rotate', isPortrait: emuState.isPortrait });
}

/* ── Loading Overlay ─────────────────────────────────────────────────────── */
function showLoadingOverlay() {
  const ol = document.getElementById('loading-overlay');
  if (ol) { ol.style.opacity = '1'; ol.style.display = 'flex'; }
}

function hideLoadingOverlay() {
  const ol = document.getElementById('loading-overlay');
  if (!ol) return;
  window.dispatchEvent(new MessageEvent('message', { data: { command: 'loadingDone' } }));
    setTimeout(() => {
    ol.style.opacity = '0';
    setTimeout(() => { ol.style.display = 'none'; }, 350);
  }, 400);
}

/* ── Error Screen ────────────────────────────────────────────────────────── */
function showError(message) {
  const errScreen = document.getElementById('error-screen');
  const errMsg = document.getElementById('err-msg');
  const loadingOverlay = document.getElementById('loading-overlay');
  
  if (loadingOverlay) loadingOverlay.style.display = 'none';
  if (errScreen && errMsg) {
    errMsg.textContent = message || 'An unknown error occurred.';
    errScreen.classList.add('active');
  }
}

function hideError() {
  const errScreen = document.getElementById('error-screen');
  if (errScreen) errScreen.classList.remove('active');
}

/* ── Hot Reload Flash ───────────────────────────────────────────────────── */
function flashHotReload() {
  const device = document.querySelector('.iphone-device');
  const screen = document.querySelector('.iphone-screen');
  if (!device) return;
  device.classList.remove('hot-reload-flash');
  void device.offsetWidth;
  device.classList.add('hot-reload-flash');
  setTimeout(() => device.classList.remove('hot-reload-flash'), 700);
  if (screen) {
    const tint = document.createElement('div');
    tint.className = 'hot-reload-tint';
    screen.appendChild(tint);
    setTimeout(() => tint.remove(), 520);
  }
}

/* ── Handle resize — keep device dimensions correct ────────────────────── */
window.addEventListener('resize', () => {
  if (emuState.currentDevice && typeof devicePresets === 'object') {
    const p = devicePresets[emuState.currentDevice];
    if (p) applyDeviceDimensions(p.width, p.height, emuState.isPortrait);
  }
});

/* ── Messages from Extension ─────────────────────────────────────────────── */
window.addEventListener('message', (event) => {
  const msg = event.data;

  switch (msg.command) {

    case 'setAppUrl': {
      emuState.appUrl = msg.url;
      const iframe = document.getElementById('flutter-app');
      if (iframe) {
        showLoadingOverlay();
        iframe.classList.add('app-loading');
        iframe.classList.remove('app-loaded');
        requestAnimationFrame(() => { iframe.src = msg.url; });
      }
      break;
    }

    case 'reload':
      triggerManualReload();
      break;

    case 'hotReload':
      // Hot reload: don't full-reload the iframe, just flash to signal change
      // The Flutter app itself handles the hot reload via the process manager
      flashHotReload();
      break;

    case 'rotate': {
      emuState.isPortrait = (msg.isPortrait !== undefined) ? msg.isPortrait : !emuState.isPortrait;
      const device = document.querySelector('.iphone-device');
      if (device) {
        device.classList.toggle('portrait',   emuState.isPortrait);
        device.classList.toggle('landscape', !emuState.isPortrait);
        device.classList.add('rotating');
        setTimeout(() => device.classList.remove('rotating'), 560);
      }
      if (emuState.currentDevice && typeof devicePresets === 'object') {
        const p = devicePresets[emuState.currentDevice];
        if (p) applyDeviceDimensions(p.width, p.height, emuState.isPortrait);
      }
      break;
    }

    case 'fileChanged': {
      // Overlay & reload is handled by hot-reload.js state machine.
      // Just do the border flash here as a secondary visual cue.
      const screen = document.querySelector('.iphone-screen');
      if (screen) {
        screen.classList.add('file-changed');
        setTimeout(() => screen.classList.remove('file-changed'), 420);
      }
      break;
    }

    case 'hotReloadFinished': {
      // Flutter process signalled success — reload the iframe so changes appear.
      if (!isMirrorMode) {
        hideError();
        refreshAppIframe();
        // Re-inject scrollbar suppression after new content loads
        const iframe = document.getElementById('flutter-app');
        if (iframe) setTimeout(() => suppressScrollbarsInIframe(iframe), 1800);
      }
      break;
    }

    case 'launchError':
    case 'reloadError':
      showError(msg.message);
      break;
  }
});
