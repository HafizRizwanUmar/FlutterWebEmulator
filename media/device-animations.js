// Flutter Web Emulator — device-animations.js  v3.0
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  injectStatusBar();
  startClock();
  startSignalCycle();
  startBatteryDrain();
});

function injectStatusBar() {
  const screen = document.querySelector('.iphone-screen');
  if (!screen || screen.querySelector('.iphone-statusbar')) return;

  const bar = document.createElement('div');
  bar.className = 'iphone-statusbar';
  bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML = `
    <div class="status-left">
      <span id="emu-clock">00:00</span>
    </div>
    <div class="status-right">
      <div class="signal-bars">
        <div class="signal-bar active" id="sb1"></div>
        <div class="signal-bar active" id="sb2"></div>
        <div class="signal-bar active" id="sb3"></div>
        <div class="signal-bar active" id="sb4"></div>
      </div>
      <span style="font-size:10px;opacity:.7;margin-left:2px;font-weight:600;">5G</span>
      <div class="battery-icon" style="margin-left:6px;">
        <div class="battery-level" id="emu-battery" style="width:80%;"></div>
      </div>
    </div>
  `;
  screen.insertBefore(bar, screen.firstChild);
}

function startClock() {
  tick();
  setInterval(tick, 15000);
}

function tick() {
  const el = document.getElementById('emu-clock');
  if (!el) return;
  const n = new Date();
  el.textContent = pad(n.getHours()) + ':' + pad(n.getMinutes());
}

function pad(n) { return String(n).padStart(2, '0'); }

const SIG_PATTERNS = [
  [1,1,1,1],[1,1,1,0],[1,1,1,1],
  [1,1,0,0],[1,1,1,1],[1,1,1,0]
];
let sigIdx = 0;

function startSignalCycle() {
  setInterval(() => {
    sigIdx = (sigIdx + 1) % SIG_PATTERNS.length;
    const p = SIG_PATTERNS[sigIdx];
    for (let i = 1; i <= 4; i++) {
      const bar = document.getElementById('sb' + i);
      if (bar) bar.classList.toggle('active', !!p[i-1]);
    }
  }, 6000);
}

let batteryPct = 72 + Math.floor(Math.random() * 22);

function startBatteryDrain() {
  updateBatteryUI();
  setInterval(() => {
    batteryPct = Math.max(5, batteryPct - (0.25 + Math.random() * 0.5));
    updateBatteryUI();
  }, 30000);
}

function updateBatteryUI() {
  const fill = document.getElementById('emu-battery');
  if (!fill) return;
  fill.style.width = batteryPct.toFixed(1) + '%';
  fill.classList.remove('warning', 'critical');
  if (batteryPct < 15) fill.classList.add('critical');
  else if (batteryPct < 30) fill.classList.add('warning');
}
