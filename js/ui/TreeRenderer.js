/**
 * TreeRenderer.js — Отрисовка дерева игры на SVG.
 *
 * Использует layout по уровням: y координата = depth * levelHeight,
 * x координаты на каждом уровне распределяются по терминалам
 * (классический «tidy tree» в упрощённом виде):
 *   1. Сначала post-order назначаем x терминалам, увеличивая глобальный счётчик.
 *   2. Для внутреннего узла x = среднее x его детей.
 *
 * Поддерживает зум через изменение viewBox.
 */

export class TreeRenderer {
  constructor(svgEl, tooltipEl) {
    this.svg = svgEl;
    this.tooltip = tooltipEl;
    this.tree = null;
    this.layout = null;
    this.zoom = 1;
    this.viewBox = { x: 0, y: 0, w: 800, h: 600 };
    this.NS = 'http://www.w3.org/2000/svg';

    // Параметры layout-а
    this.LEVEL_H = 90;       // вертикальное расстояние между уровнями
    this.LEAF_W  = 64;       // горизонтальное расстояние между листьями
    this.PADDING = 40;
    this.NODE_R  = 13;       // радиус узла решения
    this.TERM_W  = 36;       // ширина прямоугольника терминала
    this.TERM_H  = 26;
  }

  setTree(tree) {
    this.tree = tree;
    this._computeLayout();
    this._render();
  }

  /** Перерисовать без пересчёта layout (после изменения подсветки). */
  refresh() {
    if (this.tree) this._render();
  }

  setZoom(z) {
    this.zoom = Math.max(0.3, Math.min(3, z));
    this._applyViewBox();
  }

  resetZoom() {
    this.zoom = 1;
    this._applyViewBox();
  }

  /**
   * Считает координаты x,y для всех узлов.
   * При большом числе листьев автоматически сужает расстояние между ними,
   * чтобы дерево не растягивалось на километры — это нужно для непрерывного
   * варианта IPO, где steps=11 даёт 1331 терминал.
   */
  _computeLayout() {
    const stats = this.tree.stats();

    // Адаптивная ширина листа: при > 100 терминалах уменьшаем
    if (stats.terminals > 500) {
      this.LEAF_W = 8;   // плотно, читать выигрыши уже трудно — но это режим обзора
      this.TERM_W = 6;
      this.TERM_H = 6;
    } else if (stats.terminals > 200) {
      this.LEAF_W = 18;
      this.TERM_W = 16;
      this.TERM_H = 14;
    } else if (stats.terminals > 60) {
      this.LEAF_W = 36;
      this.TERM_W = 28;
      this.TERM_H = 22;
    } else {
      this.LEAF_W = 64;
      this.TERM_W = 36;
      this.TERM_H = 26;
    }

    let leafCounter = 0;

    const assign = (node) => {
      node.y = this.PADDING + node.depth * this.LEVEL_H;
      if (node.isTerminal()) {
        node.x = this.PADDING + leafCounter * this.LEAF_W;
        leafCounter++;
      } else {
        const xs = [];
        for (const child of node.children.values()) {
          assign(child);
          xs.push(child.x);
        }
        node.x = (xs[0] + xs[xs.length - 1]) / 2;
      }
    };

    assign(this.tree.root);

    this.layout = {
      width: this.PADDING * 2 + leafCounter * this.LEAF_W,
      height: this.PADDING * 2 + stats.maxDepth * this.LEVEL_H + this.TERM_H + 16,
    };

    this.viewBox = { x: 0, y: 0, w: this.layout.width, h: this.layout.height };
    this._applyViewBox();
  }

  _applyViewBox() {
    const { x, y, w, h } = this.viewBox;
    const zw = w / this.zoom, zh = h / this.zoom;
    const cx = x + w / 2, cy = y + h / 2;
    this.svg.setAttribute('viewBox',
      `${cx - zw / 2} ${cy - zh / 2} ${zw} ${zh}`);
    this.svg.setAttribute('width', this.layout.width);
    this.svg.setAttribute('height', this.layout.height);
  }

  _render() {
    // Чистим
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);

