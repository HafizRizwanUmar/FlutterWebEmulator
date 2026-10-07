// Flutter Web Emulator — touch-events.js  v3.0
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  setupTilt();
  setupRipple();
});

function setupTilt() {
  const device = document.querySelector('.iphone-device');
  if (!device) return;

  device.addEventListener('mousemove', (e) => {
    const r  = device.getBoundingClientRect();
    const nx = ((e.clientX - r.left)  / r.width  - 0.5) * 2;
    const ny = ((e.clientY - r.top)   / r.height - 0.5) * 2;
    const tiltX =  ny * 4.5;
    const tiltY = -nx * 4.5;
    device.classList.add('tilting');
    device.style.transform = `perspective(1200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  });

  device.addEventListener('mouseleave', () => {
    device.classList.remove('tilting');
    device.classList.add('tilt-reset');
    device.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
    setTimeout(() => device.classList.remove('tilt-reset'), 520);
  });
}

function setupRipple() {
  const screen = document.querySelector('.iphone-screen');
  if (!screen) return;
  screen.addEventListener('mousedown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'button' || tag === 'select' || tag === 'input') return;
    const r = screen.getBoundingClientRect();
    spawnRipple(screen, e.clientX - r.left, e.clientY - r.top);
  });
}

function spawnRipple(parent, x, y) {
  const r = document.createElement('div');
  r.className = 'touch-ripple';
  r.style.left = x + 'px';
  r.style.top  = y + 'px';
  parent.appendChild(r);
  setTimeout(() => r.remove(), 520);
}
