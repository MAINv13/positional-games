/**
 * IPOAuction.js — Аукцион заявок при IPO.
 *
 * Постановка (с учётом правок преподавателя 30.03.2026):
 *   • 3 фонда (А, Б, В) последовательно подают заявки.
 *   • Объём: 1000 акций. Каждый фонд претендует на весь объём.
 *   • Диапазон цены: [90; 110] руб. Дискретизация: {90, 100, 110}.
 *   • Приватные оценки v_i — параметры конфигурации (по умолчанию
 *     числовой пример из ТЗ: v_A=95, v_B=105, v_C=100).
 *   • Опция «гринщуэйловская переподписка» ИСКЛЮЧЕНА (по переписке).
 *   • Победитель аукциона — фонд с наибольшей заявкой; при равенстве
 *     лидеров акции делятся поровну (пропорционально количеству победителей).
 *   • Выигрыш получившего долю q при цене p: q · (v_i − p).
 *   • Не получил акций → выигрыш 0 (это же определение «отказа»).
 *
 * Важно: в дискретном варианте {90,100,110} стратегия фонда А — это просто
 * число из набора; стратегия Б — функция от b_A (3^3=27 вариантов);
 * стратегия В — функция от пары (b_A,b_B) (3^9=19683 вариантов).
 * Обратная индукция работает с точечными решениями в каждом узле,
 * не перебирая всё пространство стратегий.
 */

import { DecisionNode, TerminalNode, GameTree } from '../core/GameTree.js';

const TOTAL_SHARES = 1000;

/**
 * Считает выигрыши при заявках (bA, bB, bC) и оценках (vA, vB, vC).
 * Возвращает массив [pA, pB, pC].
 */
function computePayoffs(bids, valuations) {
  const numeric = bids.map(Number);
  const maxBid = Math.max(...numeric);
  // Все, кто поставил max, делят акции пополам/поровну
  const winners = numeric
    .map((b, i) => b === maxBid ? i : -1)
    .filter(i => i >= 0);
  const sharePerWinner = TOTAL_SHARES / winners.length;
  const price = maxBid;

  const payoffs = [0, 0, 0];
  for (const idx of winners) {
    payoffs[idx] = sharePerWinner * (valuations[idx] - price);
  }
  return payoffs;
}

/**
 * Билдер дерева для трёх последовательных ходов A → B → C
 * с одинаковым набором действий ACTIONS.
 */
function buildTree(actions, valuations) {
  const root = new DecisionNode('root', /*player=*/1, actions);

  for (const a of actions) {
    const nodeB = new DecisionNode(`r/${a}`, /*player=*/2, actions, root, a);
    root.setChild(a, nodeB);

    for (const b of actions) {
      const nodeC = new DecisionNode(`r/${a}/${b}`, /*player=*/3, actions, nodeB, b);
      nodeB.setChild(b, nodeC);

      for (const c of actions) {
        const payoffs = computePayoffs([a, b, c], valuations);
        const term = new TerminalNode(`r/${a}/${b}/${c}`, payoffs, nodeC, c);
        nodeC.setChild(c, term);
      }
    }
  }

  return root;
}

/**
 * Наивная стратегия «оценка минус 5» (из задания, шаг 5).
 * Округляем до ближайшего из набора {90,100,110}.
 */
function makeNaiveStrategy(actions, valuations) {
  const numericActions = actions.map(Number);
  return (node, history) => {
    const playerIdx = node.player - 1;
    const target = valuations[playerIdx] - 5;
    // ближайшее допустимое действие
    let best = actions[0], bestDist = Infinity;
    for (let i = 0; i < numericActions.length; i++) {
      const d = Math.abs(numericActions[i] - target);
      if (d < bestDist) { bestDist = d; best = actions[i]; }
    }
    return best;
  };
}

/**
 * Постановка задачи. Динамическая — показывает текущий набор действий
 * и режим информации.
 */
function buildStatement(actions, valuations, infoMode = 'full') {
  const gridStr = actions.length <= 5
    ? '\\{' + actions.join(', ') + '\\}'
    : `\\{${actions[0]}, ${actions[1]}, \\ldots, ${actions.at(-1)}\\}`;

  const infoBlock = infoMode === 'private'
    ? `<p><strong>Информация — приватная.</strong> Каждый фонд знает только свою
       оценку; об оценках соперников знает лишь распределение
       $v_j \\sim \\mathrm{Uniform}[90, 110]$. Решается как байесовская игра
       (BNE) численно: стратегии становятся <em>функциями</em> $b_i(v_i, \\text{история})$.
       Дерево ниже показывает версию с фиксированными оценками для наглядности
       (классический SPE), а в правой панели — функции ставок и ожидаемые
       выигрыши для приватного варианта.</p>`
    : `<p><strong>Информация — полная.</strong> Оценки $v_i$ известны всем
       игрокам (классический SPE через обратную индукцию).</p>`;

  return `
<p><strong>Контекст.</strong> Компания «ТехПром» проводит IPO, выпуская 1 000 акций.
Банк-организатор установил индикативный диапазон цены: 90–110 руб.</p>

<p><strong>Игроки.</strong> Три фонда — А, Б, В — подают заявки <em>последовательно</em>
в алфавитном порядке. Каждый следующий фонд видит заявки предыдущих.</p>

<p><strong>Приватные оценки:</strong>
$v_A = ${valuations[0]},\\ v_B = ${valuations[1]},\\ v_C = ${valuations[2]}$ руб.</p>

${infoBlock}

<p><strong>Действия.</strong> Заявка $b_i \\in ${gridStr}$
(всего ${actions.length} ${actions.length === 1 ? 'значение' : actions.length < 5 ? 'значения' : 'значений'}).</p>

<p><strong>Распределение акций.</strong> Победитель — заявивший max; при равенстве
лидеры делят акции поровну. <strong>Выигрыш</strong> при доле $q$ и цене $p$:
$\\pi_i = q \\cdot (v_i - p)$. Не получил акций → $\\pi_i = 0$.</p>
`;
}

