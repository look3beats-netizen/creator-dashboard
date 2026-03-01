// ═══════════════════════════════════════════════════════════
// creator® — modules/ui.js
// Тема, onboarding, профиль, logout, loading screen.
// Без прямого localStorage — через dataProvider.
// Не импортирует navigation.js и releases.js.
// ═══════════════════════════════════════════════════════════

import AppState from '../core/state.js';
import {
  getTheme,
  setTheme,
  getCurrentUser,
  setCurrentUser,
  removeCurrentUser,
  getUsers,
  saveUsers,
  isOnboardingDone,
  setOnboardingDone
} from '../core/dataProvider.js';

// ─── Колбэк на showToast (инжектируется из bootstrap) ───
let _showToast = null;
function setShowToast(fn) { _showToast = fn; }
function toast(msg, type) { if (_showToast) _showToast(msg, type); }

// ═══════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════

function initTheme() {
  const saved = getTheme();
  if (saved === 'light') document.body.classList.add('light');
  updateThemeButton();
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  setTheme(isLight ? 'light' : 'dark');
  updateThemeButton();
}

function updateThemeButton() {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    const isLight = document.body.classList.contains('light');
    btn.textContent = isLight ? '🌙' : '☀️';
  }
}

// ═══════════════════════════════════════════════════════════
// AUTH CHECK
// ═══════════════════════════════════════════════════════════

