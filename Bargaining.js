/**
 * Bargaining.js — Переговоры о разделе пирога (упрощённая модель Рубинштейна).
 *
 * Имеется пирог размера 1. В раунде t текущий предлагатель называет долю
 * x ∈ {0, 0.1, ..., 1.0} себе. Оппонент принимает или отклоняет.
 * При отказе пирог дисконтируется (умножается на δ < 1), ход переходит
 * к оппоненту. Всего T раундов; если ни в одном не договорились — оба 0.
 *
 * Параметры: T (число раундов), delta (дисконт-фактор), steps (дискретизация).
 *
 * Каркас — простая трёхраундовая версия.
 */

import { DecisionNode, TerminalNode, GameTree } from '../core/GameTree.js';

export function buildBargainingConfig(params = {}) {
  const T = params.T ?? 3;
  const delta = params.delta ?? 0.9;
  const steps = params.steps ?? 5;

  const offers = [];
  for (let i = 0; i <= steps; i++) offers.push((i / steps).toFixed(2));

  /**
   * round: текущий раунд (1..T), proposer: кто предлагает (1 или 2),
   * pieSize: текущий размер пирога после дисконтирования.
   */
  function build(round, proposer, pieSize, parent, edge) {
    const responder = proposer === 1 ? 2 : 1;
    const id = parent ? `${parent.id}/${edge}` : 'root';
    const node = new DecisionNode(id, proposer, offers, parent, edge);

    for (const offer of offers) {
      const x = Number(offer);
      const proposerShare = x * pieSize;
      const responderShare = (1 - x) * pieSize;

      const respId = `${id}/x=${offer}`;
      const respNode = new DecisionNode(respId, responder, ['accept', 'reject'], node, offer);
      node.setChild(offer, respNode);

      // accept: разделили
      const acceptPayoffs = [0, 0];
      acceptPayoffs[proposer - 1] = proposerShare;
      acceptPayoffs[responder - 1] = responderShare;
      respNode.setChild('accept',
        new TerminalNode(`${respId}/A`, acceptPayoffs, respNode, 'accept'));

      // reject: следующий раунд, либо терминал с (0,0) если T исчерпан
      if (round === T) {
        respNode.setChild('reject',
          new TerminalNode(`${respId}/R`, [0, 0], respNode, 'reject'));
      } else {
        const nextNode = build(round + 1, responder, pieSize * delta, respNode, 'reject');
        respNode.setChild('reject', nextNode);
      }
    }
    return node;
  }

  const root = build(1, 1, 1.0, null, null);

  return new GameTree({
    id: 'bargaining',
    name: 'Переговоры о разделе пирога',
    players: ['Игрок 1', 'Игрок 2'],
    root,
    params: { T, delta, steps },
    statement: `
      <p>Двое делят пирог за $T=${T}$ раундов с дисконт-фактором $\\delta=${delta}$.</p>
      <p>В каждом раунде предлагатель называет долю себе $x \\in [0,1]$.
      Оппонент принимает (раздел зафиксирован) или отклоняет (пирог $\\times\\delta$,
      ход переходит).</p>
    `,
    naiveStrategy: (node) => {
      if (node.actions.includes('0.50')) return '0.50';
      return node.actions.includes('accept') ? 'accept' : node.actions[0];
    },
  });
}

export const BargainingParamsSchema = [
  { key: 'T', label: 'Число раундов', type: 'number', min: 1, max: 4, step: 1, default: 3 },
  { key: 'delta', label: 'Дисконт-фактор (δ)', type: 'number', min: 0.5, max: 0.99, step: 0.05, default: 0.9 },
  { key: 'steps', label: 'Дискретизация (шагов)', type: 'number', min: 2, max: 8, step: 1, default: 5 },
];
