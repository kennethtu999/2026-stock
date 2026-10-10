// 用途：從本機清理封存恢復共用工具入口、ICA 工具與選單顯示機制；不恢復 GIB 功能。
// 用法：node scripts/ai/restore-tools.mjs（一次性；已存在的檔案不覆寫）
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDotEnv } from './lib/env.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const archive = resolve(root, 'logs/inherited-project-v1');
if (!existsSync(resolve(root, '.env'))) {
  const previous = readDotEnv(archive);
  const template = readFileSync(resolve(root, '.env.example'), 'utf8');
  const restored = template.replace(/^([A-Z0-9_]+)=(.*)$/gm, (line, key) =>
    Object.hasOwn(previous, key) ? `${key}=${previous[key]}` : line);
  writeFileSync(resolve(root, '.env'), restored, { mode: 0o600 });
}
for (const name of ['scripts/tool.sh', 'scripts/ai/setup-ica.mjs', 'scripts/ai/setup-model-picker.mjs']) {
  const target = resolve(root, name);
  mkdirSync(dirname(target), { recursive: true });
  if (!existsSync(target)) copyFileSync(resolve(archive, name), target);
}
const target = resolve(root, 'scripts/menu.mjs');
if (!existsSync(target)) {
  const original = readFileSync(resolve(archive, 'scripts/tools.mjs'), 'utf8');
  const rendering = original.slice(original.indexOf('function width(value)'), original.indexOf('async function checkout(ask)'))
    .replace('  GIB 開發工具', '  台股系統開發工具').replace('function selectMenu(', 'export function selectMenu(');
  writeFileSync(target, `// 用途：保留原工具選單的多欄顯示、方向鍵、數字選擇與說明區。\n// 用法：由 scripts/tools.mjs 引用。\nimport { emitKeypressEvents } from 'node:readline';\nimport { color, toolDetail, menuItems, layoutColumns, columnRows, MENU_LAST, TWO_COLUMNS, THREE_COLUMNS } from './tools.mjs';\n\n${rendering}`);
}
console.log('共用入口、ICA 工具與選單顯示機制已恢復。');
