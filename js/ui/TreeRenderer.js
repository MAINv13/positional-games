/**
 * MathRenderer.js — Обёртка над KaTeX auto-render.
 * Используется для отрисовки LaTeX-формул в постановках задач.
 *
 * KaTeX подключается через CDN-скрипт; этот модуль ждёт его загрузки.
 */

export function renderMath(element) {
  if (typeof window.renderMathInElement === 'function') {
    window.renderMathInElement(element, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$',  right: '$',  display: false },
      ],
      throwOnError: false,
    });
  } else {
    // KaTeX ещё не загрузился — попробовать чуть позже
    setTimeout(() => renderMath(element), 100);
  }
}
