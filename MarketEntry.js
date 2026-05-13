/**
 * MarketEntry.js — Вход на рынок (последовательная игра двух фирм).
 *
 * Игрок 1 = Новичок (потенциальный участник). Решает: войти / не входить.
 * Игрок 2 = Инкумбент. Если новичок вошёл, выбирает: уступить / драться.
 *
 * Классические выигрыши (новичок, инкумбент):
 *   • Не вошёл:           (0, 10)  — инкумбент сохраняет монополию
 *   • Вошёл, уступил:     (5,  5)  — дуополия, делят рынок
 *   • Вошёл, дерётся:    (-3,  0)  — ценовая война, оба теряют
 *
 * Без обратной индукции инкумбент мог бы угрожать «драться» и удерживать
 * новичка. Но угроза неправдоподобна: если новичок ВСЁ-ТАКИ вошёл,
 * инкумбенту выгоднее уступить (5 > 0). SPE: новичок входит, инкумбент уступает.
 *
 * Это классический пример «парадокса угрозы» — SPE отбрасывает несостоятельные.
 */

import { DecisionNode, TerminalNode, GameTree } from '../core/GameTree.js';

export function buildMarketEntryConfig(params = {}) {
  // Выигрыши вида [новичок, инкумбент]
  const payoffs = {
    notEnter:    params.notEnter    ?? [0,  10],
    accommodate: params.accommodate ?? [5,   5],
    fight:       params.fight       ?? [-3,  0],
  };

  // Игрок 1 = Новичок
  const root = new DecisionNode('root', 1, ['enter', 'stay-out']);

  root.setChild('stay-out',
    new TerminalNode('r/stay-out', payoffs.notEnter, root, 'stay-out'));

  // Игрок 2 = Инкумбент
  const incumbent = new DecisionNode('r/enter', 2, ['accommodate', 'fight'], root, 'enter');
  root.setChild('enter', incumbent);
  incumbent.setChild('accommodate',
    new TerminalNode('r/enter/A', payoffs.accommodate, incumbent, 'accommodate'));
  incumbent.setChild('fight',
    new TerminalNode('r/enter/F', payoffs.fight, incumbent, 'fight'));

  return new GameTree({
    id: 'market-entry',
    name: 'Вход на рынок',
    players: ['Новичок', 'Инкумбент'],
    root,
    params: payoffs,
    statement: `
      <p>Фирма-новичок решает входить ли на рынок, занятый инкумбентом.</p>
      <p>Если вошла — инкумбент выбирает <em>уступить</em> (дуополия)
      или <em>драться</em> (ценовая война, оба теряют).</p>
      <p>Выигрыши $[\\pi_{\\text{новичок}}, \\pi_{\\text{инкумбент}}]$:
        не вошёл = [${payoffs.notEnter.join(', ')}],
        дуополия = [${payoffs.accommodate.join(', ')}],
        война = [${payoffs.fight.join(', ')}].</p>
      <p>Парадокс: угроза «драться» отбрасывается обратной индукцией как
      несостоятельная — инкумбенту самому невыгодно драться.</p>
    `,
    naiveStrategy: (node) => {
      // Новичок: не рисковать. Инкумбент: жёсткая стратегия «драться».
      if (node.player === 1) return 'stay-out';
      return 'fight';
    },
  });
}

export const MarketEntryParamsSchema = [
  { key: 'notEnter_p2',    label: 'π₂ при невходе (монополия)', type: 'number', min: 0, max: 20, step: 1, default: 10 },
  { key: 'accommodate_p1', label: 'π₁ при дуополии',            type: 'number', min: 0, max: 20, step: 1, default: 5 },
  { key: 'accommodate_p2', label: 'π₂ при дуополии',            type: 'number', min: 0, max: 20, step: 1, default: 5 },
  { key: 'fight_p1',       label: 'π₁ при войне',               type: 'number', min: -10, max: 10, step: 1, default: -3 },
  { key: 'fight_p2',       label: 'π₂ при войне',               type: 'number', min: -10, max: 10, step: 1, default: 0 },
];

export function unpackMarketEntryParams(flat) {
  return {
    notEnter:    [0, flat.notEnter_p2 ?? 10],
    accommodate: [flat.accommodate_p1 ?? 5, flat.accommodate_p2 ?? 5],
    fight:       [flat.fight_p1 ?? -3, flat.fight_p2 ?? 0],
  };
}
