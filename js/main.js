/**
 * main.js — Точка входа модуля. Связывает UI и движок:
 *   • При смене типа игры — генерирует контролы параметров и дерево.
 *   • При нажатии «Решить» — запускает Solver и обновляет визуал.
 *   • «Пошагово» — итерирует Solver через Stepper, подсвечивая узлы.
 *   • «Сброс» — сбрасывает разметку дерева, возвращает чистое состояние.
 *   • «Стоп» — прерывает пошаговую анимацию.
 */

import { Solver } from './core/Solver.js';
import { TreeRenderer } from './ui/TreeRenderer.js';
import { ParamControls } from './ui/Controls.js';
import { ResultsView }   from './ui/Results.js';
import { ThemeManager }  from './ui/ThemeManager.js';
import { BayesianView }  from './ui/BayesianView.js';
import { renderMath }    from './utils/MathRenderer.js';

import { buildIPOConfig, IPOParamsSchema } from './games/IPOAuction.js';
import { buildUltimatumConfig, UltimatumParamsSchema } from './games/Ultimatum.js';
import { buildCentipedeConfig, CentipedeParamsSchema } from './games/Centipede.js';
import { buildBargainingConfig, BargainingParamsSchema } from './games/Bargaining.js';
import { buildMarketEntryConfig, MarketEntryParamsSchema, unpackMarketEntryParams } from './games/MarketEntry.js';

// --- Регистр игр ---
const GAMES = {
  'ipo': {
    schema: IPOParamsSchema,
    build: (p) => buildIPOConfig(p),
  },
  'ultimatum': {
    schema: UltimatumParamsSchema,
    build: (p) => buildUltimatumConfig(p),
  },
  'centipede': {
    schema: CentipedeParamsSchema,
    build: (p) => buildCentipedeConfig(p),
  },
  'bargaining': {
    schema: BargainingParamsSchema,
    build: (p) => buildBargainingConfig(p),
  },
  'market-entry': {
    schema: MarketEntryParamsSchema,
    build: (p) => buildMarketEntryConfig(unpackMarketEntryParams(p)),
  },
};

// --- Главное приложение ---
class App {
  constructor() {
    // Кеши элементов
    this.$gameSelect = document.getElementById('gameSelect');
    this.$gameParams = document.getElementById('gameParams');
    this.$status = document.getElementById('status');
    this.$problem = document.getElementById('problemStatement');
    this.$btnSolve = document.getElementById('btnSolve');
    this.$btnStep = document.getElementById('btnStep');
    this.$btnStop = document.getElementById('btnStop');
    this.$btnReset = document.getElementById('btnReset');
    this.$btnZoomIn = document.getElementById('btnZoomIn');
    this.$btnZoomOut = document.getElementById('btnZoomOut');
    this.$btnZoomReset = document.getElementById('btnZoomReset');

    // Подсистемы
    this.renderer = new TreeRenderer(
      document.getElementById('treeSvg'),
      document.getElementById('tooltip'),
    );
    this.params = new ParamControls(this.$gameParams);
    this.results = new ResultsView(
      document.getElementById('equilibriumOutput'),
      document.getElementById('comparison'),
    );
    this.theme = new ThemeManager(document.getElementById('themeToggle'));
    this.bayes = new BayesianView(document.getElementById('bayesianOutput'));
    this.$bayesSection = document.getElementById('bayesianSection');

    // Состояние
    this.tree = null;
    this.stepper = null;
    this.stepTimer = null;
    this.zoom = 1;

    this._bindEvents();
    this._loadGame('ipo');
  }

