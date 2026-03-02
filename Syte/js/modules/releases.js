// ═══════════════════════════════════════════════════════════
// creator® — modules/releases.js
// Форма релиза, валидация, превью обложки, drag&drop,
// управление треками, таблица, фильтры, модалки, датапикер,
// артист-система, autosave, платформы.
// Без прямого localStorage — всё через dataProvider.
// ═══════════════════════════════════════════════════════════

import AppState from '../core/state.js';
import {
  getReleasesByEmail,
  addRelease as dpAddRelease,
  deleteRelease as dpDeleteRelease,
  findReleaseById,
  getArtistProfiles as dpGetArtistProfiles,
  saveArtistProfiles as dpSaveArtistProfiles,
  getNotifications as dpGetNotifications,
  saveNotifications as dpSaveNotifications,
  getDraft as dpGetDraft,
  saveDraft as dpSaveDraft,
  removeDraft as dpRemoveDraft
} from '../core/dataProvider.js';

// ─── Ссылка на renderAnalytics (инжектируется из bootstrap) ───
let _renderAnalytics = null;
function setRenderAnalytics(fn) { _renderAnalytics = fn; }

// ─── TOAST (UI helper, остаётся здесь т.к. плотно связан) ───
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── UTIL ───
function timeAgo(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return mins + ' мин';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + ' ч';
  const days = Math.floor(hours / 24);
  return days + ' дн';
}

// ═══════════════════════════════════════════════════════════
// RELEASES — чтение, рендер карточек, статистика
// ═══════════════════════════════════════════════════════════

function getReleases() {
  return getReleasesByEmail(AppState.currentUser.email);
}

function renderReleaseCard(r) {
  const statusMap = {
    pending:   { cls: 'status-pending',   label: 'На проверке' },
    review:    { cls: 'status-review',    label: 'Обрабатывается' },
    published: { cls: 'status-published', label: 'Опубликован' },
    rejected:  { cls: 'status-rejected',  label: 'Отклонён' },
  };
  const typeIcons = { single: '🎵', ep: '💿', album: '📀' };
  const typeNames = { single: 'Сингл', ep: 'EP', album: 'Альбом' };
  const s = statusMap[r.status] || statusMap.pending;
  const icon = typeIcons[r.type] || '🎵';
  const typeName = typeNames[r.type] || 'Сингл';
  const date = new Date(r.createdAt).toLocaleDateString('ru-RU');
  const coverHtml = r.coverData?.startsWith('data:')
    ? `<img src="${r.coverData}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`
    : icon;
  return `
    <div class="release-card" id="card-${r.id}" data-release-id="${r.id}">
      <div class="release-cover" data-action="open" style="cursor:pointer;overflow:hidden;">${coverHtml}</div>
      <div class="release-info" data-action="open" style="cursor:pointer;">
        <div class="release-title">${r.title}</div>
        <div class="release-meta">${r.artist}${r.feat ? ' feat. ' + r.feat : ''} · ${typeName} · ${r.genre}</div>
      </div>
      <span class="status ${s.cls}" data-action="open" style="cursor:pointer;">${s.label}</span>
      <div class="release-date" data-action="open" style="cursor:pointer;">${date}<br><span style="font-size:11px;color:var(--muted2);">Дата: ${r.releaseDate || '—'}</span></div>
      <button data-action="delete" style="background:rgba(232,33,90,0.08);border:1px solid rgba(232,33,90,0.2);color:#E8215A;width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background 0.2s;">🗑</button>
    </div>`;
}

function renderReleases() {
  const releases = getReleases();
  const total = releases.length;
  const published = releases.filter(r => r.status === 'published').length;
  const pending = releases.filter(r => r.status === 'pending' || r.status === 'review').length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-published').textContent = published;
  document.getElementById('stat-pending').textContent = pending;
  document.getElementById('profile-stat-total').textContent = total;

  const emptyHtml = `
    <div class="empty-state">
      <div class="empty-icon">🎵</div>
      <p>Релизов пока нет. Загрузи свой первый трек!</p>
      <button class="btn-grad-sm" data-nav="upload">+ Загрузить релиз</button>
    </div>`;

  const overviewEl = document.getElementById('overview-releases');
  const allEl = document.getElementById('all-releases');

  if (releases.length === 0) {
    overviewEl.innerHTML = emptyHtml;
    allEl.innerHTML = emptyHtml;
  } else {
    const recent = releases.slice(-3).reverse();
    overviewEl.innerHTML = recent.map(renderReleaseCard).join('');
    allEl.innerHTML = [...releases].reverse().map(renderReleaseCard).join('');
  }

  applyFilters();
}

// ═══════════════════════════════════════════════════════════
// ARTIST PROGRESS & ACTIVITY FEED
// ═══════════════════════════════════════════════════════════

function renderArtistProgress() {
  const releases = getReleases();
  const total = releases.length;
  const published = releases.filter(r => r.status === 'published').length;
  const milestones = [
    { icon: '🎵', label: 'Первый релиз', done: total >= 1 },
    { icon: '📀', label: '5 релизов', done: total >= 5 },
    { icon: '✅', label: 'Первая публикация', done: published >= 1 },
    { icon: '🔥', label: '10 релизов', done: total >= 10 },
    { icon: '👑', label: 'Про-артист', done: total >= 20 },
  ];
  const currentIdx = milestones.findIndex(m => !m.done);
  const el = document.getElementById('artist-progress');
  el.innerHTML = `
    <div class="progress-title">🏆 Путь артиста</div>
    <div class="progress-steps">
      ${milestones.map((m, i) => {
        const stepClass = m.done ? 'done' : (i === currentIdx ? 'current' : '');
        return `
        <div class="progress-step ${stepClass}">
          <div class="progress-step-icon">${m.done ? '✅' : m.icon}</div>
          <div class="progress-step-label">${m.label}</div>
        </div>
      `; }).join('')}
    </div>
  `;
}

