/**
 * Controls.js — Динамическая генерация UI-контролов для параметров игры.
 *
 * Принимает на вход schema (массив описаний параметров) и контейнер.
 * Создаёт label + input для каждого параметра. Собирает значения через
 * метод getValues().
 */

export class ParamControls {
  constructor(container) {
    this.container = container;
    this.schema = [];
    this.inputs = new Map();
    this.onChange = null;
  }

  render(schema) {
    this.schema = schema;
    this.container.innerHTML = '';
    this.inputs.clear();

    for (const item of schema) {
      const label = document.createElement('label');
      label.className = 'control-label';
      label.textContent = item.label;
      this.container.appendChild(label);

      let input;
      if (item.type === 'select') {
        // Выпадающий список — для категориальных параметров
        // (например, режим информации: full / private)
        input = document.createElement('select');
        input.className = 'control-select';
        for (const opt of item.options) {
          const o = document.createElement('option');
          o.value = opt.value;
          o.textContent = opt.label;
          if (opt.value === item.default) o.selected = true;
          input.appendChild(o);
        }
        input.addEventListener('change', () => {
          if (this.onChange) this.onChange(this.getValues());
        });
        this.container.appendChild(input);
      } else if (item.type === 'number' && item.min !== undefined && item.max !== undefined) {
        // Числовой ползунок + value
        const row = document.createElement('div');
        row.className = 'range-row';
        input = document.createElement('input');
        input.type = 'range';
        input.min = item.min;
        input.max = item.max;
        input.step = item.step ?? 1;
        input.value = item.default;
        const valSpan = document.createElement('span');
        valSpan.className = 'range-value';
        valSpan.textContent = this._fmt(item.default);
        input.addEventListener('input', () => {
          valSpan.textContent = this._fmt(input.value);
          if (this.onChange) this.onChange(this.getValues());
        });
        row.appendChild(input);
        row.appendChild(valSpan);
        this.container.appendChild(row);
      } else {
        input = document.createElement('input');
        input.type = item.type ?? 'text';
        input.className = 'control-input';
        input.value = item.default;
        if (item.step !== undefined) input.step = item.step;
        input.addEventListener('input', () => {
          if (this.onChange) this.onChange(this.getValues());
        });
        this.container.appendChild(input);
      }

      this.inputs.set(item.key, input);
    }
  }

  getValues() {
    const result = {};
    for (const item of this.schema) {
      const input = this.inputs.get(item.key);
      let v = input.value;
      // Только числовые входы преобразуем в Number; select оставляем как строку
      if (item.type === 'number') v = Number(v);
      result[item.key] = v;
    }
    return result;
  }

  _fmt(v) {
    const n = Number(v);
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(2).replace(/\.?0+$/, '');
  }
}
