/**
 * BayesianSolver.js — Поиск байесовского совершенного равновесия (BNE)
 * для IPO-аукциона с приватными оценками.
 *
 * Постановка:
 *   • Каждый фонд знает свою оценку v_i, но не оценки соперников.
 *   • Априори v_i ∼ U[vMin, vMax] независимо.
 *   • Множество допустимых ставок — дискретная сетка bidGrid.
 *
 * Стратегия — это функция b_i(v_i, история наблюдаемых ставок).
 * Для дискретизации оценок (сетка valGrid) стратегия задаётся таблицей.
 *
 * Алгоритм (обратная индукция в смешанном виде):
 *   Игрок В:
 *     для каждой возможной пары (b_A, b_B):
 *       для каждого v_C из valGrid:
 *         перебрать b_C из bidGrid, посчитать выигрыш В,
 *         выбрать максимум → b_C*(v_C | b_A, b_B)
 *   Игрок Б:
 *     для каждого b_A:
 *       для каждого v_B из valGrid:
 *         для каждого b_B из bidGrid:
 *           ожидаемый выигрыш = (1/|valGrid|) * Σ_{v_C}
 *             выигрыш Б при (b_A, b_B, b_C*(v_C | b_A, b_B))
 *           // оценка v_C неизвестна Б, усредняем равномерно
 *         выбрать b_B с максимальным ожиданием → b_B*(v_B | b_A)
 *   Игрок А:
 *     для каждого v_A из valGrid:
 *       для каждого b_A из bidGrid:
 *         ожидаемый выигрыш = (1/|valGrid|²) * Σ_{v_B, v_C}
 *           выигрыш А при (b_A, b_B*(v_B | b_A), b_C*(v_C | b_A, b_B*))
 *       выбрать b_A с максимальным ожиданием → b_A*(v_A)
 *
 * Сложность: O(|bidGrid|³ · |valGrid|³). Для bidGrid=5, valGrid=11
 * это 5³·11³ ≈ 166 тыс. операций — мгновенно.
 *
 * Возвращаемый результат:
 *   {
 *     bidGrid, valGrid,
 *     stratC: Map "bA|bB" → array (по valGrid) bC,
 *     stratB: Map "bA"    → array (по valGrid) bB,
 *     stratA:                     array (по valGrid) bA,
 *     expectedPayoffs: [πA, πB, πC]   — априорные ожидаемые выигрыши
 *   }
 */

const TOTAL_SHARES = 1000;

/**
 * Аллокация акций при ставках [bA, bB, bC] и оценках [vA, vB, vC].
 * Возвращает [πA, πB, πC] — те же правила, что и в обычном IPO.
 */
function payoffs(bids, vals) {
  const maxBid = Math.max(...bids);
  const winners = [];
  for (let i = 0; i < 3; i++) if (bids[i] === maxBid) winners.push(i);
  const share = TOTAL_SHARES / winners.length;
  const out = [0, 0, 0];
  for (const i of winners) out[i] = share * (vals[i] - maxBid);
  return out;
}

/**
 * Главный солвер. Принимает параметры:
 *   bidGrid — массив чисел, сетка возможных ставок
 *   vMin, vMax — границы интервала оценок (равномерное распределение)
 *   valSteps — число точек дискретизации оценок (для расчёта стратегий)
 */