function renderActivityFeed() {
  const releases = getReleases().slice(-5).reverse();
  const feed = document.getElementById('activity-feed');
  if (releases.length === 0) {
    feed.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted2);font-size:13px;">Пока нет активности</div>';
    return;
  }
  const statusColors = { pending: 'yellow', review: 'blue', published: 'green', rejected: 'red' };
  const statusTexts = { pending: 'отправлен на проверку', review: 'обрабатывается', published: 'опубликован', rejected: 'отклонён' };
  feed.innerHTML = releases.map(r => {
    const ago = timeAgo(new Date(r.createdAt));
    return `<div class="activity-item">
      <div class="activity-dot ${statusColors[r.status] || 'yellow'}"></div>
      <div class="activity-text"><strong>${r.title}</strong> — ${statusTexts[r.status] || 'создан'}</div>
      <div class="activity-time">${ago}</div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// TIPS
// ═══════════════════════════════════════════════════════════

const tips = [
  'Загружай обложку 3000×3000px — это требование большинства платформ.',
  'Рекомендуем загружать релиз за 2 недели до желаемой даты выхода.',
  'WAV формат даёт лучшее качество звука на всех платформах.',
  'Заполняй метаданные для каждого трека — это улучшает поиск на платформах.',
  'Используй drag & drop чтобы менять порядок треков в EP и альбоме.',
  'Указывай feat. артистов — это увеличивает охват на стриминговых сервисах.',
  'Проверяй релиз в разделе «Платформы» перед отправкой.',
  'Автосохранение сохраняет твой черновик — можешь вернуться позже.',
  'Пиши лирику для каждого трека — Spotify и Apple Music показывают тексты.',
  'Регулярные релизы (раз в месяц) повышают алгоритмический охват.',
];

function renderTip() {
  const dayIndex = Math.floor(Date.now() / 86400000) % tips.length;
  document.getElementById('tip-text').textContent = tips[dayIndex];
}

// ═══════════════════════════════════════════════════════════
// FORM STEPS
// ═══════════════════════════════════════════════════════════

function updateBars(step) {
  for (let i = 1; i <= 4; i++) {
    const bar = document.getElementById('bar-' + i);
    bar.className = 'step-bar';
    if (i < step) bar.classList.add('done');
    if (i === step) bar.classList.add('active');
  }
  const labels = ['Шаг 1 из 4 — Тип и исполнитель', 'Шаг 2 из 4 — Информация', 'Шаг 3 из 4 — Файлы', 'Шаг 4 из 4 — Обзор'];
  document.getElementById('form-step-label').textContent = labels[step - 1];
}

function validateStep1() {
  if (!AppState.selectedPrimaryArtist) {
    showToast('⚠️ Выбери или создай профиль основного исполнителя', 'error');
    return false;
  }
  return true;
}

function validateStep2() {
  const title = document.getElementById('track-title').value.trim();
  const genre = document.getElementById('track-genre').value;
  const date = document.getElementById('track-date').value;
  if (!title || !genre || !date) {
    showToast('⚠️ Заполни все обязательные поля', 'error');
    return false;
  }
  updateStep3UI();
  return true;
}

function validateStep3() {
  if (AppState.selectedType === 'single') {
    if (!AppState.audioFiles.length) { showToast('⚠️ Загрузи аудиофайл', 'error'); return false; }
  } else if (AppState.audioFiles.length < 2) {
    showToast('⚠️ Загрузи минимум 2 трека для ' + (AppState.selectedType === 'ep' ? 'EP' : 'Альбома'), 'error');
    return false;
  }
  if (!AppState.coverFile) { showToast('⚠️ Загрузи обложку', 'error'); return false; }
  updateSummary();
  return true;
}

function nextStep(from) {
  if (from === 1 && !validateStep1()) return;
  if (from === 2 && !validateStep2()) return;
  if (from === 3 && !validateStep3()) return;
  slideStep(from, from + 1);
}

function prevStep(from) {
  slideStep(from, from - 1);
}

function slideStep(fromNum, toNum) {
  const fromEl = document.getElementById('step-' + fromNum);
  const toEl = document.getElementById('step-' + toNum);
  fromEl.classList.add('slide-out');
  setTimeout(() => {
    fromEl.classList.remove('active', 'slide-out');
    AppState.currentStep = toNum;
    toEl.classList.add('active');
    updateBars(AppState.currentStep);
  }, 250);
}

// ═══════════════════════════════════════════════════════════
// RELEASE TYPE
// ═══════════════════════════════════════════════════════════

function selectType(el, type) {
  AppState.selectedType = type;
  document.querySelectorAll('.release-type-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  triggerAutosave();
}

function updateStep3UI() {
  const isMulti = AppState.selectedType !== 'single';
  const audioZone = document.getElementById('audio-zone');
  const trackListContainer = document.getElementById('track-list-container');
  const audioInput = document.getElementById('audio-input');

  if (isMulti) {
    audioZone.style.display = AppState.audioFiles.length > 0 ? 'none' : '';
    audioInput.setAttribute('multiple', '');
    trackListContainer.style.display = 'block';
    document.getElementById('audio-label').textContent = 'Аудиофайлы * (минимум 2)';
    document.getElementById('step3-desc').textContent = 'Загрузи треки и обложку релиза';
    renderTrackList();
  } else {
    audioInput.removeAttribute('multiple');
    trackListContainer.style.display = 'none';
    audioZone.style.display = '';
    document.getElementById('audio-label').textContent = 'Аудиофайл *';
    document.getElementById('step3-desc').textContent = 'Загрузи аудиофайл и обложку релиза';
  }
}

// ═══════════════════════════════════════════════════════════
// ARTIST PROFILE SYSTEM
// ═══════════════════════════════════════════════════════════

function getArtistProfiles() {
  return dpGetArtistProfiles();
}

function saveArtistProfiles(profiles) {
  dpSaveArtistProfiles(profiles);
  AppState.artistProfiles = profiles;
}

function searchArtists(query, type) {
  const dropdown = document.getElementById(type + '-artist-dropdown');
  const profiles = getArtistProfiles();
  const q = query.toLowerCase().trim();

  let matches = q ? profiles.filter(a => a.name.toLowerCase().includes(q)) : profiles;
  if (type === 'feat') {
    const excludeNames = AppState.featArtists.map(a => a.name.toLowerCase());
    if (AppState.selectedPrimaryArtist) excludeNames.push(AppState.selectedPrimaryArtist.name.toLowerCase());
    matches = matches.filter(a => !excludeNames.includes(a.name.toLowerCase()));
  }

  let html = '';
  matches.slice(0, 5).forEach(a => {
    const dataAttr = encodeURIComponent(JSON.stringify(a));
    html += `<div class="artist-option" data-artist-action="${type}" data-artist-json="${dataAttr}">
      <div class="ao-avatar">${a.name.charAt(0).toUpperCase()}</div>
      <div class="ao-info">
        <div class="ao-name">${a.name}</div>
        <div class="ao-meta">${a.spotifyId ? '🟢 Spotify' : ''}${a.appleId ? ' 🍎 Apple' : ''}${!a.spotifyId && !a.appleId ? 'Профиль без привязки' : ''}</div>
      </div>
    </div>`;
  });

  if (type === 'primary') {
    html += `<div class="artist-option create-new" data-artist-action="new-artist">
      <div class="ao-avatar">+</div>
      <div class="ao-info"><div class="ao-name">Создать нового артиста</div><div class="ao-meta">Новый профиль с привязкой к платформам</div></div>
    </div>`;
  } else if (q && !matches.some(a => a.name.toLowerCase() === q)) {
    html += `<div class="artist-option create-new" data-artist-action="quick-feat" data-quick-name="${query.trim()}">
      <div class="ao-avatar">+</div>
      <div class="ao-info"><div class="ao-name">Добавить «${query.trim()}»</div><div class="ao-meta">Как feat. артист</div></div>
    </div>`;
  }

  dropdown.innerHTML = html;
  dropdown.classList.add('open');
}

function selectPrimaryArtist(artist) {
  AppState.selectedPrimaryArtist = artist;
  const display = document.getElementById('primary-artist-display');
  display.innerHTML = `<div class="artist-selected">
    <div class="as-avatar">${artist.name.charAt(0).toUpperCase()}</div>
    <div class="as-info">
      <div class="as-name">${artist.name}</div>
      <div class="as-meta">${artist.spotifyId ? '🟢 Spotify: ' + artist.spotifyId : ''}${artist.appleId ? ' 🍎 Apple: ' + artist.appleId : ''}${!artist.spotifyId && !artist.appleId ? 'Профиль без привязки к платформам' : ''}</div>
    </div>
    <span class="as-remove" data-artist-action="remove-primary">✕</span>
  </div>`;
  display.style.display = 'block';
  document.getElementById('primary-artist-search-wrap').style.display = 'none';
  document.getElementById('primary-artist-dropdown').classList.remove('open');
}

function removePrimaryArtist() {
  AppState.selectedPrimaryArtist = null;
  document.getElementById('primary-artist-display').style.display = 'none';
  document.getElementById('primary-artist-search-wrap').style.display = 'block';
  document.getElementById('primary-artist-input').value = '';
}

function showNewArtistForm() {
  document.getElementById('new-artist-form').style.display = 'block';
  document.getElementById('primary-artist-dropdown').classList.remove('open');
  document.getElementById('new-artist-name').focus();
}

function cancelNewArtist() {
  document.getElementById('new-artist-form').style.display = 'none';
  document.getElementById('new-artist-name').value = '';
  document.getElementById('new-artist-spotify').value = '';
  document.getElementById('new-artist-apple').value = '';
}

function saveNewArtist() {
  const name = document.getElementById('new-artist-name').value.trim();
  if (!name) { showToast('⚠️ Введи имя артиста', 'error'); return; }
  const artist = {
    id: Date.now(),
    name: name,
    spotifyId: document.getElementById('new-artist-spotify').value.trim(),
    appleId: document.getElementById('new-artist-apple').value.trim(),
    createdAt: new Date().toISOString()
  };
  const profiles = getArtistProfiles();
  profiles.push(artist);
  saveArtistProfiles(profiles);
  selectPrimaryArtist(artist);
  cancelNewArtist();
  showToast('✅ Профиль «' + name + '» создан!', 'success');
}

function addFeatArtist(artist) {
  if (AppState.featArtists.some(a => a.name === artist.name)) return;
  AppState.featArtists.push(artist);
  renderFeatTags();
  document.getElementById('feat-artist-input').value = '';
  document.getElementById('feat-artist-dropdown').classList.remove('open');
}

function quickAddFeat(name) {
  const artist = { id: Date.now(), name: name.charAt(0).toUpperCase() + name.slice(1), spotifyId: '', appleId: '' };
  AppState.featArtists.push(artist);
  renderFeatTags();
  document.getElementById('feat-artist-input').value = '';
  document.getElementById('feat-artist-dropdown').classList.remove('open');
}

function addFeatFromInput() {
  const name = document.getElementById('feat-artist-input').value.trim();
  if (!name) return;
  quickAddFeat(name);
}

function removeFeat(index) {
  AppState.featArtists.splice(index, 1);
  renderFeatTags();
}

function renderFeatTags() {
  const container = document.getElementById('feat-tags');
  container.innerHTML = AppState.featArtists.map((a, i) =>
    `<div class="tag-pill">${a.name} <span class="tag-remove" data-feat-remove="${i}">✕</span></div>`
  ).join('');
}

// ═══════════════════════════════════════════════════════════
// SUBGENRE SYSTEM
// ═══════════════════════════════════════════════════════════

const subgenres = {
  'pop': ['Поп-рок', 'Инди-поп', 'Электропоп', 'Синтипоп', 'Данс-поп', 'К-поп', 'Дрим-поп', 'Арт-поп'],
  'hip-hop': ['Трэп', 'Бумбэп', 'Клауд-рэп', 'Дрилл', 'Лоу-фай хип-хоп', 'Фонк', 'Олдскул', 'Грайм'],
  'rnb': ['Современный R&B', 'Нео-соул', 'Фанк', 'Соул', 'PBR&B'],
  'electronic': ['Хаус', 'Техно', 'Драм-н-бэйс', 'Дабстеп', 'Транс', 'Эмбиент', 'IDM', 'Бэйс', 'Хардстайл', 'Прогрессив'],
  'rock': ['Альтернативный', 'Панк-рок', 'Пост-панк', 'Хардкор', 'Гранж', 'Прогрессивный', 'Психоделический', 'Гаражный рок'],
  'indie': ['Инди-рок', 'Инди-фолк', 'Шугейз', 'Лоу-фай', 'Мат-рок', 'Пост-рок'],
  'jazz': ['Фьюжн', 'Бибоп', 'Свинг', 'Смус-джаз', 'Фри-джаз', 'Эйсид-джаз'],
  'classical': ['Оркестровая', 'Камерная', 'Современная классика', 'Опера', 'Неоклассика'],
  'metal': ['Хэви-метал', 'Дэт-метал', 'Блэк-метал', 'Ню-метал', 'Метал-кор', 'Дум-метал', 'Трэш-метал'],
  'folk': ['Русский фолк', 'Этника', 'Нео-фолк', 'Кельтский', 'Балканский'],
  'reggae': ['Реггетон', 'Даб', 'Реггей', 'Дэнсхолл', 'Ска'],
  'country': ['Современный кантри', 'Кантри-рок', 'Блюграсс', 'Альт-кантри'],
  'latin': ['Латин-поп', 'Бачата', 'Сальса', 'Кумбия', 'Босса-нова'],
  'soundtrack': ['Кино', 'Игры', 'Аниме', 'Сериалы'],
  'other': ['Ворлд-мьюзик', 'Нью-эйдж', 'Блюз', 'Госпел', 'Ска-панк', 'Чилаут']
};

function updateSubgenres() {
  const genre = document.getElementById('track-genre').value;
  const sub = document.getElementById('track-subgenre');
  sub.innerHTML = '<option value="">— Без поджанра —</option>';
  if (subgenres[genre]) {
    subgenres[genre].forEach(s => {
      sub.innerHTML += `<option value="${s}">${s}</option>`;
    });
  }
}

// ═══════════════════════════════════════════════════════════
// FILE UPLOADS — TRACK LIST
// ═══════════════════════════════════════════════════════════

function renderTrackList() {
  const list = document.getElementById('track-list');
  document.getElementById('track-count-display').textContent = AppState.audioFiles.length;

  if (AppState.audioFiles.length === 0) {
    list.innerHTML = '';
    document.getElementById('audio-zone').style.display = '';
    return;
  }

  list.innerHTML = AppState.audioFiles.map((f, i) => {
    const sizeMB = (f.size / 1024 / 1024).toFixed(1);
    const meta = AppState.trackMeta[i] || {};
    const isFilled = meta.title && meta.title !== f.name.replace(/\.[^.]+$/, '');
    const statusCls = isFilled ? 'filled' : 'empty';
    const statusText = isFilled ? '✓ Заполнен' : 'Заполнить';
    const displayName = meta.title || f.name.replace(/\.[^.]+$/, '');
    return `<div class="track-item track-item-clickable" draggable="true" data-index="${i}">
      <div class="track-item-drag" title="Перетащи для сортировки">⠿</div>
      <div class="track-item-num">${i + 1}</div>
      <div class="track-item-name">🎵 ${displayName}</div>
      <span class="track-item-status ${statusCls}">${statusText}</span>
      <div class="track-item-size">${sizeMB} МБ</div>
      <button class="track-item-edit" data-track-edit="${i}" title="Редактировать">✎</button>
      <button class="track-item-remove" data-track-remove="${i}" title="Удалить">✕</button>
    </div>`;
  }).join('');
}

// ─── DRAG & DROP REORDER TRACKS ───
function trackDragStart(e, i) {
  AppState.dragFromIndex = i;
  e.target.closest('.track-item').classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function trackDragOver(e, i) {
  e.preventDefault();
  document.querySelectorAll('.track-item').forEach(t => t.classList.remove('drag-target'));
  if (i !== AppState.dragFromIndex) e.target.closest('.track-item')?.classList.add('drag-target');
}

function trackDrop(e, toIndex) {
  e.preventDefault();
  if (AppState.dragFromIndex === -1 || AppState.dragFromIndex === toIndex) return;
  const [af] = AppState.audioFiles.splice(AppState.dragFromIndex, 1);
  AppState.audioFiles.splice(toIndex, 0, af);
  const [tm] = AppState.trackMeta.splice(AppState.dragFromIndex, 1);
  AppState.trackMeta.splice(toIndex, 0, tm);
  AppState.dragFromIndex = -1;
  renderTrackList();
}

function trackDragEnd() {
  AppState.dragFromIndex = -1;
  document.querySelectorAll('.track-item').forEach(t => t.classList.remove('dragging', 'drag-target'));
}

function removeTrack(index) {
  AppState.audioFiles.splice(index, 1);
  AppState.trackMeta.splice(index, 1);
  renderTrackList();
  if (AppState.audioFiles.length === 0 && AppState.selectedType !== 'single') {
    document.getElementById('audio-zone').style.display = '';
  }
}

// ─── TRACK EDIT MODAL ───
function openTrackEdit(index) {
  AppState.editingTrackIndex = index;
  const meta = AppState.trackMeta[index] || {};
  const file = AppState.audioFiles[index];
  document.getElementById('track-modal-title').textContent = `Трек ${index + 1} · ${file.name}`;
  document.getElementById('te-title').value = meta.title || '';
  document.getElementById('te-version').value = meta.version || '';
  document.getElementById('te-artist').value = meta.artist || '';
  document.getElementById('te-feat').value = meta.feat || '';
  document.getElementById('te-producer').value = meta.producer || '';
  document.getElementById('te-writer').value = meta.writer || '';
  document.getElementById('te-composer').value = meta.composer || '';
  document.getElementById('te-arranger').value = meta.arranger || '';
  document.getElementById('te-isrc').value = meta.isrc || '';
  document.getElementById('te-explicit').value = meta.explicit || 'no';
  document.getElementById('te-lyrics').value = meta.lyrics || '';
  document.getElementById('track-edit-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function saveTrackMeta() {
  const i = AppState.editingTrackIndex;
  if (i < 0) return;
  AppState.trackMeta[i] = {
    title: document.getElementById('te-title').value.trim(),
    version: document.getElementById('te-version').value,
    artist: document.getElementById('te-artist').value.trim(),
    feat: document.getElementById('te-feat').value.trim(),
    producer: document.getElementById('te-producer').value.trim(),
    writer: document.getElementById('te-writer').value.trim(),
    composer: document.getElementById('te-composer').value.trim(),
    arranger: document.getElementById('te-arranger').value.trim(),
    isrc: document.getElementById('te-isrc').value.trim(),
    explicit: document.getElementById('te-explicit').value,
    lyrics: document.getElementById('te-lyrics').value.trim()
  };
  closeTrackModal();
  renderTrackList();
  showToast('✅ Трек ' + (i + 1) + ' сохранён');
}

function closeTrackModal() {
  document.getElementById('track-edit-modal').classList.remove('open');
  document.body.style.overflow = '';
  AppState.editingTrackIndex = -1;
}

// ─── DRAG & DROP ZONES (audio / cover) ───
function setupDragDrop(zoneId, handler) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;
  ['dragenter','dragover'].forEach(ev => {
    zone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); zone.classList.add('drag-over'); });
  });
  ['dragleave','drop'].forEach(ev => {
    zone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); zone.classList.remove('drag-over'); });
  });
  zone.addEventListener('drop', e => {
    const files = Array.from(e.dataTransfer.files);
    if (files.length) handler(files);
  });
}

function handleAudioFiles(files) {
  if (AppState.selectedType === 'single') {
    AppState.audioFiles = [files[0]];
    AppState.trackMeta = [{ title: files[0].name.replace(/\.[^.]+$/, ''), artist: '', feat: '', producer: '', writer: '', isrc: '', explicit: 'no', lyrics: '' }];
    document.getElementById('audio-name').textContent = '✓ ' + files[0].name;
  } else {
    files.forEach(f => {
      AppState.audioFiles.push(f);
      AppState.trackMeta.push({ title: f.name.replace(/\.[^.]+$/, ''), artist: '', feat: '', producer: '', writer: '', isrc: '', explicit: 'no', lyrics: '' });
    });
    document.getElementById('audio-zone').style.display = 'none';
    renderTrackList();
  }
}

function handleCoverFile(file, dataUrl) {
  const img = new Image();
  img.onload = function() {
    if (img.width < 3000 || img.height < 3000) {
      showToast(`⚠️ Обложка ${img.width}×${img.height}px — нужно минимум 3000×3000`, 'error');
      AppState.coverFile = null;
      document.getElementById('cover-name').textContent = '';
      document.getElementById('cover-preview').style.display = 'none';
      document.getElementById('cover-placeholder').style.display = '';
      return;
    }
    if (img.width !== img.height) {
      showToast(`⚠️ Обложка не квадратная (${img.width}×${img.height}). Рекомендуем 3000×3000`, 'error');
    }
    AppState.coverFile = file;
    document.getElementById('cover-name').textContent = `✓ ${file.name} (${img.width}×${img.height})`;
    document.getElementById('cover-preview').src = dataUrl;
    document.getElementById('cover-preview').style.display = 'block';
    document.getElementById('cover-placeholder').style.display = 'none';
  };
  img.src = dataUrl;
}

// ═══════════════════════════════════════════════════════════
// SUMMARY & SUBMIT
// ═══════════════════════════════════════════════════════════

function updateSummary() {
  const typeNames = { single: 'Сингл 🎵', ep: 'EP 💿', album: 'Альбом 📀' };
  const genreSelect = document.getElementById('track-genre');
  const genreName = genreSelect.options[genreSelect.selectedIndex]?.text || '—';
  const subgenre = document.getElementById('track-subgenre').value;
  const version = document.getElementById('track-version').value;
  const dateVal = document.getElementById('track-date').value;
  let dateDisplay = '—';
  if (dateVal) { const [y, m, d] = dateVal.split('-'); dateDisplay = `${d}.${m}.${y}`; }

  const titleText = document.getElementById('track-title').value || '—';
  const fullTitle = titleText + (version ? ` (${version})` : '');
  document.getElementById('summary-release-info').innerHTML = `
    <div class="summary-item"><span class="si-label">Тип: </span><span class="si-value">${typeNames[AppState.selectedType]}</span></div>
    <div class="summary-item"><span class="si-label">Название: </span><span class="si-value">${fullTitle}</span></div>
    <div class="summary-item"><span class="si-label">Жанр: </span><span class="si-value">${genreName}${subgenre ? ' / ' + subgenre : ''}</span></div>
    <div class="summary-item"><span class="si-label">Дата: </span><span class="si-value">${dateDisplay}</span></div>
    <div class="summary-item"><span class="si-label">Треков: </span><span class="si-value">${AppState.audioFiles.length}</span></div>
    <div class="summary-item"><span class="si-label">Explicit: </span><span class="si-value">${document.getElementById('track-explicit').value === 'yes' ? '🔞 Да' : 'Нет'}</span></div>
  `;

  const artistName = AppState.selectedPrimaryArtist ? AppState.selectedPrimaryArtist.name : '—';
  const featNames = AppState.featArtists.map(a => a.name).join(', ');
  document.getElementById('summary-artists-info').innerHTML = `
    <div style="font-weight:800;margin-bottom:2px;">${artistName}${featNames ? ' feat. ' + featNames : ''}</div>
    <div style="font-size:11px;color:var(--muted);">${AppState.selectedPrimaryArtist?.spotifyId ? '🟢 Spotify привязан' : ''}${AppState.selectedPrimaryArtist?.appleId ? ' 🍎 Apple привязан' : ''}</div>
  `;

  document.getElementById('summary-details-info').innerHTML = `
    <div class="summary-item"><span class="si-label">Язык: </span><span class="si-value">${document.getElementById('track-lang').value || '—'}</span></div>
    <div class="summary-item"><span class="si-label">Лейбл: </span><span class="si-value">${document.getElementById('track-label').value || 'Без лейбла'}</span></div>
  `;

  const trackWrap = document.getElementById('summary-tracklist-wrap');
  if (AppState.audioFiles.length > 1) {
    trackWrap.style.display = 'block';
    document.getElementById('summary-tracklist').innerHTML = AppState.trackMeta.map((m, i) => `
      <div class="summary-track">
        <span class="st-num">${i + 1}</span>
        <span class="st-title">${m.title || AppState.audioFiles[i]?.name || '—'}${m.version ? ' (' + m.version + ')' : ''}</span>
        ${m.explicit === 'yes' ? '<span class="st-badge" style="background:rgba(232,33,90,0.12);color:#E8215A;">E</span>' : ''}
        ${m.writer ? '<span style="color:var(--muted);font-size:11px;">✍ ' + m.writer + '</span>' : ''}
      </div>
    `).join('');
  } else {
    trackWrap.style.display = 'none';
  }

  const summCover = document.getElementById('summary-cover');
  const coverPreview = document.getElementById('cover-preview');
  if (coverPreview?.src && AppState.coverFile) {
    summCover.src = coverPreview.src;
    summCover.style.display = 'block';
  } else {
    summCover.style.display = 'none';
  }
}

function submitRelease() {
  const overlay = document.getElementById('progress-overlay');
  const fill = document.getElementById('progress-fill');
  const percent = document.getElementById('progress-percent');
  overlay.classList.add('show');

  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 15 + 5;
    if (progress >= 95) progress = 95;
    fill.style.width = Math.round(progress) + '%';
    percent.textContent = Math.round(progress) + '%';
  }, 200);

  setTimeout(() => {
    clearInterval(interval);
    fill.style.width = '100%';
    percent.textContent = '100%';

    setTimeout(() => {
      overlay.classList.remove('show');
      fill.style.width = '0%';
      percent.textContent = '0%';
      doSubmit();
    }, 400);
  }, 1800);
}

function doSubmit() {
  const genreSelect = document.getElementById('track-genre');
  const genreName = genreSelect.options[genreSelect.selectedIndex]?.text || '';
  const release = {
    id: Date.now(),
    userEmail: AppState.currentUser.email,
    type: AppState.selectedType,
    title: document.getElementById('track-title').value.trim(),
    version: document.getElementById('track-version').value,
    artist: AppState.selectedPrimaryArtist ? AppState.selectedPrimaryArtist.name : '',
    artistProfile: AppState.selectedPrimaryArtist,
    feat: AppState.featArtists.map(a => a.name).join(', '),
    featProfiles: AppState.featArtists,
    genre: genreName,
    subgenre: document.getElementById('track-subgenre').value,
    releaseDate: document.getElementById('track-date').value,
    label: document.getElementById('track-label').value.trim(),
    lang: document.getElementById('track-lang').value,
    metaLang: document.getElementById('track-meta-lang').value,
    explicit: document.getElementById('track-explicit').value,
    copyright: document.getElementById('track-copyright').value.trim(),
    previouslyReleased: document.getElementById('track-previously-released').value,
    origDate: document.getElementById('track-orig-date')?.value || '',
    trackCount: AppState.audioFiles.length,
    tracks: AppState.audioFiles.map((f, i) => ({
      fileName: f.name,
      title: AppState.trackMeta[i]?.title || f.name.replace(/\.[^.]+$/, ''),
      version: AppState.trackMeta[i]?.version || '',
      artist: AppState.trackMeta[i]?.artist || '',
      feat: AppState.trackMeta[i]?.feat || '',
      producer: AppState.trackMeta[i]?.producer || '',
      writer: AppState.trackMeta[i]?.writer || '',
      composer: AppState.trackMeta[i]?.composer || '',
      arranger: AppState.trackMeta[i]?.arranger || '',
      isrc: AppState.trackMeta[i]?.isrc || '',
      explicit: AppState.trackMeta[i]?.explicit || 'no',
      lyrics: AppState.trackMeta[i]?.lyrics || ''
    })),
    upc: document.getElementById('track-upc').value.trim(),
    isrc: document.getElementById('track-isrc').value.trim(),
    comment: document.getElementById('track-comment').value.trim(),
    audioFile: AppState.audioFiles.length ? AppState.audioFiles[0].name : '',
    coverFile: AppState.coverFile ? AppState.coverFile.name : '',
    coverData: document.getElementById('cover-preview').src || '',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  dpAddRelease(release);

  document.getElementById('upload-form-card').style.display = 'none';
  document.getElementById('upload-success').style.display = 'block';
  renderReleases();

  addNotification('🎵', 'Релиз отправлен на проверку', `Трек "${release.title}" получен и будет проверен в течение 1–2 рабочих дней.`);

  clearDraft();
}

function newRelease() {
  AppState.audioFiles = [];
  AppState.trackMeta = [];
  AppState.coverFile = null;
  AppState.currentStep = 1;
  AppState.selectedType = 'single';
  AppState.dpSelectedDate = null;
  document.querySelectorAll('.release-type-card').forEach(c => c.classList.remove('active'));
  document.querySelector('.release-type-card[data-type="single"]').classList.add('active');
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active', 'slide-out'));
  document.getElementById('step-1').classList.add('active');
  updateBars(1);
  document.getElementById('audio-name').textContent = '';
  document.getElementById('cover-name').textContent = '';
  document.getElementById('cover-preview').style.display = 'none';
  document.getElementById('cover-placeholder').style.display = '';
  document.getElementById('audio-zone').style.display = '';
  document.getElementById('track-list-container').style.display = 'none';
  document.getElementById('track-list').innerHTML = '';
  document.getElementById('upload-form-card').style.display = 'block';
  document.getElementById('upload-success').style.display = 'none';
  document.getElementById('summary-cover').style.display = 'none';
  const trigger = document.getElementById('dp-trigger');
  trigger.textContent = 'Выбери дату';
  trigger.classList.add('placeholder');
  document.getElementById('track-date').value = '';
  ['track-title','track-label','track-upc','track-isrc','track-comment','track-copyright'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  AppState.selectedPrimaryArtist = null;
  AppState.featArtists = [];
  document.getElementById('primary-artist-display').style.display = 'none';
  document.getElementById('primary-artist-search-wrap').style.display = 'block';
  document.getElementById('primary-artist-input').value = '';
  document.getElementById('feat-tags').innerHTML = '';
  document.getElementById('feat-artist-input').value = '';
  document.getElementById('new-artist-form').style.display = 'none';
  const versionEl = document.getElementById('track-version');
  if (versionEl) versionEl.value = '';
  const subgenreEl = document.getElementById('track-subgenre');
  if (subgenreEl) subgenreEl.innerHTML = '<option value="">— Без поджанра —</option>';
  const prevRelEl = document.getElementById('track-previously-released');
  if (prevRelEl) prevRelEl.value = 'no';
  const origDateRow = document.getElementById('orig-date-row');
  if (origDateRow) origDateRow.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════
// RELEASE DETAIL MODAL
// ═══════════════════════════════════════════════════════════

function infoRow(icon, label, value) {
  return `<div style="background:var(--bg3);border:1px solid var(--line);border-radius:10px;padding:12px 14px;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--muted);margin-bottom:4px;">${icon} ${label}</div><div style="font-size:14px;font-weight:700;">${value}</div></div>`;
}

function buildRichTracksHtml(tracks) {
  return `<div style="background:var(--bg3);border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin-bottom:12px;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--muted);margin-bottom:12px;">🎵 Треклист (${tracks.length})</div>
    ${tracks.map((t, i) => `
      <div style="padding:10px 0;${i > 0 ? 'border-top:1px solid var(--line);' : ''}">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
          <span style="font-size:12px;font-weight:800;color:var(--muted2);width:20px;">${i+1}.</span>
          <span style="font-size:14px;font-weight:800;">${t.title || t.fileName}</span>
          ${t.explicit === 'yes' ? '<span style="font-size:10px;font-weight:800;background:rgba(232,33,90,0.15);color:#E8215A;padding:1px 6px;border-radius:4px;">E</span>' : ''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-left:30px;font-size:12px;color:var(--muted);">
          ${t.artist ? '<span>🎤 ' + t.artist + '</span>' : ''}
          ${t.feat ? '<span>ft. ' + t.feat + '</span>' : ''}
          ${t.producer ? '<span>🎛️ ' + t.producer + '</span>' : ''}
          ${t.writer ? '<span>✍️ ' + t.writer + '</span>' : ''}
          ${t.isrc ? '<span>ISRC: ' + t.isrc + '</span>' : ''}
        </div>
      </div>
    `).join('')}
  </div>`;
}

function buildSimpleTracksHtml(tracks) {
  return `<div style="background:var(--bg3);border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin-bottom:12px;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--muted);margin-bottom:10px;">🎵 Треклист (${tracks.length})</div>
    ${tracks.map((t, i) => `<div style="font-size:13px;padding:4px 0;color:var(--muted);"><span style="color:var(--muted2);margin-right:8px;">${i+1}.</span> ${t}</div>`).join('')}
  </div>`;
}

function openRelease(id) {
  const r = findReleaseById(id);
  if (!r) return;

  const statusMap = {
    pending:   { cls: 'status-pending',   label: 'На проверке',    desc: 'Твои материалы получены и ожидают проверки нашей командой.' },
    review:    { cls: 'status-review',    label: 'Обрабатывается', desc: 'Релиз проверен и передан дистрибьютору. Скоро появится на платформах.' },
    published: { cls: 'status-published', label: 'Опубликован',    desc: 'Твой трек доступен на всех платформах!' },
    rejected:  { cls: 'status-rejected',  label: 'Отклонён',       desc: 'К сожалению, релиз не прошёл проверку. Свяжись с нами для уточнения.' },
  };
  const typeIcons = { single: '🎵', ep: '💿', album: '📀' };
  const typeNames = { single: 'Сингл', ep: 'EP', album: 'Альбом' };
  const s = statusMap[r.status] || statusMap.pending;
  const releaseIcon = typeIcons[r.type] || '🎵';
  const releaseTypeName = typeNames[r.type] || 'Сингл';
  const createdDate = new Date(r.createdAt).toLocaleDateString('ru-RU');

  let tracksHtml = '';
  if (r.tracks?.length > 0) {
    const isRichTracks = typeof r.tracks[0] === 'object';
    if (isRichTracks) {
      tracksHtml = buildRichTracksHtml(r.tracks);
    } else if (r.tracks.length > 1) {
      tracksHtml = buildSimpleTracksHtml(r.tracks);
    }
  }

  document.getElementById('modal-content').innerHTML = `
    <div style="display:flex;align-items:center;gap:20px;margin-bottom:28px;">
      <div style="width:80px;height:80px;border-radius:14px;background:var(--bg3);border:1px solid var(--line2);display:flex;align-items:center;justify-content:center;font-size:36px;flex-shrink:0;overflow:hidden;">${r.coverData?.startsWith('data:') ? '<img src="'+r.coverData+'" style="width:100%;height:100%;object-fit:cover;">' : releaseIcon}</div>
      <div>
        <div style="font-size:22px;font-weight:900;letter-spacing:-0.5px;margin-bottom:6px;">${r.title}</div>
        <div style="font-size:14px;color:var(--muted);">${r.artist}${r.feat ? ' feat. ' + r.feat : ''} · ${releaseTypeName}</div>
      </div>
    </div>
    <div style="background:var(--bg3);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:24px;display:flex;align-items:flex-start;gap:14px;">
      <span class="status ${s.cls}" style="flex-shrink:0;">${s.label}</span>
      <span style="font-size:13px;color:var(--muted);line-height:1.6;">${s.desc}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">
      ${infoRow(releaseIcon,'Тип',releaseTypeName + ' · ' + (r.trackCount || 1) + ' трек(ов)')}
      ${infoRow('🎸','Жанр',r.genre)}
      ${infoRow('📅','Дата релиза',r.releaseDate||'—')}
      ${infoRow('🌐','Язык',r.lang||'—')}
      ${infoRow('🔞','Explicit',r.explicit==='yes'?'Да':'Нет')}
      ${infoRow('🏷️','Лейбл',r.label||'Без лейбла')}
      ${infoRow('📤','Загружено',createdDate)}
      ${r.upc?infoRow('🔢','UPC',r.upc):''}
      ${r.isrc?infoRow('🎫','ISRC',r.isrc):''}
    </div>
    ${tracksHtml}
    ${r.audioFile && (!r.tracks || r.tracks.length <= 1)?`<div style="background:var(--bg3);border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin-bottom:12px;display:flex;align-items:center;gap:12px;"><span style="font-size:20px;">🎵</span><div><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--muted);margin-bottom:2px;">Аудиофайл</div><div style="font-size:14px;font-weight:600;">${r.audioFile}</div></div></div>`:''}
    ${r.coverFile?`<div style="background:var(--bg3);border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin-bottom:12px;display:flex;align-items:center;gap:12px;"><span style="font-size:20px;">🖼️</span><div><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--muted);margin-bottom:2px;">Обложка</div><div style="font-size:14px;font-weight:600;">${r.coverFile}</div></div></div>`:''}
    ${r.comment?`<div style="background:rgba(155,39,175,0.08);border:1px solid rgba(155,39,175,0.2);border-radius:12px;padding:14px 18px;margin-top:4px;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--muted);margin-bottom:6px;">💬 Комментарий</div><div style="font-size:14px;color:var(--muted);line-height:1.6;">${r.comment}</div></div>`:''}
  `;

  document.getElementById('release-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('release-modal').classList.remove('open');
  document.body.style.overflow = '';
}

// ═══════════════════════════════════════════════════════════
// DELETE RELEASE
// ═══════════════════════════════════════════════════════════

function handleDeleteRelease(id) {
  if (!confirm('Удалить этот релиз? Это действие нельзя отменить.')) return;
  const card = document.getElementById('card-' + id);
  if (card) {
    card.classList.add('removing');
    setTimeout(() => {
      dpDeleteRelease(id);
      renderReleases();
      if (_renderAnalytics) _renderAnalytics();
      showToast('🗑️ Релиз удалён', 'error');
    }, 400);
  }
}

// ═══════════════════════════════════════════════════════════
// SEARCH & FILTER
// ═══════════════════════════════════════════════════════════

function applyFilters() {
  const releases = getReleases();
  let filtered = [...releases].reverse();

  if (AppState.currentFilter !== 'all') {
    filtered = filtered.filter(r => r.status === AppState.currentFilter);
  }

  if (AppState.currentSearch.trim()) {
    const q = AppState.currentSearch.toLowerCase();
    filtered = filtered.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.artist.toLowerCase().includes(q) ||
      (r.feat?.toLowerCase().includes(q))
    );
  }

  const allEl = document.getElementById('all-releases');

  if (filtered.length === 0) {
    allEl.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>Ничего не найдено. Попробуй другой запрос или фильтр.</p></div>`;
    return;
  }

  allEl.innerHTML = filtered.map(renderReleaseCard).join('');
}

