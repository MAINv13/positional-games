/**
 * GameTree.js — Структура дерева игры в экстенсивной форме.
 *
 * Дерево состоит из узлов двух типов:
 *   - DecisionNode: узел, в котором ходит игрок player (1, 2 или 3).
 *     Содержит список действий (actions) и для каждого — дочерний узел.
 *   - TerminalNode: лист дерева, содержит выигрыши payoffs всех игроков.
 *
 * Узлы создаются через билдер (через GameConfig в js/games/*),
 * после построения GameTree используется Solver-ом для обратной индукции
 * и TreeRenderer-ом для отрисовки.
 *
 * Конвенции:
 *   - id узла — короткая строка, уникальная в пределах дерева. Строится
 *     как путь от корня: "root", "root/A=90", "root/A=90/B=100", и т.п.
 *     Это даёт детерминированную нумерацию и удобно для дебага.
 *   - payoffs — массив длины N (число игроков). null для нехоженых узлов.
 */

/**
 * Базовый узел. Все узлы знают своего родителя и метку перехода от него.
 */
export class Node {
  constructor(id, parent = null, edgeLabel = null) {
    this.id = id;
    this.parent = parent;
    this.edgeLabel = edgeLabel; // действие, которое привело сюда
    this.depth = parent ? parent.depth + 1 : 0;

    // Заполняется TreeRenderer-ом: координаты на экране
    this.x = 0;
    this.y = 0;

    // Заполняется Solver-ом: оптимальное действие в этом узле (для решающих)
    // и значение узла (вектор ожидаемых выигрышей) после обратной индукции
    this.optimalAction = null;
    this.value = null; // массив payoffs
    this.onEquilibriumPath = false;
  }

  isTerminal() { return false; }
  isDecision() { return false; }
}

/**
 * Узел решения — здесь ходит один из игроков.
 */
export class DecisionNode extends Node {
  constructor(id, player, actions, parent = null, edgeLabel = null) {
    super(id, parent, edgeLabel);
    this.player = player;         // номер игрока (1-индексация)
    this.actions = actions;       // массив строк-меток действий, напр. ['90','100','110']
    this.children = new Map();    // action -> Node
  }

  isDecision() { return true; }

  setChild(action, node) {
    this.children.set(action, node);
  }

  getChild(action) {
    return this.children.get(action);
  }
}

/**
 * Терминальный узел — содержит выигрыши всех игроков.
 */
export class TerminalNode extends Node {
  constructor(id, payoffs, parent = null, edgeLabel = null) {
    super(id, parent, edgeLabel);
    this.payoffs = payoffs;       // массив чисел длины N
    this.value = payoffs;         // для единообразия с DecisionNode
  }

  isTerminal() { return true; }
}

/**
 * Главный класс дерева игры. Хранит корень, метаданные игроков,
 * предоставляет обход и общую статистику.
 */
export class GameTree {
  /**
   * @param {Object} meta — описание игры
   * @param {string} meta.id          — короткий ID ('ipo', 'ultimatum', ...)
   * @param {string} meta.name        — название игры
   * @param {string[]} meta.players   — имена игроков ['Фонд А', 'Фонд Б', ...]
   * @param {Node}     meta.root      — корневой узел
   * @param {Object}   meta.params    — параметры конфигурации (для отображения)
   * @param {string}   meta.statement — HTML/Markdown постановки задачи
   * @param {Function} meta.naiveStrategy — (history, player) => action,
   *                                        наивная стратегия для сравнения
   */
  constructor(meta) {
    this.id = meta.id;
    this.name = meta.name;
    this.players = meta.players;
    this.root = meta.root;
    this.params = meta.params || {};
    this.statement = meta.statement || '';
    this.naiveStrategy = meta.naiveStrategy || null;
    // Опциональный конфиг для байесовского режима (только в IPO).
    // Если != null — main.js может вызвать BayesianSolver.solveBayesianIPO(...)
    // и показать функции ставок в дополнение к обычному дереву.
    this.bayesianConfig = meta.bayesianConfig || null;
  }

  /** Число игроков. */
  get N() { return this.players.length; }

  /**
   * Рекурсивный обход (pre-order). Вызывает callback(node, depth).
   */
  traverse(callback, node = this.root) {
    callback(node, node.depth);
    if (node.isDecision()) {
      for (const child of node.children.values()) {
        this.traverse(callback, child);
      }
    }
  }

  /** Подсчёт узлов и терминальных листьев. */
  stats() {
    let nodes = 0, terminals = 0, maxDepth = 0;
    this.traverse((n, d) => {
      nodes++;
      if (n.isTerminal()) terminals++;
      if (d > maxDepth) maxDepth = d;
    });
    return { nodes, terminals, maxDepth };
  }

  /** Возвращает массив узлов на каждом уровне дерева. Удобно для layout-а. */
  byLevels() {
    const levels = [];
    this.traverse((n, d) => {
      if (!levels[d]) levels[d] = [];
      levels[d].push(n);
    });
    return levels;
  }

  /** Сбросить подсветку равновесного пути. Вызывается перед новым Solve. */
  clearEquilibriumPath() {
    this.traverse(n => { n.onEquilibriumPath = false; });
  }

  /**
   * После того как Solver проставил optimalAction в каждом DecisionNode,
   * этот метод спускается от корня и помечает узлы на равновесном пути.
   * Также возвращает последовательность действий и итоговые payoffs.
   */
  markEquilibriumPath() {
    this.clearEquilibriumPath();
    const actions = [];
    let node = this.root;
    node.onEquilibriumPath = true;
    while (node.isDecision()) {
      const a = node.optimalAction;
      actions.push({ player: node.player, action: a, nodeId: node.id });
      node = node.getChild(a);
      node.onEquilibriumPath = true;
    }
    return {
      actions,
      payoffs: node.payoffs,
      terminalId: node.id,
    };
  }
}
