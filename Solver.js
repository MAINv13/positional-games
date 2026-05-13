/**
 * Solver.js — Метод обратной индукции для поиска SPE.
 *
 * Алгоритм (backward induction):
 *   1. Для каждого терминального узла value = payoffs.
 *   2. Для каждого DecisionNode (от листьев к корню):
 *      перебрать все действия, у каждого ребёнка взять value,
 *      выбрать действие, максимизирующее value[player]
 *      (player — это тот, кто ходит в этом узле; 1-индексация → -1).
 *      Записать optimalAction и value = value(лучшего ребёнка).
 *   3. После этого markEquilibriumPath даёт равновесный путь.
 *
 * При ничьей (несколько действий дают один и тот же payoff игроку)
 * выбирается лексикографически меньшее — это даёт детерминированность.
 * При желании можно расширить до полного набора SPE (множество).
 *
 * Solver поддерживает два режима:
 *   - solve(tree) — полное решение за один вызов.
 *   - createStepper(tree) — итератор для пошаговой визуализации:
 *     каждый next() обрабатывает один узел и возвращает событие
 *     { node, action, value } для UI.
 */

export class Solver {
  /**
   * Полное решение дерева. Возвращает результат с равновесным путём.
   */
  static solve(tree) {
    Solver._solveNode(tree.root, tree.N);
    const path = tree.markEquilibriumPath();
    return {
      equilibriumPath: path,
      rootValue: tree.root.value,
    };
  }

  /**
   * Рекурсивная обратная индукция: возвращает value текущего узла.
   * Side-effect: проставляет optimalAction и value в дереве.
   */
  static _solveNode(node, N) {
    if (node.isTerminal()) {
      node.value = node.payoffs.slice();
      return node.value;
    }

    // DecisionNode: сначала спустимся в детей
    const playerIdx = node.player - 1;
    let bestAction = null;
    let bestValue = null;
    let bestPayoffForPlayer = -Infinity;

    for (const action of node.actions) {
      const child = node.getChild(action);
      const childValue = Solver._solveNode(child, N);
      const myPayoff = childValue[playerIdx];

      if (myPayoff > bestPayoffForPlayer + 1e-9) {
        // Строго лучше — обновляем
        bestPayoffForPlayer = myPayoff;
        bestAction = action;
        bestValue = childValue;
      }
      // При равенстве сохраняем первое найденное (лексикографический выбор)
    }

    node.optimalAction = bestAction;
    node.value = bestValue.slice();
    return node.value;
  }

  /**
   * Создаёт пошаговый итератор. Порядок обхода — post-order
   * (от листьев к корню), что соответствует обратной индукции.
   *
   * @returns {{ next: () => { done, event } }}
   */
  static createStepper(tree) {
    // Соберём узлы в post-order
    const order = [];
    const visit = (node) => {
      if (node.isDecision()) {
        for (const child of node.children.values()) visit(child);
      }
      order.push(node);
    };
    visit(tree.root);

    let i = 0;
    return {
      reset() { i = 0; },
      hasNext() { return i < order.length; },
      next() {
        if (i >= order.length) return { done: true };
        const node = order[i++];
        if (node.isTerminal()) {
          node.value = node.payoffs.slice();
          return {
            done: false,
            event: {
              type: 'terminal',
              node,
              value: node.value,
            }
          };
        } else {
          // Уже все дети решены к этому моменту
          const playerIdx = node.player - 1;
          let bestAction = null, bestValue = null, bestPayoff = -Infinity;
          for (const action of node.actions) {
            const child = node.getChild(action);
            const myPayoff = child.value[playerIdx];
            if (myPayoff > bestPayoff + 1e-9) {
              bestPayoff = myPayoff;
              bestAction = action;
              bestValue = child.value;
            }
          }
          node.optimalAction = bestAction;
          node.value = bestValue.slice();
          return {
            done: false,
            event: {
              type: 'decision',
              node,
              action: bestAction,
              value: node.value,
            }
          };
        }
      },
      isLast() {
        return i === order.length;
      }
    };
  }

  /**
   * Прогоняет дерево по заданной стратегии (например, наивной)
   * и возвращает итоговые payoffs. Стратегия — функция
   * (node, history) => action.
   */
  static simulate(tree, strategy) {
    const history = [];
    let node = tree.root;
    while (node.isDecision()) {
      const action = strategy(node, history);
      history.push({ player: node.player, action, nodeId: node.id });
      node = node.getChild(action);
      if (!node) {
        throw new Error(`Стратегия вернула недопустимое действие в узле ${history.at(-1).nodeId}`);
      }
    }
    return { history, payoffs: node.payoffs, terminalId: node.id };
  }
}
