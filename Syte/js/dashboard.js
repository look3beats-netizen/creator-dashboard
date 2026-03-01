// ═══════════════════════════════════════════════════════════
// creator® — dashboard.js (bootstrap)
// Точка входа. Склейка модулей. Без бизнес-логики.
// Без глобальных функций. Без Object.assign(window).
// ═══════════════════════════════════════════════════════════

import AppState from './core/state.js';
import { getReleasesByEmail } from './core/dataProvider.js';

import {
  initUI,
  renderAnalytics,
  setShowToast,
  setGetReleases
} from './modules/ui.js';

import {
  initNavigation,
  onScreenChange
} from './modules/navigation.js';

import {
  initReleases,
  renderReleases,
  renderArtistProgress,
  renderActivityFeed,
  renderTip,
  renderPlatforms,
  showToast,
  setRenderAnalytics
} from './modules/releases.js';

// ═══════════════════════════════════════════════════════════
// DEPENDENCY INJECTION
// ═══════════════════════════════════════════════════════════

setShowToast(showToast);
setGetReleases(() => getReleasesByEmail(AppState.currentUser.email));
setRenderAnalytics(renderAnalytics);

onScreenChange('analytics', renderAnalytics);
onScreenChange('platforms', renderPlatforms);

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════

initUI();
initNavigation();
initReleases();

renderReleases();
renderAnalytics();
renderArtistProgress();
renderActivityFeed();
renderTip();