    // Рисуем сначала рёбра, потом узлы — чтобы узлы были сверху
    this.tree.traverse(node => {
      if (node.parent) this._drawEdge(node.parent, node);
    });
    this.tree.traverse(node => this._drawNode(node));
  }

  _drawEdge(from, to) {
    const isEq = from.onEquilibriumPath && to.onEquilibriumPath;
    const path = document.createElementNS(this.NS, 'path');
    // Адаптивные радиусы для смещения концов ребра
    const adaptiveR = this.LEAF_W >= 36 ? this.NODE_R : Math.max(4, this.LEAF_W / 3);
    const fromR = from.isTerminal() ? this.TERM_H / 2 : adaptiveR;
    const toR   = to.isTerminal()   ? this.TERM_H / 2 : adaptiveR;
    // S-кривая для плавности
    const midY = (from.y + to.y) / 2;
    const d = `M ${from.x} ${from.y + fromR} ` +
              `C ${from.x} ${midY}, ${to.x} ${midY}, ` +
              `${to.x} ${to.y - toR}`;
    path.setAttribute('d', d);
    path.setAttribute('class', 'edge' + (isEq ? ' equilibrium' : ''));
    this.svg.appendChild(path);

    // Метка ребра — только если есть место. На плотных деревьях метки
    // сливаются и нечитаемы; их остаётся видно в тултипе при наведении.
    // Равновесную метку показываем всегда — она важна для понимания.
    const showLabel = this.LEAF_W >= 36 || isEq;
    if (to.edgeLabel != null && showLabel) {
      const label = document.createElementNS(this.NS, 'text');
      label.setAttribute('x', (from.x + to.x) / 2 + 6);
      label.setAttribute('y', midY);
      label.setAttribute('class', 'edge-label' + (isEq ? ' equilibrium' : ''));
      label.textContent = String(to.edgeLabel);
      this.svg.appendChild(label);
    }
  }

  _drawNode(node) {
    const g = document.createElementNS(this.NS, 'g');
    g.setAttribute('transform', `translate(${node.x}, ${node.y})`);

    if (node.isTerminal()) {
      // Прямоугольник с выигрышами
      const rect = document.createElementNS(this.NS, 'rect');
      rect.setAttribute('x', -this.TERM_W / 2);
      rect.setAttribute('y', -this.TERM_H / 2);
      rect.setAttribute('width', this.TERM_W);
      rect.setAttribute('height', this.TERM_H);
      rect.setAttribute('class', 'node-circle terminal' +
        (node.onEquilibriumPath ? ' highlight' : ''));
      rect.setAttribute('rx', 2);
      g.appendChild(rect);

      // Выигрыши внутри терминала — только если терминал крупный.
      // На плотных деревьях они нечитаемы и только засоряют картинку;
      // в тултипе при наведении всё видно.
      if (this.TERM_H >= 20) {
        const payoffs = node.payoffs;
        const lineH = 9;
        const startY = -((payoffs.length - 1) * lineH) / 2 + 3;
        payoffs.forEach((p, i) => {
          const t = document.createElementNS(this.NS, 'text');
          t.setAttribute('x', 0);
          t.setAttribute('y', startY + i * lineH);
          t.setAttribute('class', 'node-payoff');
          t.textContent = this._fmt(p);
          g.appendChild(t);
        });
      }
    } else {
      // Узел решения — кружок цвета игрока. На плотных деревьях радиус
      // и номер игрока внутри уменьшаются для читаемости.
      const adaptiveR = this.LEAF_W >= 36 ? this.NODE_R : Math.max(4, this.LEAF_W / 3);
      const circle = document.createElementNS(this.NS, 'circle');
      circle.setAttribute('r', adaptiveR);
      circle.setAttribute('class',
        `node-circle player-${node.player}` +
        (node.onEquilibriumPath ? ' highlight' : ''));
      g.appendChild(circle);

      // Номер игрока внутри — только если кружок достаточно большой
      if (adaptiveR >= 10) {
        const label = document.createElementNS(this.NS, 'text');
        label.setAttribute('class', 'node-label');
        label.setAttribute('y', 4);
        label.textContent = node.player;
        g.appendChild(label);
      }
    }

    // Тултип
    g.addEventListener('mouseenter', (e) => this._showTooltip(node, e));
    g.addEventListener('mousemove',  (e) => this._moveTooltip(e));
    g.addEventListener('mouseleave', ()  => this._hideTooltip());

    this.svg.appendChild(g);
  }

  _showTooltip(node, e) {
    let txt;
    if (node.isTerminal()) {
      const playerNames = this.tree.players.map((p, i) =>
        `${p}: ${this._fmt(node.payoffs[i])}`).join('\n');
      txt = `Терминал ${node.id}\nПриход: «${node.edgeLabel ?? '∅'}»\n${playerNames}`;
    } else {
      const value = node.value
        ? `\nЗначение: [${node.value.map(v => this._fmt(v)).join(', ')}]`
        : '';
      const opt = node.optimalAction != null
        ? `\nОптимально: ${node.optimalAction}` : '';
      txt = `Узел ${node.id}\nХодит: ${this.tree.players[node.player - 1]}` +
            `\nДействия: {${node.actions.join(', ')}}` + value + opt;
    }
    this.tooltip.textContent = txt;
    this.tooltip.classList.add('visible');
    this._moveTooltip(e);
  }

  _moveTooltip(e) {
    // Координаты относительно tree-container
    const container = this.tooltip.parentElement;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left + 12;
    const y = e.clientY - rect.top + 12;
    this.tooltip.style.left = x + 'px';
    this.tooltip.style.top = y + 'px';
  }

  _hideTooltip() {
    this.tooltip.classList.remove('visible');
  }

  _fmt(n) {
    if (Number.isInteger(n)) return String(n);
    return Number(n).toFixed(2).replace(/\.?0+$/, '');
  }
}