function setFilter(btn, filter) {
  AppState.currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyFilters();
}

function onSearch(val) {
  AppState.currentSearch = val;
  applyFilters();
}

// ═══════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

function getNotifications() {
  return dpGetNotifications(AppState.currentUser.email);
}

function saveNotificationsLocal(notifs) {
  dpSaveNotifications(AppState.currentUser.email, notifs);
}

function addNotification(icon, title, desc) {
  const notifs = getNotifications();
  notifs.unshift({
    id: Date.now(),
    icon,
    title,
    desc,
    time: new Date().toISOString(),
    read: false
  });
  saveNotificationsLocal(notifs);
  renderNotifications();
}

function renderNotifications() {
  const notifs = getNotifications();
  const list = document.getElementById('notif-list');
  const badge = document.getElementById('notif-badge');
  const emptyNotif = document.getElementById('notif-empty');

  const unread = notifs.filter(n => !n.read).length;
  badge.textContent = unread || '';
  badge.style.display = unread ? 'flex' : 'none';

  if (notifs.length === 0) {
    list.innerHTML = '';
    if (emptyNotif) emptyNotif.style.display = 'block';
    return;
  }
  if (emptyNotif) emptyNotif.style.display = 'none';

  list.innerHTML = notifs.slice(0, 20).map(n => {
    const ago = timeAgo(new Date(n.time));
    return `<div class="notif-item${n.read ? '' : ' unread'}" data-notif-id="${n.id}">
      <div class="notif-icon">${n.icon}</div>
      <div class="notif-body">
        <div class="notif-title">${n.title}</div>
        <div class="notif-desc">${n.desc}</div>
        <div class="notif-time">${ago}</div>
      </div>
    </div>`;
  }).join('');
}

