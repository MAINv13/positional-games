/**
 * BayesianView.js — Отображение результатов байесовского решения IPO.
 *
 * Показывает три блока:
 *  1. График функций ставок b_i(v_i) для каждого игрока (Plotly).
 *     Для Б и В функции зависят от истории, поэтому усредняем по истории
 *     для наглядности (показываем «среднюю» функцию реакции).
 *  2. Таблица ожидаемых выигрышей: BNE vs «v - 5».
 *  3. Текстовая интерпретация.
 *
 * Если Plotly не загружен — пробуем повторить через таймаут.
 */

import { solveBayesianIPO, naiveExpectedPayoffs } from '../core/BayesianSolver.js';

export class BayesianView {
  constructor(container) {
    this.container = container;
    this.rendered = false;
  }

  /**
   * Главная точка входа. config = tree.bayesianConfig.
   * Возвращает результаты или null, если конфиг отсутствует.
   */
  show(config) {
    if (!config) {
      this.container.innerHTML = '';
      return;
    }
    const bne = solveBayesianIPO(config);
    const naive = naiveExpectedPayoffs(config);
    this._renderHTML(bne, naive);
    // Дождёмся загрузки Plotly (иногда CDN отвечает позже DOMContentLoaded)
    this._renderPlot(bne);
  }

  reset() {
    this.container.innerHTML = '';
  }

  _renderHTML(bne, naive) {
    const cmpRow = (i, name) => {
      const b = bne.expectedPayoffs[i];
      const n = naive[i];
      const diff = b - n;
      const cls = diff > 1e-6 ? 'better' : diff < -1e-6 ? 'worse' : '';
      const sign = diff > 0 ? '+' : '';
      return `<tr>
        <td>${name}</td>
        <td>${b.toFixed(0)}</td>
        <td>${n.toFixed(0)}</td>
        <td class="${cls}">${sign}${diff.toFixed(0)}</td>
      </tr>`;
    };

    this.container.innerHTML = `
      <div class="bayes-block">
        <div class="strategy-player">Функции ставок b_i(v_i) — байесовское равновесие</div>
        <div class="bayes-plot" id="bayesPlot" style="width:100%; height:280px;"></div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
          Функции Б и В показаны усреднённо по истории ходов соперников.
          Точная стратегия зависит ещё и от наблюдаемых ставок.
        </div>
      </div>

      <div class="bayes-block">
        <div class="strategy-player">Ожидаемые выигрыши (по $v_i \\sim U[90,110]$)</div>
        <table class="payoff-table">
          <thead><tr><th>Игрок</th><th>BNE</th><th>«v−5»</th><th>Δ</th></tr></thead>
          <tbody>
            ${cmpRow(0, 'Фонд А')}
            ${cmpRow(1, 'Фонд Б')}
            ${cmpRow(2, 'Фонд В')}
          </tbody>
        </table>
      </div>

      <div class="bayes-block">
        <div class="strategy-player">Интерпретация</div>
        <div style="font-size:12px; color:var(--text-secondary); line-height:1.5;">
          В байесовском равновесии каждый фонд использует <em>пороговую</em>
          стратегию: при низкой оценке ставит минимум, при высокой — поднимает
          ставку. Это аналог классического равновесия в аукционе первой цены.
          Если BNE даёт больше «v−5» — это значит, что наивная стратегия
          теряет в среднем; разница тем больше, чем тоньше сетка ставок.
        </div>
      </div>
    `;
    // Перерендерим формулы KaTeX, если он есть
    if (typeof window.renderMathInElement === 'function') {
      window.renderMathInElement(this.container, {
        delimiters: [{ left: '$', right: '$', display: false }],
        throwOnError: false,
      });
    }
  }

  /**
   * Рендер графика функций ставок через Plotly.
   * Для А — точная функция b_A(v_A).
   * Для Б — усредняем по b_A (равномерно по сетке ставок).
   * Для В — усредняем по (b_A, b_B).
   */
  _renderPlot(bne) {
    const plotEl = document.getElementById('bayesPlot');
    if (!plotEl) return;
    if (typeof window.Plotly === 'undefined') {
      // Plotly не загружен — попробуем чуть позже
      setTimeout(() => this._renderPlot(bne), 200);
      return;
    }

    const v = bne.valGrid;
    const A = bne.stratA;

    // Усреднение для Б: для каждого v_B берём среднее b_B по всем b_A
    const B = v.map((_, j) => {
      let sum = 0, count = 0;
      for (const bA of bne.bidGrid) {
        const arr = bne.stratB.get(`${bA}`);
        if (arr) { sum += arr[j]; count++; }
      }
      return count > 0 ? sum / count : 0;
    });

    // Усреднение для В: для каждого v_C берём среднее b_C по всем (b_A, b_B)
    const C = v.map((_, j) => {
      let sum = 0, count = 0;
      for (const bA of bne.bidGrid) {
        for (const bB of bne.bidGrid) {
          const arr = bne.stratC.get(`${bA}|${bB}`);
          if (arr) { sum += arr[j]; count++; }
        }
      }
      return count > 0 ? sum / count : 0;
    });

    // Цвета согласованы с игроками в SVG-дереве
    const styles = getComputedStyle(document.documentElement);
    const p1 = styles.getPropertyValue('--player-1').trim() || '#4a9eff';
    const p2 = styles.getPropertyValue('--player-2').trim() || '#ff6b9d';
    const p3 = styles.getPropertyValue('--player-3').trim() || '#4ade80';
    const bg = styles.getPropertyValue('--bg-panel').trim() || '#131316';
    const txt = styles.getPropertyValue('--text-secondary').trim() || '#9c9ca5';
    const grid = styles.getPropertyValue('--border-strong').trim() || '#2e2e35';

    const traces = [
      { x: v, y: A, name: 'Фонд А', mode: 'lines+markers',
        line: { color: p1, width: 2 }, marker: { size: 6 } },
      { x: v, y: B, name: 'Фонд Б (среднее)', mode: 'lines+markers',
        line: { color: p2, width: 2, dash: 'dash' }, marker: { size: 6 } },
      { x: v, y: C, name: 'Фонд В (среднее)', mode: 'lines+markers',
        line: { color: p3, width: 2, dash: 'dot' }, marker: { size: 6 } },
      // Линия y=x для сравнения
      { x: v, y: v, name: 'b = v', mode: 'lines',
        line: { color: txt, width: 1, dash: 'dot' }, showlegend: true },
    ];

    const layout = {
      paper_bgcolor: bg,
      plot_bgcolor: bg,
      font: { family: 'JetBrains Mono, monospace', size: 10, color: txt },
      margin: { l: 40, r: 10, t: 10, b: 40 },
      xaxis: {
        title: { text: 'Приватная оценка v_i', font: { size: 11 } },
        gridcolor: grid, zerolinecolor: grid,
      },
      yaxis: {
        title: { text: 'Равновесная ставка b_i', font: { size: 11 } },
        gridcolor: grid, zerolinecolor: grid,
      },
      legend: { font: { size: 9 }, orientation: 'h', y: -0.25 },
    };
    window.Plotly.newPlot(plotEl, traces, layout, { displayModeBar: false, responsive: true });
  }
}
