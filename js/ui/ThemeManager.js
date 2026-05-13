/**
 * ThemeManager.js — Переключение тем (тёмная по умолчанию).
 * Сохраняет выбор в памяти приложения (без localStorage — у нас client-side
 * но в спецификации не оговорено постоянное хранение, ограничимся текущей сессией).
 */

export class ThemeManager {
  constructor(toggleEl) {
    this.toggleEl = toggleEl;
    this.theme = 'dark'; // по умолчанию тёмная (требование ТЗ)
    this._apply();

    this.toggleEl.addEventListener('click', () => this.toggle());
  }

  toggle() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    this._apply();
  }

  _apply() {
    document.documentElement.setAttribute('data-theme', this.theme);
    this.toggleEl.innerHTML = this.theme === 'dark'
      ? '<span class="theme-icon-dark">◐</span>'
      : '<span class="theme-icon-light">◑</span>';
  }
}