function markRead(id) {
  const notifs = getNotifications();
  const n = notifs.find(n => n.id === id);
  if (n) { n.read = true; saveNotificationsLocal(notifs); renderNotifications(); }
}

function markAllRead() {
  const notifs = getNotifications();
  notifs.forEach(n => n.read = true);
  saveNotificationsLocal(notifs);
  renderNotifications();
}

function clearNotifications() {
  saveNotificationsLocal([]);
  renderNotifications();
}

// ═══════════════════════════════════════════════════════════
// CUSTOM DATEPICKER
// ═══════════════════════════════════════════════════════════

const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

function initDatepicker() {
  const now = new Date();
  AppState.dpYear = now.getFullYear();
  AppState.dpMonth = now.getMonth();
  renderDP();
}

function toggleDatepicker() {
  document.getElementById('dp-dropdown').classList.toggle('open');
}

function dpPrev() {
  AppState.dpMonth--;
  if (AppState.dpMonth < 0) { AppState.dpMonth = 11; AppState.dpYear--; }
  renderDP();
}

function dpNext() {
  AppState.dpMonth++;
  if (AppState.dpMonth > 11) { AppState.dpMonth = 0; AppState.dpYear++; }
  renderDP();
}

function renderDP() {
  document.getElementById('dp-month-year').textContent = monthNames[AppState.dpMonth] + ' ' + AppState.dpYear;
  const firstDay = new Date(AppState.dpYear, AppState.dpMonth, 1);
  const lastDay = new Date(AppState.dpYear, AppState.dpMonth + 1, 0);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const today = new Date(); today.setHours(0,0,0,0);

  let html = '';

  const prevLast = new Date(AppState.dpYear, AppState.dpMonth, 0).getDate();
  for (let i = startWeekday - 1; i >= 0; i--) {
    html += `<div class="dp-day other">${prevLast - i}</div>`;
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(AppState.dpYear, AppState.dpMonth, d);
    const isPast = date < today;
    const isToday = date.getTime() === today.getTime();
    const isSelected = AppState.dpSelectedDate && date.getTime() === AppState.dpSelectedDate?.getTime();
    let cls = 'dp-day';
    if (isPast) cls += ' past';
    if (isToday) cls += ' today';
    if (isSelected) cls += ' selected';
    if (isPast) {
      html += `<div class="${cls}">${d}</div>`;
    } else {
      html += `<div class="${cls}" data-dp-date="${AppState.dpYear}-${AppState.dpMonth}-${d}">${d}</div>`;
    }
  }

  const totalCells = startWeekday + lastDay.getDate();
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="dp-day other">${i}</div>`;
  }

  document.getElementById('dp-days').innerHTML = html;
}

function selectDate(y, m, d) {
  AppState.dpSelectedDate = new Date(y, m, d);
  const pad = n => String(n).padStart(2, '0');
  const isoDate = `${y}-${pad(m+1)}-${pad(d)}`;
  document.getElementById('track-date').value = isoDate;
  const trigger = document.getElementById('dp-trigger');
  trigger.textContent = `${pad(d)}.${pad(m+1)}.${y}`;
  trigger.classList.remove('placeholder');
  document.getElementById('dp-dropdown').classList.remove('open');
}

// ═══════════════════════════════════════════════════════════
// PLATFORMS & PREVIEW
// ═══════════════════════════════════════════════════════════

const platformsData = [
  { name: 'Spotify', icon: '🟢', bg: 'rgba(30,215,96,0.1)', status: 'active', desc: 'Крупнейший стриминг в мире' },
  { name: 'Apple Music', icon: '🍎', bg: 'rgba(252,60,68,0.1)', status: 'active', desc: 'Премиум качество звука' },
  { name: 'YouTube Music', icon: '🔴', bg: 'rgba(255,0,0,0.1)', status: 'active', desc: 'Миллиарды слушателей' },
  { name: 'Яндекс Музыка', icon: '🟡', bg: 'rgba(255,204,0,0.1)', status: 'active', desc: 'Главная платформа в СНГ' },
  { name: 'VK Музыка', icon: '🔵', bg: 'rgba(0,119,255,0.1)', status: 'active', desc: 'Интеграция с VK' },
  { name: 'Deezer', icon: '💜', bg: 'rgba(162,0,237,0.1)', status: 'active', desc: 'Популярна в Европе' },
  { name: 'Tidal', icon: '⬛', bg: 'rgba(255,255,255,0.05)', status: 'active', desc: 'Hi-Fi качество' },
  { name: 'Amazon Music', icon: '🟠', bg: 'rgba(255,153,0,0.1)', status: 'active', desc: 'Экосистема Amazon' },
  { name: 'SoundCloud', icon: '🧡', bg: 'rgba(255,85,0,0.1)', status: 'active', desc: 'Для инди-артистов' },
  { name: 'Shazam', icon: '🔷', bg: 'rgba(0,122,255,0.1)', status: 'active', desc: 'Распознавание музыки' },
  { name: 'TikTok / CapCut', icon: '🎵', bg: 'rgba(255,0,80,0.1)', status: 'active', desc: 'Вирусный потенциал' },
  { name: 'Instagram / Reels', icon: '📸', bg: 'rgba(225,48,108,0.1)', status: 'active', desc: 'Stories и Reels' },
  { name: 'Boom', icon: '💥', bg: 'rgba(255,59,48,0.1)', status: 'pending', desc: 'Платформа VK Group' },
  { name: 'Zvuk (Сбер)', icon: '💚', bg: 'rgba(33,191,115,0.1)', status: 'pending', desc: 'Экосистема Сбера' },
  { name: 'Напстер', icon: '🎧', bg: 'rgba(0,200,255,0.1)', status: 'soon', desc: 'Скоро' },
];

const platformColors = {
  spotify: { bar: '#1DB954', bg: '#121212' },
  apple: { bar: '#FC3C4C', bg: '#1C1C1E' },
  yandex: { bar: '#FFCC00', bg: '#1A1A1A' },
  vk: { bar: '#0077FF', bg: '#19191A' },
  youtube: { bar: '#FF0000', bg: '#0F0F0F' },
};

function renderPlatforms() {
  const grid = document.getElementById('platforms-list');
  const statusLabels = { active: '✓ Подключено', pending: '⏳ На модерации', soon: '🔜 Скоро' };
  grid.innerHTML = platformsData.map(p => `
    <div class="platform-card">
      <div class="platform-icon" style="background:${p.bg};font-size:24px;">${p.icon}</div>
      <div>
        <div class="platform-name">${p.name}</div>
        <div class="platform-desc">${p.desc}</div>
      </div>
      <span class="platform-status ${p.status}">${statusLabels[p.status]}</span>
    </div>
  `).join('');

  const sel = document.getElementById('preview-select');
  const releases = getReleases();
  sel.innerHTML = '<option value="">— Выбери релиз —</option>' + releases.map(r => `<option value="${r.id}">${r.title} — ${r.artist}</option>`).join('');
}

function updatePreview() {
  const id = Number.parseInt(document.getElementById('preview-select').value);
  const r = findReleaseById(id);
  const coverEl = document.getElementById('preview-cover');
  if (!r) {
    document.getElementById('preview-title').textContent = 'Твой трек';
    document.getElementById('preview-artist').textContent = 'Артист';
    coverEl.innerHTML = '🎵';
    return;
  }
  document.getElementById('preview-title').textContent = r.title;
  document.getElementById('preview-artist').textContent = r.artist + (r.feat ? ' feat. ' + r.feat : '');
  if (r.coverData?.startsWith('data:')) {
    coverEl.innerHTML = `<img src="${r.coverData}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;
  } else {
    const typeIcons = { single: '🎵', ep: '💿', album: '📀' };
    coverEl.innerHTML = typeIcons[r.type] || '🎵';
  }
  updatePreviewPlatform();
}

