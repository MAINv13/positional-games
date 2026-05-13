/**
 * Centipede.js — Игра «Сороконожка» (Розенталь, 1981).
 *
 * На столе пара долей. Игрок 1 ходит на нечётных шагах, игрок 2 — на чётных.
 * На своём ходу:
 *   • Take — забирает БОЛЬШУЮ долю, оппонент получает меньшую, конец.
 *   • Pass — обе доли удваиваются, ход переходит сопернику.
 * Если за n ходов никто не взял — финальный делёж как при Take последнего игрока.
 *
 * SPE: брать на первом ходу. Эмпирически — игроки часто передают (парадокс).
 */

import { DecisionNode, TerminalNode, GameTree } from '../core/GameTree.js';

export function buildCentipedeConfig(params = {}) {
  const n = params.n ?? 6;
  const a0 = params.a0 ?? 4;
  const b0 = params.b0 ?? 1;
  const growth = params.growth ?? 2;

  // Игрок берёт «свою» (большую) долю a, оппонент — b.
  function takePayoffs(player, a, b) {
    return player === 1 ? [a, b] : [b, a];
  }

  function build(k, a, b, parent, edge) {
    const player = (k % 2 === 1) ? 1 : 2;
    const id = parent ? `${parent.id}/${edge}` : 'root';

    if (k > n) {
      const lastPlayer = (n % 2 === 1) ? 1 : 2;
      return new TerminalNode(id, takePayoffs(lastPlayer, a, b), parent, edge);
    }

    const node = new DecisionNode(id, player, ['take', 'pass'], parent, edge);

    node.setChild('take',
      new TerminalNode(`${id}/take`, takePayoffs(player, a, b), node, 'take'));

    node.setChild('pass',
      build(k + 1, a * growth, b * growth, node, 'pass'));

    return node;
  }

  const root = build(1, a0, b0, null, null);

  return new GameTree({
    id: 'centipede',
    name: 'Сороконожка',
    players: ['Игрок 1', 'Игрок 2'],
    root,
    params: { n, a0, b0, growth },
    statement: `
      <p>Двое игроков по очереди решают: <strong>взять</strong> большую часть
      приза или <strong>передать</strong>, удвоив приз.</p>
      <p>Параметры: $n=${n}$ ходов, стартовые доли $(a_0,b_0)=(${a0},${b0})$,
      множитель роста $\\times${growth}$.</p>
      <p>SPE: «брать на первом ходу». В экспериментах люди часто передают —
      это <em>парадокс сороконожки</em>.</p>
    `,
    naiveStrategy: () => 'pass',
  });
}

export const CentipedeParamsSchema = [
  { key: 'n',  label: 'Число ходов', type: 'number', min: 2, max: 10, step: 1, default: 6 },
  { key: 'a0', label: 'Стартовая большая доля', type: 'number', min: 2, max: 10, step: 1, default: 4 },
  { key: 'b0', label: 'Стартовая малая доля',  type: 'number', min: 0, max: 5,  step: 1, default: 1 },
];
