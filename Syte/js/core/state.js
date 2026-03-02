// ═══════════════════════════════════════════════════════════
// creator® — core/state.js
// Централизованное состояние приложения.
// Без DOM. Без localStorage. Без бизнес-логики.
// ═══════════════════════════════════════════════════════════

const defaults = {
  currentUser: null,
  selectedType: 'single',
  audioFiles: [],
  trackMeta: [],
  coverFile: null,
  editingTrackIndex: -1,
  currentStep: 1,
  dragFromIndex: -1,
  artistProfiles: [],
  selectedPrimaryArtist: null,
  featArtists: [],
  currentFilter: 'all',
  currentSearch: '',
  onboardingStep: 0,
  dpYear: 0,
  dpMonth: 0,
  dpSelectedDate: null,
  autosaveTimer: null,
  DRAFT_KEY: ''
};

const AppState = { ...defaults };

/**
 * Получить значение по ключу.
 */
function getState(key) {
  return AppState[key];
}

/**
 * Установить одно или несколько значений.
 * setState('key', value) или setState({ key: value, key2: value2 })
 */
function setState(keyOrObj, value) {
  if (typeof keyOrObj === 'string') {
    AppState[keyOrObj] = value;
  } else if (typeof keyOrObj === 'object' && keyOrObj !== null) {
    Object.assign(AppState, keyOrObj);
  }
}

/**
 * Сбросить состояние к значениям по умолчанию.
 * Если передан массив ключей — сбрасывает только их.
 */
function resetState(keys) {
  if (Array.isArray(keys)) {
    keys.forEach(k => {
      if (k in defaults) {
        const def = defaults[k];
        AppState[k] = Array.isArray(def) ? [...def] : def;
      }
    });
  } else {
    Object.keys(defaults).forEach(k => {
      const def = defaults[k];
      AppState[k] = Array.isArray(def) ? [...def] : def;
    });
  }
}

export { AppState, getState, setState, resetState };
export default AppState;