function updatePreviewPlatform() {
  const plat = document.getElementById('preview-platform').value;
  const colors = platformColors[plat] || platformColors.spotify;
  document.getElementById('preview-progress').style.background = colors.bar;
  document.getElementById('preview-phone').style.background = colors.bg;
}

// ═══════════════════════════════════════════════════════════
// AUTOSAVE DRAFT
// ═══════════════════════════════════════════════════════════

function getDraftKey() {
  return AppState.currentUser ? AppState.currentUser.email : '';
}

function getDraftData() {
  return {
    type: AppState.selectedType,
    title: document.getElementById('track-title')?.value || '',
    primaryArtist: AppState.selectedPrimaryArtist,
    featArtists: AppState.featArtists,
    genre: document.getElementById('track-genre')?.value || '',
    subgenre: document.getElementById('track-subgenre')?.value || '',
    version: document.getElementById('track-version')?.value || '',
    date: document.getElementById('track-date')?.value || '',
    label: document.getElementById('track-label')?.value || '',
    lang: document.getElementById('track-lang')?.value || '',
    explicit: document.getElementById('track-explicit')?.value || '',
    copyright: document.getElementById('track-copyright')?.value || '',
    upc: document.getElementById('track-upc')?.value || '',
    isrc: document.getElementById('track-isrc')?.value || '',
    comment: document.getElementById('track-comment')?.value || '',
    step: AppState.currentStep,
    savedAt: Date.now()
  };
}