  _bindEvents() {
    this.$gameSelect.addEventListener('change', () => {
      this._loadGame(this.$gameSelect.value);
    });

    this.params.onChange = () => {
      this._rebuildTree();
    };

    this.$btnSolve.addEventListener('click', () => this._solveNow());
    this.$btnStep.addEventListener('click', () => this._toggleStepper());
    this.$btnStop.addEventListener('click', () => this._stopStepper());
    this.$btnReset.addEventListener('click', () => this._reset());

    this.$btnZoomIn.addEventListener('click', () => {
      this.zoom *= 1.2;
      this.renderer.setZoom(this.zoom);
    });
    this.$btnZoomOut.addEventListener('click', () => {
      this.zoom /= 1.2;
      this.renderer.setZoom(this.zoom);
    });
    this.$btnZoomReset.addEventListener('click', () => {
      this.zoom = 1;
      this.renderer.resetZoom();
    });
  }

  _loadGame(id) {
    const game = GAMES[id];
    if (!game) return;
    this.params.render(game.schema);
    this._rebuildTree();
  }

  _rebuildTree() {
    const id = this.$gameSelect.value;
    const game = GAMES[id];
    const values = this.params.getValues();
    this.tree = game.build(values);

    // Постановка
    this.$problem.innerHTML = this.tree.statement;
    renderMath(this.$problem);

    // Дерево
    this.renderer.setTree(this.tree);
    this.results.reset();

    // Байесовский блок — показываем только если игра предоставляет конфиг
    if (this.tree.bayesianConfig) {
      this.$bayesSection.style.display = '';
      this.bayes.show(this.tree.bayesianConfig);
    } else {
      this.$bayesSection.style.display = 'none';
      this.bayes.reset();
    }

    this._setStatus('ready', this.tree.stats());
  }

  _solveNow() {
    if (!this.tree) return;
    Solver.solve(this.tree);
    this.tree.markEquilibriumPath();
    this.renderer.refresh();
    this.results.show(this.tree);
    this._setStatus('solved');
  }

  _toggleStepper() {
    if (this.stepTimer) {
      // Сейчас идёт пошаговая — пауза
      this._stopStepper();
      return;
    }
    if (!this.stepper) {
      // Создаём новый
      this._reset(/*keepGame=*/ true);
      this.stepper = Solver.createStepper(this.tree);
    }
    this.$btnStop.disabled = false;
    this._setStatus('stepping');
    this.stepTimer = setInterval(() => this._tickStepper(), 350);
  }

  _tickStepper() {
    const result = this.stepper.next();
    if (result.done) {
      // Конец пошаговой
      this._stopStepper();
      this.tree.markEquilibriumPath();
      this.renderer.refresh();
      this.results.show(this.tree);
      this._setStatus('solved');
      this.stepper = null;
      return;
    }
    // Подсветим текущий узел
    this.tree.traverse(n => { n.onEquilibriumPath = false; });
    result.event.node.onEquilibriumPath = true;
    this.renderer.refresh();
  }

  _stopStepper() {
    if (this.stepTimer) {
      clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
    this.$btnStop.disabled = true;
    this._setStatus('paused');
  }

  _reset(keepGame = false) {
    this._stopStepper();
    this.stepper = null;
    if (!keepGame) this._rebuildTree();
    else {
      // Только сбрасываем разметку решения
      this.tree.clearEquilibriumPath();
      this.tree.traverse(n => {
        n.optimalAction = null;
        if (n.isDecision()) n.value = null;
      });
      this.renderer.refresh();
      this.results.reset();
    }
    this._setStatus('ready');
  }

  _setStatus(state, stats) {
    const map = {
      idle: { txt: 'idle', cls: '' },
      ready: { txt: stats ? `${stats.nodes} узлов, ${stats.terminals} листьев` : 'ready', cls: '' },
      solved: { txt: 'SPE найдено', cls: 'active' },
      stepping: { txt: 'обратная индукция…', cls: 'active' },
      paused: { txt: 'пауза', cls: '' },
    };
    const s = map[state] ?? map.idle;
    this.$status.textContent = s.txt;
    this.$status.className = 'status-indicator ' + s.cls;
  }
}

// --- Старт ---
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
