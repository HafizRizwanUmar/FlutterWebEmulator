// Flutter Web Emulator — hot-reload.js  v4.0
// Smooth, state-aware hot reload overlay with Dynamic Island activity
'use strict';

/* ── State ────────────────────────────────────────────────────────── */
const HR = {
  overlay: null,
  pill: null,
  hideTimer: null,
  safetyTimer: null,
  isVisible: false,
  state: 'idle', // 'idle' | 'reloading' | 'success' | 'error'
};

document.addEventListener('DOMContentLoaded', initHotReloadOverlay);

function initHotReloadOverlay() {
  // Find overlay injected by the panel HTML
  HR.overlay = document.getElementById('hot-reload-overlay');
  HR.pill    = document.getElementById('hr-pill');
}

/* ── Message listener ─────────────────────────────────────────────── */
window.addEventListener('message', (event) => {
  const { command, message } = event.data || {};

  switch (command) {
    case 'reloadStarted':
    case 'fileChanged':
      showReloading();
      break;

    case 'hotReloadFinished':
      showSuccess();
      break;

    case 'reloadError':
      showError(message);
      break;

    // Legacy compat
    case 'hotReload':
      playLegacyFlash();
      break;
  }
});

/* ── Show states ──────────────────────────────────────────────────── */
function showReloading() {
  clearTimers();
  HR.state = 'reloading';

  setPillContent(
    `<div class="hr-spinner"></div>`,
    'Reloading…',
    'state-reloading'
  );
  revealOverlay();

  // Dynamic Island: expand + blue speaker glow
  setNotchReloading(true);

  // Device border pulse
  const device = document.querySelector('.iphone-device');
  if (device) device.classList.add('is-reloading');

  // Safety timeout — hide after 25s if no response from Flutter
  HR.safetyTimer = setTimeout(() => {
    if (HR.state === 'reloading') hideOverlay(true);
  }, 25000);
}

function showSuccess() {
  if (HR.state === 'idle') return;
  clearTimers();
  HR.state = 'success';

  setPillContent(
    `<svg class="hr-icon-success" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`,
    'Hot Restart Done',
    'state-success'
  );

  // Stop device border pulse, do success glow flash instead
  const device = document.querySelector('.iphone-device');
  if (device) {
    device.classList.remove('is-reloading');
    // Quick green-glow burst
    device.classList.remove('hot-reload-flash');
    void device.offsetWidth;
    device.classList.add('hot-reload-flash');
    setTimeout(() => device.classList.remove('hot-reload-flash'), 700);
  }

  // Screen tint
  const screen = document.querySelector('.iphone-screen');
  if (screen) {
    const tint = document.createElement('div');
    tint.className = 'hot-reload-tint';
    screen.appendChild(tint);
    setTimeout(() => tint.remove(), 520);
  }

  setNotchReloading(false);

  // Auto-hide after 1.5 s
  HR.hideTimer = setTimeout(() => hideOverlay(false), 1500);
}

function showError(msg) {
  clearTimers();
  HR.state = 'error';

  setPillContent(
    `<svg class="hr-icon-error" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0zm-7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-1-9a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0V6a1 1 0 0 0-1-1z" clip-rule="evenodd"/></svg>`,
    'Build Error',
    'state-error'
  );

  // Stop pulsing, remove reloading state
  const device = document.querySelector('.iphone-device');
  if (device) device.classList.remove('is-reloading');
  setNotchReloading(false);

  // Auto-hide error after 5 s
  HR.hideTimer = setTimeout(() => hideOverlay(false), 5000);
}

/* ── Overlay visibility ───────────────────────────────────────────── */
function revealOverlay() {
  if (!HR.overlay) return;
  HR.overlay.classList.remove('hiding');
  HR.overlay.classList.add('visible');
  HR.isVisible = true;
}

function hideOverlay(immediate) {
  if (!HR.overlay) return;
  HR.state = 'idle';
  HR.isVisible = false;

  // Stop any device animation lingering
  const device = document.querySelector('.iphone-device');
  if (device) device.classList.remove('is-reloading');

  if (immediate) {
    HR.overlay.classList.remove('visible', 'hiding');
  } else {
    HR.overlay.classList.remove('visible');
    HR.overlay.classList.add('hiding');
    setTimeout(() => HR.overlay?.classList.remove('hiding'), 420);
  }
}

/* ── Helpers ──────────────────────────────────────────────────────── */
function setPillContent(iconHtml, label, stateClass) {
  if (!HR.pill) return;
  HR.pill.className = `hr-pill ${stateClass}`;
  HR.pill.innerHTML = `${iconHtml}<span>${label}</span>`;
}

function setNotchReloading(on) {
  const notch = document.getElementById('notch');
  if (!notch) return;
  if (on) {
    notch.classList.add('reloading-activity');
  } else {
    notch.classList.remove('reloading-activity');
  }
}

function clearTimers() {
  if (HR.hideTimer)   { clearTimeout(HR.hideTimer);   HR.hideTimer   = null; }
  if (HR.safetyTimer) { clearTimeout(HR.safetyTimer); HR.safetyTimer = null; }
}

/* ── Legacy flash (backwards compat) ─────────────────────────────── */
function playLegacyFlash() {
  const device = document.querySelector('.iphone-device');
  const screen = document.querySelector('.iphone-screen');
  if (device) {
    device.classList.remove('hot-reload-flash');
    void device.offsetWidth;
    device.classList.add('hot-reload-flash');
    setTimeout(() => device.classList.remove('hot-reload-flash'), 700);
  }
  if (screen) {
    const tint = document.createElement('div');
    tint.className = 'hot-reload-tint';
    screen.appendChild(tint);
    setTimeout(() => tint.remove(), 520);
  }
}