function saveDraftNow() {
  const badge = document.getElementById('autosave-badge');
  badge.textContent = '💾 Сохранение...';
  badge.classList.add('saving');
  badge.style.opacity = '1';
  dpSaveDraft(getDraftKey(), getDraftData());
  setTimeout(() => {
    badge.textContent = '💾 Сохранено';
    badge.classList.remove('saving');
    setTimeout(() => { badge.style.opacity = '0'; }, 2000);
  }, 400);
}

function triggerAutosave() {
  clearTimeout(AppState.autosaveTimer);
  AppState.autosaveTimer = setTimeout(saveDraftNow, 1000);
}

function restoreDraftType(d) {
  if (!d.type) return;
  AppState.selectedType = d.type;
  document.querySelectorAll('.release-type-card').forEach(c => c.classList.remove('active'));
  const tc = document.querySelector(`.release-type-card[data-type="${d.type}"]`);
  if (tc) tc.classList.add('active');
}

function restoreDraftDate(d) {
  if (!d.date) return;
  document.getElementById('track-date').value = d.date;
  const [y,m,day] = d.date.split('-');
  const trigger = document.getElementById('dp-trigger');
  trigger.textContent = `${day}.${m}.${y}`;
  trigger.classList.remove('placeholder');
}

function restoreDraftFields(d) {
  if (d.title) document.getElementById('track-title').value = d.title;
  if (d.primaryArtist) selectPrimaryArtist(d.primaryArtist);
  if (d.featArtists?.length) { AppState.featArtists = d.featArtists; renderFeatTags(); }
  if (d.genre) document.getElementById('track-genre').value = d.genre;
  restoreDraftDate(d);
  if (d.label) document.getElementById('track-label').value = d.label;
  if (d.lang) document.getElementById('track-lang').value = d.lang;
  if (d.explicit) document.getElementById('track-explicit').value = d.explicit;
  if (d.upc) document.getElementById('track-upc').value = d.upc;
  if (d.isrc) document.getElementById('track-isrc').value = d.isrc;
  if (d.preview) document.getElementById('track-preview').value = d.preview;
  if (d.comment) document.getElementById('track-comment').value = d.comment;
}