export function solveBayesianIPO({ bidGrid, vMin = 90, vMax = 110, valSteps = 11 }) {
  // Сетка оценок
  const valGrid = [];
  for (let i = 0; i < valSteps; i++) {
    valGrid.push(vMin + (vMax - vMin) * i / (valSteps - 1));
  }

  // --- Шаг 1: стратегия В ---
  // stratC: для каждой пары (bA, bB) и каждого индекса оценки v_C
  //         даёт оптимальную ставку b_C.
  const stratC = new Map();
  for (const bA of bidGrid) {
    for (const bB of bidGrid) {
      const key = `${bA}|${bB}`;
      const arr = [];
      for (const vC of valGrid) {
        let bestB = bidGrid[0], bestPi = -Infinity;
        for (const bC of bidGrid) {
          // Оценки соперников В не нужны — выигрыш В зависит только от ставок и v_C
          const pi = payoffs([bA, bB, bC], [0, 0, vC])[2];
          if (pi > bestPi + 1e-9) { bestPi = pi; bestB = bC; }
        }
        arr.push(bestB);
      }
      stratC.set(key, arr);
    }
  }

  // --- Шаг 2: стратегия Б ---
  // stratB: для каждого bA и индекса оценки v_B даёт оптимальную ставку b_B.
  // Б усредняет по v_C ∼ uniform(valGrid), используя stratC.
  const stratB = new Map();
  for (const bA of bidGrid) {
    const arr = [];
    for (const vB of valGrid) {
      let bestB = bidGrid[0], bestPi = -Infinity;
      for (const bB of bidGrid) {
        // Ожидаемый выигрыш Б при (bA, bB), усреднение по v_C
        const stratC_at = stratC.get(`${bA}|${bB}`);
        let sum = 0;
        for (let j = 0; j < valGrid.length; j++) {
          const bC = stratC_at[j];
          sum += payoffs([bA, bB, bC], [0, vB, 0])[1];
        }
        const exp = sum / valGrid.length;
        if (exp > bestPi + 1e-9) { bestPi = exp; bestB = bB; }
      }
      arr.push(bestB);
    }
    stratB.set(`${bA}`, arr);
  }

  // --- Шаг 3: стратегия А ---
  // Для каждого v_A находим оптимальную b_A, усредняя по (v_B, v_C).
  const stratA = [];
  for (const vA of valGrid) {
    let bestB = bidGrid[0], bestPi = -Infinity;
    for (const bA of bidGrid) {
      // Ожидаемый выигрыш А, усреднение по v_B и v_C
      const stratB_at = stratB.get(`${bA}`);
      let sum = 0;
      for (let i = 0; i < valGrid.length; i++) {
        const vB = valGrid[i];
        const bB = stratB_at[i];
        const stratC_at = stratC.get(`${bA}|${bB}`);
        for (let j = 0; j < valGrid.length; j++) {
          const bC = stratC_at[j];
          sum += payoffs([bA, bB, bC], [vA, 0, 0])[0];
        }
      }
      const exp = sum / (valGrid.length * valGrid.length);
      if (exp > bestPi + 1e-9) { bestPi = exp; bestB = bA; }
    }
    stratA.push(bestB);
  }

  // --- Расчёт априорных ожидаемых выигрышей всех игроков ---
  // Прогон по всем тройкам (vA, vB, vC) с равномерным весом
  let sumA = 0, sumB = 0, sumC = 0;
  const N = valGrid.length;
  for (let i = 0; i < N; i++) {
    const vA = valGrid[i];
    const bA = stratA[i];
    const stratB_at = stratB.get(`${bA}`);
    for (let j = 0; j < N; j++) {
      const vB = valGrid[j];
      const bB = stratB_at[j];
      const stratC_at = stratC.get(`${bA}|${bB}`);
      for (let k = 0; k < N; k++) {
        const vC = valGrid[k];
        const bC = stratC_at[k];
        const p = payoffs([bA, bB, bC], [vA, vB, vC]);
        sumA += p[0]; sumB += p[1]; sumC += p[2];
      }
    }
  }
  const total = N * N * N;
  const expectedPayoffs = [sumA / total, sumB / total, sumC / total];

  return { bidGrid, valGrid, stratC, stratB, stratA, expectedPayoffs };
}

/**
 * Сравнение с наивной стратегией «оценка минус 5» — на тех же оценках.
 * Возвращает [πA, πB, πC] — ожидаемые выигрыши.
 */
export function naiveExpectedPayoffs({ bidGrid, vMin = 90, vMax = 110, valSteps = 11 }) {
  const valGrid = [];
  for (let i = 0; i < valSteps; i++) {
    valGrid.push(vMin + (vMax - vMin) * i / (valSteps - 1));
  }
  // Округление цели до ближайшей ставки в сетке
  const naive = (v) => {
    const target = v - 5;
    let best = bidGrid[0], dist = Infinity;
    for (const b of bidGrid) {
      const d = Math.abs(b - target);
      if (d < dist) { dist = d; best = b; }
    }
    return best;
  };

  let sumA = 0, sumB = 0, sumC = 0;
  const N = valGrid.length;
  for (const vA of valGrid) {
    for (const vB of valGrid) {
      for (const vC of valGrid) {
        const bids = [naive(vA), naive(vB), naive(vC)];
        const p = payoffs(bids, [vA, vB, vC]);
        sumA += p[0]; sumB += p[1]; sumC += p[2];
      }
    }
  }
  const total = N * N * N;
  return [sumA / total, sumB / total, sumC / total];
}
