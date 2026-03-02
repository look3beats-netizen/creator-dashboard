// ═══════════════════════════════════════════════════════════
// creator® — core/storage.js
// Инкапсуляция localStorage. Без бизнес-логики.
// ═══════════════════════════════════════════════════════════

const Storage = {
  /**
   * Получить значение из localStorage с JSON-парсингом.
   * Возвращает null при ошибке или отсутствии ключа.
   */
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  /**
   * Сохранить значение в localStorage с JSON-сериализацией.
   */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('[Storage] set failed:', key, e);
    }
  },

  /**
   * Удалить ключ из localStorage.
   */
  remove(key) {
    localStorage.removeItem(key);
  },

  /**
   * Получить сырую строку из localStorage (без JSON.parse).
   * Используется для простых строковых значений (тема, флаги).
   */
  getRaw(key) {
    return localStorage.getItem(key);
  },

  /**
   * Сохранить сырую строку в localStorage (без JSON.stringify).
   */
  setRaw(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('[Storage] setRaw failed:', key, e);
    }
  }
};

export default Storage;
