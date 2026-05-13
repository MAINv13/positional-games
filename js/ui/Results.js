/**
 * Results.js — Отображение результатов решения:
 *   • Равновесные стратегии всех игроков (в текстовом виде).
 *   • Сравнительная таблица выигрышей: SPE vs наивная стратегия.
 */

import { Solver } from '../core/Solver.js';

export class ResultsView {
  constructor(eqContainer, comparisonContainer) {
    this.eqEl = eqContainer;
    this.cmpEl = comparisonContainer;
  }

  /**
   * Принимает tree (уже решённый Solver-ом) и отрисовывает блоки.
   */
  show(tree) {
    this._renderEquilibrium(tree);
    this._renderComparison(tree);
  }

  reset() {
    this.eqEl.innerHTML = '<p class="placeholder">Нажмите «Решить» для запуска обратной индукции.</p>';
    this.cmpEl.innerHTML = '<p class="placeholder">Сравнение SPE и наивной стратегии появится после решения.</p>';
  }

  _renderEquilibrium(tree) {
    const path = tree.markEquilibriumPath();
    const html = [];

    // Краткое описание равновесного пути
    html.push('<div class="equilibrium-strategy">');
    html.push('<div class="strategy-player">Равновесный путь</div>');
    const pathStr = path.actions.map(a =>
      `${tree.players[a.player - 1]}: <b>${a.action}</b>`).join(' → ');
    html.push(`<div>${pathStr}</div>`);
    html.push(`<div style="margin-top:6px;color:var(--text-secondary);">` +
      `Выигрыши: [${path.payoffs.map(p => this._fmt(p)).join(', ')}]</div>`);
    html.push('</div>');

    // Стратегии каждого игрока — для краткости выводим только реализуемую часть
    // и ключевые «иначе»-ветки (для IPO и других маленьких игр — все узлы).
    const decisionsByPlayer = new Map();
    tree.traverse(n => {
      if (n.isDecision()) {
        if (!decisionsByPlayer.has(n.player)) decisionsByPlayer.set(n.player, []);
        decisionsByPlayer.get(n.player).push(n);
      }
    });

    for (const [player, nodes] of decisionsByPlayer.entries()) {
      html.push('<div class="equilibrium-strategy">');
      html.push(`<div class="strategy-player">${tree.players[player - 1]} · ${nodes.length} узлов</div>`);
      // Показываем максимум 8 узлов, чтобы не раздувать. Для IPO их 3+9=12 у Б/В.
      const limit = 12;
      const shown = nodes.slice(0, limit);
      for (const n of shown) {
        const histStr = this._historyToStr(n, tree);
        html.push(`<div>${histStr} → <b>${n.optimalAction}</b></div>`);
      }
      if (nodes.length > limit) {
        html.push(`<div style="color:var(--text-muted);">... и ещё ${nodes.length - limit} узлов</div>`);
      }
      html.push('</div>');
    }

    this.eqEl.innerHTML = html.join('');
  }

  _historyToStr(node, tree) {
    if (!node.parent) return '<i>root</i>';
    const parts = [];
    let cur = node;
    while (cur.parent) {
      const playerName = tree.players[cur.parent.player - 1];
      parts.unshift(`${playerName}=${cur.edgeLabel}`);
      cur = cur.parent;
    }
    return parts.join(', ');
  }

  _renderComparison(tree) {
    if (!tree.naiveStrategy) {
      this.cmpEl.innerHTML = '<p class="placeholder">Для этой игры наивная стратегия не задана.</p>';
      return;
    }

    const spePath = tree.markEquilibriumPath();
    const naiveResult = Solver.simulate(tree, tree.naiveStrategy);

    const N = tree.N;
    const rows = [];
    rows.push('<table class="payoff-table">');
    rows.push('<thead><tr><th>Игрок</th><th>SPE</th><th>Наивная</th><th>Δ</th></tr></thead>');
    rows.push('<tbody>');
    for (let i = 0; i < N; i++) {
      const spe = spePath.payoffs[i];
      const nv = naiveResult.payoffs[i];
      const diff = spe - nv;
      const cls = diff > 1e-9 ? 'better' : diff < -1e-9 ? 'worse' : '';
      rows.push(`<tr>
        <td>${tree.players[i]}</td>
        <td>${this._fmt(spe)}</td>
        <td>${this._fmt(nv)}</td>
        <td class="${cls}">${diff > 0 ? '+' : ''}${this._fmt(diff)}</td>
      </tr>`);
    }
    rows.push('</tbody></table>');

    // Описание стратегий
    rows.push('<div style="margin-top:10px;font-size:11px;color:var(--text-muted);">');
    rows.push(`SPE-путь: ${spePath.actions.map(a => a.action).join(' → ')}<br>`);
    rows.push(`Наивный путь: ${naiveResult.history.map(a => a.action).join(' → ')}`);
    rows.push('</div>');

    this.cmpEl.innerHTML = rows.join('');
  }

  _fmt(n) {
    if (Number.isInteger(n)) return String(n);
    return Number(n).toFixed(2).replace(/\.?0+$/, '');
  }
}