function checkAuth() {
  AppState.currentUser = getCurrentUser();
  if (!AppState.currentUser) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════
// USER DISPLAY INIT
// ═══════════════════════════════════════════════════════════

function initUserDisplay() {
  const user = AppState.currentUser;
  if (!user) return;

  document.getElementById('sidebar-name').textContent = user.name;
  document.getElementById('sidebar-email').textContent = user.email;
  document.getElementById('sidebar-avatar').textContent = user.name.charAt(0).toUpperCase();
  document.getElementById('welcome-name').textContent = user.name;
  document.getElementById('profile-avatar-big').textContent = user.name.charAt(0).toUpperCase();
  document.getElementById('profile-name-big').textContent = user.name;
  document.getElementById('profile-email-big').textContent = user.email;
  document.getElementById('settings-name').value = user.name;
  document.getElementById('settings-email').value = user.email;
  const d = new Date(user.createdAt);
  document.getElementById('profile-stat-date').textContent = d.toLocaleDateString('ru-RU');
}

// ═══════════════════════════════════════════════════════════
// PROFILE SAVE
// ═══════════════════════════════════════════════════════════

function saveProfile() {
  const name = document.getElementById('settings-name').value.trim();
  const email = document.getElementById('settings-email').value.trim();
  const password = document.getElementById('settings-password').value;

  if (!name || !email) { toast('⚠️ Заполни имя и email', 'error'); return; }

  const users = getUsers();
  const idx = users.findIndex(u => u.email === AppState.currentUser.email);

  if (idx !== -1) {
    users[idx].name = name;
    users[idx].email = email;
    if (password.length >= 6) users[idx].password = password;
    saveUsers(users);
    AppState.currentUser.name = name;
    AppState.currentUser.email = email;
    setCurrentUser(AppState.currentUser);
    document.getElementById('sidebar-name').textContent = name;
    document.getElementById('sidebar-email').textContent = email;
    document.getElementById('sidebar-avatar').textContent = name.charAt(0).toUpperCase();
    document.getElementById('profile-name-big').textContent = name;
    document.getElementById('profile-email-big').textContent = email;
    document.getElementById('profile-avatar-big').textContent = name.charAt(0).toUpperCase();
    document.getElementById('welcome-name').textContent = name;
    toast('✅ Профиль сохранён', 'success');
    document.getElementById('settings-password').value = '';
  }
}

// ═══════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════

function logout() {
  removeCurrentUser();
  window.location.href = 'login.html';
}

// ═══════════════════════════════════════════════════════════
// LOADING SCREEN
// ═══════════════════════════════════════════════════════════

function initLoadingScreen() {
  setTimeout(() => {
    const el = document.getElementById('loading-screen');
    if (el) el.classList.add('hidden');
  }, 1200);
}

// ═══════════════════════════════════════════════════════════
// ONBOARDING
// ═══════════════════════════════════════════════════════════

const onboardingSteps = [
  { icon: '👋', title: 'Добро пожаловать в creator®!', desc: 'Рады видеть тебя! Давай быстро покажем, как всё устроено — это займёт 30 секунд.' },
  { icon: '⬆️', title: 'Загрузи свой первый релиз', desc: 'Нажми «Загрузить релиз» в меню слева. Заполни 3 простых шага — название, файлы, и готово!' },
  { icon: '📊', title: 'Следи за аналитикой', desc: 'Раздел «Аналитика» покажет статистику всех твоих релизов — жанры, статусы, динамику.' },
  { icon: '🌐', title: 'Твоя музыка — на 30+ платформах', desc: 'Spotify, Apple Music, Яндекс Музыка, VK и другие. Проверяй подключения в разделе «Платформы».' },
  { icon: '🚀', title: 'Всё готово!', desc: 'Теперь ты знаешь основы. Загружай релизы, следи за статусами и создавай музыку. Удачи!' },
];

function renderOnboardingDots() {
  const dots = document.getElementById('ob-dots');
  if (!dots) return;
  dots.innerHTML = onboardingSteps.map((_, i) =>
    `<div class="onboarding-dot${i === AppState.onboardingStep ? ' active' : ''}"></div>`
  ).join('');
}

function showOnboardingStep() {
  const s = onboardingSteps[AppState.onboardingStep];
  document.getElementById('ob-icon').textContent = s.icon;
  document.getElementById('ob-title').textContent = s.title;
  document.getElementById('ob-desc').textContent = s.desc;
  document.getElementById('ob-next').textContent = AppState.onboardingStep === onboardingSteps.length - 1 ? 'Начать работу 🎉' : 'Далее →';
  renderOnboardingDots();
}

function nextOnboarding() {
  AppState.onboardingStep++;
  if (AppState.onboardingStep >= onboardingSteps.length) {
    skipOnboarding();
    return;
  }
  showOnboardingStep();
}

function skipOnboarding() {
  document.getElementById('onboarding').classList.remove('show');
  setOnboardingDone();
}

function initOnboarding() {
  setTimeout(() => {
    if (!isOnboardingDone() && AppState.currentUser) {
      AppState.onboardingStep = 0;
      showOnboardingStep();
      document.getElementById('onboarding').classList.add('show');
    }
  }, 1600);
}

// ═══════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════

let _getReleasesFn = null;
function setGetReleases(fn) { _getReleasesFn = fn; }

function renderAnalytics() {
  const releases = _getReleasesFn ? _getReleasesFn() : [];
  const total = releases.length;
  const published = releases.filter(r => r.status === 'published').length;
  const pending = releases.filter(r => r.status === 'pending' || r.status === 'review').length;
  const totalTracks = releases.reduce((sum, r) => sum + (r.trackCount || 1), 0);

  document.getElementById('analytics-cards').innerHTML = `
    <div class="analytics-card">
      <div class="a-label">Всего релизов</div>
      <div class="a-value grad">${total}</div>
      <div class="a-change up">загружено</div>
    </div>
    <div class="analytics-card">
      <div class="a-label">Всего треков</div>
      <div class="a-value grad">${totalTracks}</div>
      <div class="a-change up">аудиофайлов</div>
    </div>
    <div class="analytics-card">
      <div class="a-label">Опубликовано</div>
      <div class="a-value" style="color:#27C93F;">${published}</div>
      <div class="a-change up">${total ? Math.round(published/total*100) : 0}% от всех</div>
    </div>
    <div class="analytics-card">
      <div class="a-label">На проверке</div>
      <div class="a-value" style="color:#FFBD2E;">${pending}</div>
      <div class="a-change">${total ? Math.round(pending/total*100) : 0}% от всех</div>
    </div>
  `;

  const months = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
  const monthlyCounts = new Array(12).fill(0);
  releases.forEach(r => {
    const m = new Date(r.createdAt).getMonth();
    monthlyCounts[m]++;
  });
  const maxM = Math.max(...monthlyCounts, 1);
  document.getElementById('chart-monthly').innerHTML = months.map((m, i) => `
    <div class="bar-col">
      <div class="bar-value">${monthlyCounts[i] || ''}</div>
      <div class="bar-fill" style="height:${(monthlyCounts[i]/maxM)*140}px;"></div>
      <div class="bar-label">${m}</div>
    </div>
  `).join('');

  const genreCounts = {};
  releases.forEach(r => { genreCounts[r.genre] = (genreCounts[r.genre] || 0) + 1; });
  const genres = Object.entries(genreCounts).sort((a,b) => b[1] - a[1]).slice(0, 6);
  const maxG = Math.max(...genres.map(g => g[1]), 1);
  document.getElementById('chart-genres').innerHTML = genres.length ? genres.map(([g, c]) => `
    <div class="bar-col">
      <div class="bar-value">${c}</div>
      <div class="bar-fill" style="height:${(c/maxG)*140}px;"></div>
      <div class="bar-label">${g.length > 8 ? g.slice(0,8)+'…' : g}</div>
    </div>
  `).join('') : '<div style="color:var(--muted);font-size:14px;padding:40px;text-align:center;width:100%;">Загрузи релизы чтобы увидеть статистику</div>';

  const statusCounts = { published: 0, pending: 0, review: 0, rejected: 0 };
  releases.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });
  const statusColors = { published: '#27C93F', pending: '#FFBD2E', review: '#818CF8', rejected: '#E8215A' };
  const statusLabels = { published: 'Опубликовано', pending: 'На проверке', review: 'Обрабатывается', rejected: 'Отклонено' };
  document.getElementById('status-bars').innerHTML = Object.entries(statusCounts).map(([k, v]) => `
    <div style="flex:1;min-width:120px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:12px;font-weight:700;color:var(--muted);">${statusLabels[k]}</span>
        <span style="font-size:12px;font-weight:800;">${v}</span>
      </div>
      <div style="height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${total ? (v/total*100) : 0}%;background:${statusColors[k]};border-radius:4px;transition:width 0.6s;"></div>
      </div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════
// EVENT BINDING (delegated)
// ═══════════════════════════════════════════════════════════

function bindUIEvents() {
  document.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]');
    if (!action) return;

    switch (action.dataset.action) {
      case 'toggle-theme':     toggleTheme(); break;
      case 'logout':           logout(); break;
      case 'save-profile':     saveProfile(); break;
      case 'next-onboarding':  nextOnboarding(); break;
      case 'skip-onboarding':  skipOnboarding(); break;
    }
  });
}

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════

function initUI() {
  initTheme();
  if (!checkAuth()) return;
  initUserDisplay();
  initLoadingScreen();
  initOnboarding();
  bindUIEvents();
}

export {
  initUI,
  renderAnalytics,
  setShowToast,
  setGetReleases
};