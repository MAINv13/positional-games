/**
 * Ultimatum.js — Ультиматум-игра.
 *
 * Игрок 1 предлагает раздел суммы S: оставить себе x, отдать S−x.
 * Игрок 2 принимает (получает S−x, игрок 1 получает x) или отклоняет (оба 0).
 *
 * Дискретизация: x ∈ {0, S/n, 2S/n, ..., S}.
 *
 * Классический SPE при «рациональном» игроке 2: предлагать минимальное
 * положительное количество, и игрок 2 принимает (любое > 0 лучше нуля).
 *
 * Каркас — функционал есть, но без бота с «справедливостью» (это в roadmap).
 */

import { DecisionNode, TerminalNode, GameTree } from '../core/GameTree.js';

export function buildUltimatumConfig(params = {}) {
  const S = params.S ?? 100;
  const steps = params.steps ?? 10;
  const offers = [];
  for (let i = 0; i <= steps; i++) {
    offers.push(String(Math.round((S * i) / steps)));
  }

  // Корень: игрок 1 выбирает, сколько оставить себе (x).
  const root = new DecisionNode('root', 1, offers);

  for (const offer of offers) {
    const x = Number(offer);
    const give = S - x;
    // Игрок 2 видит предложение и решает: принять/отклонить
    const nodeP2 = new DecisionNode(`r/${offer}`, 2, ['accept', 'reject'], root, offer);
    root.setChild(offer, nodeP2);

    const accept = new TerminalNode(`r/${offer}/A`, [x, give], nodeP2, 'accept');
    const reject = new TerminalNode(`r/${offer}/R`, [0, 0], nodeP2, 'reject');
    nodeP2.setChild('accept', accept);
    nodeP2.setChild('reject', reject);
  }

  return new GameTree({
    id: 'ultimatum',
    name: 'Ультиматум-игра',
    players: ['Игрок 1', 'Игрок 2'],
    root,
    params: { S, steps },
    statement: `
      <p>Игрок 1 предлагает раздел суммы <strong>${S}</strong> руб.</p>
      <p>Игрок 2 принимает или отклоняет; при отказе оба получают 0.</p>
      <p>Дискретизация: ${steps + 1} возможных предложений.</p>
    `,
    naiveStrategy: (node) => {
      // Игрок 1: «честный» раздел поровну. Игрок 2: всегда принимает.
      if (node.player === 1) {
        const half = String(Math.round(S / 2));
        return node.actions.includes(half) ? half : node.actions[Math.floor(node.actions.length / 2)];
      }
      return 'accept';
    },
  });
}

export const UltimatumParamsSchema = [
  { key: 'S', label: 'Размер пирога (S)', type: 'number', min: 10, max: 1000, step: 10, default: 100 },
  { key: 'steps', label: 'Дискретизация (шагов)', type: 'number', min: 2, max: 20, step: 1, default: 10 },
];
