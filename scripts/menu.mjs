// 用途：保留原工具選單的多欄顯示、方向鍵、數字選擇與說明區。
// 用法：由 scripts/tools.mjs 引用。
import { emitKeypressEvents } from 'node:readline';
import { color, toolDetail, menuItems, layoutColumns, columnRows, MENU_LAST, TWO_COLUMNS, THREE_COLUMNS } from './tools.mjs';

function width(value) { return [...value].reduce((sum, char) => sum + (/[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff01-\uff60\uffe0-\uffe6]|\p{Extended_Pictographic}/u.test(char) ? 2 : 1), 0); }
function pad(value, size) { return value + ' '.repeat(Math.max(0, size - width(value))); }
function fit(value, size) {
  if (width(value) <= size) return value;
  let result = '';
  for (const char of value) {
    if (width(result + char) > size - 1) break;
    result += char;
  }
  return result + '…';
}
// 說明依顯示寬度折行：英數字不從中切開、標點不放行首，超過 limit 行時最後一行以 … 截斷。
function wrapParagraph(value, size, limit) {
  const tokens = value.match(/[A-Za-z0-9.#_*\-]+|\s+|./gu) ?? [];
  const lines = [];
  let index = 0;
  while (index < tokens.length && lines.length < limit - 1) {
    let line = '';
    while (index < tokens.length && width(line + tokens[index]) <= size) line += tokens[index++];
    if (index < tokens.length && index && /^[，、。；）」：]/u.test(tokens[index])) line = line.slice(0, -tokens[--index].length);
    lines.push(line.trim());
    while (/^\s+$/u.test(tokens[index] ?? '')) index++;
  }
  if (index < tokens.length) lines.push(fit(tokens.slice(index).join('').trim(), size));
  return lines;
}

function detailRows(value, size, limit) {
  const labelSize = Math.min(10, Math.max(6, size));
  const bodySize = Math.max(1, size - labelSize);
  const rows = [];
  for (const paragraph of value.split('\n')) {
    if (rows.length >= limit) break;
    const match = paragraph.match(/^(HOW|WHAT):\s*(.*)$/u);
    if (!match) {
      rows.push(...wrapParagraph(paragraph, size, limit - rows.length).map(text => pad(text, size)));
      continue;
    }
    const wrapped = wrapParagraph(match[2], bodySize, limit - rows.length);
    for (let index = 0; index < wrapped.length; index++) {
      const label = index === 0 ? color(pad(`  ${match[1]}:`, labelSize), '1;36') : ' '.repeat(labelSize);
      rows.push(label + pad(wrapped[index], bodySize));
    }
  }
  return rows.slice(0, limit);
}

// 說明區固定行數，移動選擇時畫面高度不跳動。
const DETAIL_LINES = 8;

export function menu(selected, columns = process.stdout.columns || 80, dashboardRunning = false) {
  const size = Math.max(1, Math.min(columns >= THREE_COLUMNS ? 180 : 120, columns - 1));
  const label = (number, text, cell = size, indent = '') => {
    const value = fit(`${selected === number ? '›' : ' '} [${number}] ${text}`, cell - width(indent));
    return indent + (selected === number ? color(pad(value, cell - width(indent)), '1;7') : pad(value, cell - width(indent)));
  };
  const row = (value, cell) => value.item
    ? label(value.item[0], value.item[1], cell, '  '.repeat(value.level))
    : color(pad(fit(`${'  '.repeat(value.level + 1)}${value.title}`, cell), cell), value.level ? 36 : '1;36');
  const rule = color('─'.repeat(size), 90);
  const groups = layoutColumns(columns, dashboardRunning);
  const lines = [color(fit('  台股系統開發工具', size), '1;36'), rule, ''];
  if (columns >= TWO_COLUMNS) {
    const cellSize = Math.floor((size - 4 * (groups.length - 1)) / groups.length);
    const rows = groups.map(columnRows);
    for (let index = 0; index < Math.max(...rows.map(values => values.length)); index++) {
      lines.push(rows.map(values => values[index] ? row(values[index], cellSize) : ' '.repeat(cellSize)).join('    ').trimEnd());
    }
    lines.push('');
  } else {
    for (const group of groups) {
      for (const value of columnRows(group)) lines.push(row(value, size));
      lines.push('');
    }
  }
  lines.push(label(0, '離開'), '', rule);
  const item = menuItems(dashboardRunning).find(([number]) => number === selected);
  const [title, detail] = item ? [item[1], item[2]] : ['離開', toolDetail('關閉開發工具選單，回到終端機。', '不執行工具、不修改檔案，也不停止已在執行的外部程序。')];
  const detailLines = detailRows(detail, size, DETAIL_LINES);
  lines.push(color(fit(`  ${title}`, size), '1;36'));
  for (let line = 0; line < DETAIL_LINES; line++) lines.push(detailLines[line] ?? ' '.repeat(size));
  lines.push(rule);
  const hints = columns >= TWO_COLUMNS ? [`  ↑↓←→ 移動 · 輸入 0–${MENU_LAST} + Enter 執行 · Ctrl+C 離開`] : ['  ↑↓ 移動 · Enter 執行', `  輸入 0–${MENU_LAST} + Enter 執行 · Ctrl+C 離開`];
  lines.push(...hints.map(value => color(fit(value, size), 90)));
  return lines.join('\n');
}

// 寬版上下在同一欄移動、超出欄頭尾接到「離開」，左右換到相鄰欄畫面行最接近的項目；窄版依畫面順序循環。
export function moveSelection(selected, direction, columns = 80) {
  const layout = layoutColumns(columns).map(group => columnRows(group).map((value, line) => ({ number: value.item?.[0], line })).filter(value => value.number !== undefined));
  if (columns < TWO_COLUMNS) {
    const numbers = layout.flat().map(value => value.number).concat(0);
    if (direction === 'left' || direction === 'right') return selected;
    return numbers[(numbers.indexOf(selected) + (direction === 'up' ? -1 : 1) + numbers.length) % numbers.length];
  }
  if (selected === 0) {
    if (direction === 'left' || direction === 'right') return 0;
    return layout[0][direction === 'up' ? layout[0].length - 1 : 0].number;
  }
  const column = layout.findIndex(values => values.some(value => value.number === selected));
  const index = layout[column].findIndex(value => value.number === selected);
  if (direction === 'up' || direction === 'down') return layout[column][index + (direction === 'up' ? -1 : 1)]?.number ?? 0;
  const target = layout[column + (direction === 'left' ? -1 : 1)];
  if (!target) return selected;
  const { line } = layout[column][index];
  return target.reduce((best, value) => Math.abs(value.line - line) < Math.abs(best.line - line) ? value : best).number;
}

export function selectMenu(dashboardRunning = false) {
  return new Promise(resolve => {
    let selected = 1;
    let shortcut = '';
    const input = process.stdin;
    const wasRaw = input.isRaw;
    const draw = () => {
      process.stdout.write('\x1b[H' + menu(selected, process.stdout.columns || 80, dashboardRunning).split('\n').map(line => line + '\x1b[K').join('\n') + '\x1b[J');
    };
    const finish = value => {
      input.off('keypress', onKey);
      process.stdout.off('resize', draw);
      input.setRawMode(Boolean(wasRaw));
      input.pause();
      process.stdout.write('\x1b[?25h\x1b[?1049l');
      resolve(value);
    };
    const onKey = (text, key = {}) => {
      if (key.ctrl && key.name === 'c') finish('0');
      else if (/^[0-9]$/.test(text ?? '')) {
        const candidate = `${shortcut}${text}`;
        if (Number(candidate) <= MENU_LAST && String(Number(candidate)) === candidate) {
          shortcut = candidate;
          selected = Number(candidate);
          draw();
        }
      } else if (key.name === 'return') finish(String(selected));
      else if (['up', 'down', 'left', 'right'].includes(key.name)) {
        shortcut = '';
        selected = moveSelection(selected, key.name, process.stdout.columns || 80);
        draw();
      }
    };
    emitKeypressEvents(input);
    input.setRawMode(true);
    input.on('keypress', onKey);
    process.stdout.on('resize', draw);
    input.resume();
    process.stdout.write('\x1b[?1049h\x1b[?25l');
    draw();
  });
}