function loadDraft() {
  try {
    const d = dpGetDraft(getDraftKey());
    if (!d) return;
    if (Date.now() - d.savedAt > 86400000) { dpRemoveDraft(getDraftKey()); return; }
    if (d.title || d.feat || d.genre || d.label || d.comment) {
      restoreDraftType(d);
      restoreDraftFields(d);
      showToast('📝 Черновик восстановлен', 'success');
    }
  } catch (e) { console.warn('Draft parse error:', e); }
}

function clearDraft() {
  dpRemoveDraft(getDraftKey());
}

// ═══════════════════════════════════════════════════════════
// EVENT BINDING (заменяет все inline-обработчики)
// ═══════════════════════════════════════════════════════════

function handleDelegatedAction(action) {
  switch (action.dataset.action) {
    case 'submit-release':      submitRelease(); return true;
    case 'new-release':         newRelease(); return true;
    case 'close-release-modal': closeModal(); return true;
    case 'close-track-modal':   closeTrackModal(); return true;
    case 'save-track-meta':     saveTrackMeta(); return true;
    case 'save-new-artist':     saveNewArtist(); return true;
    case 'cancel-new-artist':   cancelNewArtist(); return true;
    case 'toggle-datepicker':   toggleDatepicker(); return true;
    case 'dp-prev':             dpPrev(); return true;
    case 'dp-next':             dpNext(); return true;
    case 'mark-all-read':       markAllRead(); return true;
    case 'add-tracks-multi':    document.getElementById('audio-input-multi').click(); return true;
    default: return false;
  }
}

function handleArtistAction(artistAction) {
  const act = artistAction.dataset.artistAction;
  if (act === 'primary' || act === 'feat') {
    const artist = JSON.parse(decodeURIComponent(artistAction.dataset.artistJson));
    if (act === 'primary') selectPrimaryArtist(artist);
    else addFeatArtist(artist);
    return true;
  }
  if (act === 'new-artist') { showNewArtistForm(); return true; }
  if (act === 'quick-feat') { quickAddFeat(artistAction.dataset.quickName); return true; }
  if (act === 'remove-primary') { removePrimaryArtist(); return true; }
  return false;
}

function handleReleaseCardClick(e) {
  const openEl = e.target.closest('[data-action="open"]');
  if (openEl) {
    const card = openEl.closest('.release-card');
    if (card) { openRelease(Number.parseInt(card.dataset.releaseId)); return true; }
  }
  const delEl = e.target.closest('[data-action="delete"]');
  if (delEl) {
    const card = delEl.closest('.release-card');
    if (card) { handleDeleteRelease(Number.parseInt(card.dataset.releaseId)); return true; }
  }
  return false;
}

