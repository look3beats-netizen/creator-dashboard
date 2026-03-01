// ═══════════════════════════════════════════════════════════
// creator® — modules/navigation.js
// Sidebar, переключение секций, скелетоны, hash-роутинг.
// Без localStorage. Без бизнес-логики релизов.
// ═══════════════════════════════════════════════════════════

import AppState from '../core/state.js';

// ─── Карта навигации ───
const NAV_MAP = {
  overview: 0,
  releases: 1,
  upload: 2,
  analytics: 3,
  platforms: 4,
  notifications: 5,
  profile: 6
};

const SKELETON_SCREENS = ['overview', 'releases', 'analytics', 'platforms'];

// ─── Колбэки при переходе на экран ───
let screenChangeCallbacks = {};

function onScreenChange(name, fn) {
  screenChangeCallbacks[name] = fn;
}

// ─── Показать экран ───
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = '';
    const sk = s.querySelector('.skeleton-overlay');
    if (sk) sk.remove();
  });

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const screen = document.getElementById('screen-' + name);
  if (!screen) return;

  if (SKELETON_SCREENS.includes(name)) {
    showSkeleton(screen);
    setTimeout(() => hideSkeleton(screen), 400);
  } else {
    screen.classList.add('active');
  }

  const items = document.querySelectorAll('.sidebar .nav-item');
  if (items[NAV_MAP[name]] !== undefined) {
    items[NAV_MAP[name]].classList.add('active');
  }

  window.scrollTo(0, 0);

  if (window.location.hash !== '#' + name) {
    history.replaceState(null, '', '#' + name);
  }

  if (screenChangeCallbacks[name]) {
    screenChangeCallbacks[name]();
  }
}

// ─── Скелетон ───
function showSkeleton(screen) {
  const existing = screen.querySelector('.skeleton-overlay');
  if (existing) existing.remove();

  screen.classList.add('active');
  screen.style.position = 'relative';

  const el = document.createElement('div');
  el.className = 'skeleton-overlay';
  el.style.cssText = 'position:absolute;inset:0;z-index:10;background:var(--bg);padding:40px 0;';
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:36px;">
      <div><div class="skeleton" style="width:200px;height:28px;margin-bottom:8px;"></div><div class="skeleton" style="width:140px;height:14px;"></div></div>
      <div class="skeleton" style="width:120px;height:36px;border-radius:8px;"></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px;">
      ${[1,2,3].map(() => `<div class="skeleton" style="height:100px;border-radius:16px;"></div>`).join('')}
    </div>
    ${[1,2,3].map(() => `<div class="skeleton-card" style="margin-bottom:12px;"><div class="sk-circle skeleton"></div><div style="flex:1;"><div class="sk-line skeleton" style="width:60%;margin-bottom:8px;"></div><div class="sk-line-sm skeleton" style="width:40%;"></div></div></div>`).join('')}
  `;
  screen.appendChild(el);
}

function hideSkeleton(screen) {
  const el = screen.querySelector('.skeleton-overlay');
  if (el) {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }
}

// ─── Hash-роутинг ───
function handleHashRoute() {
  const hash = window.location.hash.replace('#', '');
  if (hash && NAV_MAP[hash] !== undefined) {
    showScreen(hash);
  }
}

// ─── Event binding ───
function bindNavigationEvents() {
  // Делегированный обработчик для всех data-screen
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-screen]');
    if (el) {
      e.preventDefault();
      showScreen(el.dataset.screen);
      return;
    }

    // data-href — открытие в новой вкладке
    const hrefEl = e.target.closest('[data-href]');
    if (hrefEl) {
      e.preventDefault();
      window.open(hrefEl.dataset.href, '_blank');
    }
  });

  window.addEventListener('hashchange', handleHashRoute);
}

// ─── INIT ───
function initNavigation() {
  bindNavigationEvents();
  handleHashRoute();
}

export { initNavigation, showScreen, onScreenChange, NAV_MAP };