/**
 * Генерирует равномерную сетку заявок на [90, 110] из `steps` значений.
 * Возвращает массив строк (для использования как меток рёбер в дереве).
 * Округляем до 1 знака после запятой, чтобы метки оставались читаемыми.
 *
 * steps=3  → ['90', '100', '110']         (дискретный случай ТЗ)
 * steps=5  → ['90', '95', '100', '105', '110']
 * steps=11 → ['90', '92', '94', ..., '110']  (шаг 2)
 */
function makePriceGrid(steps) {
  const grid = [];
  const lo = 90, hi = 110;
  for (let i = 0; i < steps; i++) {
    const v = lo + (hi - lo) * i / (steps - 1);
    // Формат: целые без точки, дробные с одним знаком
    const s = Number.isInteger(v) ? String(v) : v.toFixed(1);
    grid.push(s);
  }
  return grid;
}

/**
 * Билдер конфигурации IPO. defaults — параметры из ТЗ.
 *
 * params:
 *   vA, vB, vC — приватные оценки фондов
 *   steps      — число точек дискретизации цены (3..11)
 */
export function buildIPOConfig(params = {}) {
  const valuations = [
    params.vA ?? 95,
    params.vB ?? 105,
    params.vC ?? 100,
  ];
  const steps = Math.max(2, Math.min(11, params.steps ?? 3));
  const actions = makePriceGrid(steps);
  // Режим информации: 'full' — оценки общеизвестны (классическая обратная индукция),
  // 'private' — приватные оценки, расчёт через BayesianSolver.
  // В дереве игры мы всегда строим версию с конкретными оценками (full info),
  // а для приватного режима солвер вызывается отдельно из main.js.
  const infoMode = params.infoMode ?? 'full';

  const root = buildTree(actions, valuations);

  return new GameTree({
    id: 'ipo',
    name: 'Аукцион заявок при IPO',
    players: ['Фонд А', 'Фонд Б', 'Фонд В'],
    root,
    params: { vA: valuations[0], vB: valuations[1], vC: valuations[2], steps, infoMode },
    statement: buildStatement(actions, valuations, infoMode),
    naiveStrategy: makeNaiveStrategy(actions, valuations),
    // Метаданные для байесовского режима — сетка ставок передаётся как массив чисел
    bayesianConfig: infoMode === 'private' ? {
      bidGrid: actions.map(Number),
      vMin: 90,
      vMax: 110,
      valSteps: 11,
    } : null,
  });
}

/**
 * Описание UI-параметров для левой панели — отрисовывается Controls.
 *
 * Ползунок steps: 3 — классический дискретный случай {90,100,110} из ТЗ,
 * 5–7 — промежуточные сетки, 9–11 — приближение к непрерывному случаю
 * (b ∈ [90,110]) согласно правке преподавателя.
 *
 * Верхний предел 11 поставлен для производительности: при steps=k дерево
 * имеет k^3 терминалов и k+k^2 узлов решения; k=11 даёт ~1331 терминал,
 * это ещё разумно для рендера на SVG и пошаговой анимации.
 */
export const IPOParamsSchema = [
  { key: 'vA',    label: 'Оценка фонда А (v_A)',           type: 'number', min: 90, max: 110, step: 1, default: 95 },
  { key: 'vB',    label: 'Оценка фонда Б (v_B)',           type: 'number', min: 90, max: 110, step: 1, default: 105 },
  { key: 'vC',    label: 'Оценка фонда В (v_C)',           type: 'number', min: 90, max: 110, step: 1, default: 100 },
  { key: 'steps', label: 'Шагов цены (дискретизация)',     type: 'number', min: 3,  max: 11,  step: 2, default: 3 },
  {
    key: 'infoMode',
    label: 'Информация об оценках',
    type: 'select',
    default: 'full',
    options: [
      { value: 'full',    label: 'Полная — оценки общеизвестны (классический SPE)' },
      { value: 'private', label: 'Приватная — v_i ∼ U[90,110] (байесовский BNE)' },
    ],
  },
];
