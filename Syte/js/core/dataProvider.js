// ═══════════════════════════════════════════════════════════
// creator® — core/dataProvider.js
// Единственная точка доступа к данным.
// Без DOM. Вся работа с хранилищем — через Storage.
// При переходе на API — меняется только этот файл.
// ═══════════════════════════════════════════════════════════

import Storage from './storage.js';

// ─── КЛЮЧИ ХРАНИЛИЩА ───
const KEYS = {
  THEME:        'cr_theme',
  CURRENT_USER: 'cr_current_user',
  USERS:        'cr_users',
  RELEASES:     'cr_releases',
  ARTISTS:      'cr_artists',
  ONBOARDING:   'cr_onboarding_done',
  notifications: (email) => 'cr_notifications_' + email,
  draft:         (email) => 'cr_draft_' + email
};

// ─── ТЕМА ───

function getTheme() {
  return Storage.getRaw(KEYS.THEME) || 'dark';
}

function setTheme(value) {
  Storage.setRaw(KEYS.THEME, value);
}

// ─── ТЕКУЩИЙ ПОЛЬЗОВАТЕЛЬ ───

function getCurrentUser() {
  return Storage.get(KEYS.CURRENT_USER);
}

function setCurrentUser(user) {
  Storage.set(KEYS.CURRENT_USER, user);
}

function removeCurrentUser() {
  Storage.remove(KEYS.CURRENT_USER);
}

// ─── ПОЛЬЗОВАТЕЛИ ───

function getUsers() {
  return Storage.get(KEYS.USERS) || [];
}

function saveUsers(users) {
  Storage.set(KEYS.USERS, users);
}

// ─── РЕЛИЗЫ ───

function getAllReleases() {
  return Storage.get(KEYS.RELEASES) || [];
}

function getReleasesByEmail(email) {
  return getAllReleases().filter(r => r.userEmail === email);
}

function saveAllReleases(releases) {
  Storage.set(KEYS.RELEASES, releases);
}

function addRelease(release) {
  const releases = getAllReleases();
  releases.push(release);
  saveAllReleases(releases);
}

function deleteRelease(id) {
  const releases = getAllReleases().filter(r => r.id !== id);
  saveAllReleases(releases);
}

function findReleaseById(id) {
  return getAllReleases().find(r => r.id === id) || null;
}

// ─── ПРОФИЛИ АРТИСТОВ ───

function getArtistProfiles() {
  return Storage.get(KEYS.ARTISTS) || [];
}

function saveArtistProfiles(profiles) {
  Storage.set(KEYS.ARTISTS, profiles);
}

// ─── УВЕДОМЛЕНИЯ ───

function getNotifications(email) {
  return Storage.get(KEYS.notifications(email)) || [];
}

function saveNotifications(email, notifs) {
  Storage.set(KEYS.notifications(email), notifs);
}

// ─── ЧЕРНОВИК ───

function getDraft(email) {
  return Storage.get(KEYS.draft(email));
}

function saveDraft(email, data) {
  Storage.set(KEYS.draft(email), data);
}

function removeDraft(email) {
  Storage.remove(KEYS.draft(email));
}

// ─── ONBOARDING ───

function isOnboardingDone() {
  return Storage.getRaw(KEYS.ONBOARDING) === 'true';
}

function setOnboardingDone() {
  Storage.setRaw(KEYS.ONBOARDING, 'true');
}

// ─── EXPORT ───

export {
  KEYS,
  // тема
  getTheme,
  setTheme,
  // текущий пользователь
  getCurrentUser,
  setCurrentUser,
  removeCurrentUser,
  // пользователи
  getUsers,
  saveUsers,
  // релизы
  getAllReleases,
  getReleasesByEmail,
  saveAllReleases,
  addRelease,
  deleteRelease,
  findReleaseById,
  // артисты
  getArtistProfiles,
  saveArtistProfiles,
  // уведомления
  getNotifications,
  saveNotifications,
  // черновик
  getDraft,
  saveDraft,
  removeDraft,
  // onboarding
  isOnboardingDone,
  setOnboardingDone
};