function bindFileInputs() {
  const audioInput = document.getElementById('audio-input');
  if (audioInput) {
    audioInput.addEventListener('change', function() {
      const files = Array.from(this.files);
      if (!files.length) return;
      handleAudioFiles(files);
      this.value = '';
    });
  }

  const audioMulti = document.getElementById('audio-input-multi');
  if (audioMulti) {
    audioMulti.addEventListener('change', function() {
      const files = Array.from(this.files);
      files.forEach(f => {
        AppState.audioFiles.push(f);
        AppState.trackMeta.push({ title: f.name.replace(/\.[^.]+$/, ''), artist: '', feat: '', producer: '', writer: '', isrc: '', explicit: 'no', lyrics: '' });
      });
      renderTrackList();
      this.value = '';
    });
  }

  const coverInput = document.getElementById('cover-input');
  if (coverInput) {
    coverInput.addEventListener('change', function() {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => handleCoverFile(file, ev.target.result);
      reader.readAsDataURL(file);
      this.value = '';
    });
  }
}

function bindTrackDrag() {
  const trackListEl = document.getElementById('track-list');
  if (!trackListEl) return;
  trackListEl.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.track-item');
    if (item) trackDragStart(e, Number.parseInt(item.dataset.index));
  });
  trackListEl.addEventListener('dragover', (e) => {
    const item = e.target.closest('.track-item');
    if (item) trackDragOver(e, Number.parseInt(item.dataset.index));
  });
  trackListEl.addEventListener('drop', (e) => {
    const item = e.target.closest('.track-item');
    if (item) trackDrop(e, Number.parseInt(item.dataset.index));
  });
  trackListEl.addEventListener('dragend', trackDragEnd);
}

function bindFormSelects() {
  const genreSelect = document.getElementById('track-genre');
  if (genreSelect) genreSelect.addEventListener('change', updateSubgenres);

  const prevRel = document.getElementById('track-previously-released');
  if (prevRel) {
    prevRel.addEventListener('change', function() {
      const row = document.getElementById('orig-date-row');
      if (row) row.style.display = this.value === 'yes' ? 'grid' : 'none';
    });
  }

  const previewSel = document.getElementById('preview-select');
  if (previewSel) previewSel.addEventListener('change', updatePreview);

  const previewPlat = document.getElementById('preview-platform');
  if (previewPlat) previewPlat.addEventListener('change', updatePreviewPlatform);
}

function bindEvents() {
  // ═══════════════════════════════════════════════════════════
  // DELEGATED CLICK HANDLER
  // ═══════════════════════════════════════════════════════════
  document.addEventListener('click', (e) => {

    // ─── data-action (release-specific actions) ───
    const action = e.target.closest('[data-action]');
    if (action && handleDelegatedAction(action)) return;

    // ─── data-next-step / data-prev-step ───
    const nextEl = e.target.closest('[data-next-step]');
    if (nextEl) { nextStep(Number.parseInt(nextEl.dataset.nextStep)); return; }

    const prevEl = e.target.closest('[data-prev-step]');
    if (prevEl) { prevStep(Number.parseInt(prevEl.dataset.prevStep)); return; }

    // ─── data-filter ───
    const filterEl = e.target.closest('[data-filter]');
    if (filterEl) { setFilter(filterEl, filterEl.dataset.filter); return; }

    // ─── data-type (release type cards) ───
    const typeCard = e.target.closest('.release-type-card[data-type]');
    if (typeCard) { selectType(typeCard, typeCard.dataset.type); return; }

    // ─── data-modal-close (overlay click) ───
    const modalOverlay = e.target.closest('[data-modal-close]');
    if (modalOverlay && e.target === modalOverlay) {
      const id = modalOverlay.dataset.modalClose;
      if (id === 'track-edit-modal') closeTrackModal();
      else if (id === 'release-modal') closeModal();
      return;
    }

    // ─── Release cards: open / delete ───
    if (handleReleaseCardClick(e)) return;

    // ─── Artist dropdown actions ───
    const artistAction = e.target.closest('[data-artist-action]');
    if (artistAction && handleArtistAction(artistAction)) return;

    // ─── Feat tag remove ───
    const featRemove = e.target.closest('[data-feat-remove]');
    if (featRemove) { removeFeat(Number.parseInt(featRemove.dataset.featRemove)); return; }

    // ─── Notification mark read ───
    const notifItem = e.target.closest('[data-notif-id]');
    if (notifItem) { markRead(Number.parseInt(notifItem.dataset.notifId)); return; }

    // ─── Track list actions ───
    const trackEdit = e.target.closest('[data-track-edit]');
    if (trackEdit) { e.stopPropagation(); openTrackEdit(Number.parseInt(trackEdit.dataset.trackEdit)); return; }

    const trackRemove = e.target.closest('[data-track-remove]');
    if (trackRemove) { e.stopPropagation(); removeTrack(Number.parseInt(trackRemove.dataset.trackRemove)); return; }

    // ─── Datepicker day click ───
    const dpDay = e.target.closest('[data-dp-date]');
    if (dpDay) {
      const [y, m, d] = dpDay.dataset.dpDate.split('-').map(Number);
      selectDate(y, m, d);
      return;
    }

    // ─── Track item click → openTrackEdit ───
    const trackItem = e.target.closest('.track-item-clickable');
    if (trackItem && !e.target.closest('.track-item-drag') && !e.target.closest('[data-track-edit]') && !e.target.closest('[data-track-remove]')) {
      openTrackEdit(Number.parseInt(trackItem.dataset.index));
    }
  });

  // ─── Search input ───
  const searchInput = document.querySelector('[data-action="search-releases"]');
  if (searchInput) {
    searchInput.addEventListener('input', function() { onSearch(this.value); });
    searchInput.addEventListener('focus', function() { this.style.borderColor = 'rgba(155,39,175,0.5)'; });
    searchInput.addEventListener('blur', function() { this.style.borderColor = 'var(--line2)'; });
  }

  // ─── Artist search inputs ───
  const primaryInput = document.getElementById('primary-artist-input');
  if (primaryInput) {
    primaryInput.addEventListener('input', function() { searchArtists(this.value, 'primary'); });
    primaryInput.addEventListener('focus', function() { searchArtists(this.value, 'primary'); });
  }

  const featInput = document.getElementById('feat-artist-input');
  if (featInput) {
    featInput.addEventListener('input', function() { searchArtists(this.value, 'feat'); });
    featInput.addEventListener('focus', function() { searchArtists(this.value, 'feat'); });
    featInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); addFeatFromInput(); }
    });
  }

  bindTrackDrag();

  // ─── Close dropdowns on outside click ───
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.artist-search-wrap')) {
      document.querySelectorAll('.artist-dropdown').forEach(d => d.classList.remove('open'));
    }
    const wrap = document.getElementById('dp-wrap');
    if (wrap && !wrap.contains(e.target)) {
      document.getElementById('dp-dropdown').classList.remove('open');
    }
  });

  bindFileInputs();

  // ─── Drag & Drop zones ───
  setupDragDrop('audio-zone', function(files) {
    const audioOnly = files.filter(f => /\.(mp3|wav|flac)$/i.test(f.name));
    if (!audioOnly.length) { showToast('⚠️ Нужен аудиофайл (MP3, WAV, FLAC)', 'error'); return; }
    handleAudioFiles(audioOnly);
  });

  setupDragDrop('cover-zone', function(files) {
    const imgFile = files.find(f => /\.(jpe?g|png)$/i.test(f.name));
    if (!imgFile) { showToast('⚠️ Нужно изображение (JPEG, PNG)', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => handleCoverFile(imgFile, ev.target.result);
    reader.readAsDataURL(imgFile);
  });

  // ─── Autosave on upload form input ───
  const uploadScreen = document.getElementById('screen-upload');
  if (uploadScreen) {
    uploadScreen.addEventListener('input', () => {
      clearTimeout(AppState.autosaveTimer);
      AppState.autosaveTimer = setTimeout(saveDraftNow, 1500);
    });
  }

  bindFormSelects();
}

// ═══════════════════════════════════════════════════════════
// AUTOFILL ARTIST FROM PROFILE
// ═══════════════════════════════════════════════════════════

function autoCreateArtistProfile() {
  if (AppState.currentUser?.name && getArtistProfiles().length === 0) {
    const autoArtist = { id: Date.now(), name: AppState.currentUser.name, spotifyId: '', appleId: '', createdAt: new Date().toISOString() };
    saveArtistProfiles([autoArtist]);
  }
}

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════

function initReleases() {
  AppState.artistProfiles = getArtistProfiles();
  AppState.DRAFT_KEY = 'cr_draft_' + getDraftKey();

  autoCreateArtistProfile();
  initDatepicker();
  bindEvents();
  renderNotifications();
  loadDraft();
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

export {
  initReleases,
  renderReleases,
  renderArtistProgress,
  renderActivityFeed,
  renderTip,
  renderPlatforms,
  renderNotifications,
  showToast,
  setRenderAnalytics
};
