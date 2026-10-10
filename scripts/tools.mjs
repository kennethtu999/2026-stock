#!/usr/bin/env node
// 用途：提供單一台股系統的 AI、Git 狀態、環境初始化與 ICA 工具選單。
// 用法：bash scripts/tool.sh 或 npm run tools；--help 顯示說明。
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { REPO_ROOT, readDotEnv } from './ai/lib/env.mjs';
import { selectMenu } from './menu.mjs';

export function color(value, code) {
  return process.stdout.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== 'dumb' ? `\x1b[${code}m${value}\x1b[0m` : value;
}
export const toolDetail = (how, effect) => `HOW: ${how}\nWHAT: ${effect}`;
export const TWO_COLUMNS = 100;
export const THREE_COLUMNS = 150;
function menuColumns() {
  let number = 0;
  return [
    ['開發', [['AI', [
      ['啟動預設 AI', toolDetail('讀取 .env 的 AI_AGENT、入口、模型與推理強度。', '在目前台股系統目錄啟動 AI。'), 'default-ai'],
      ['Claude Code', toolDetail('讀取 CLAUDE_* 設定。', '在目前系統啟動 Claude Code。'), 'claude'],
      ['Codex', toolDetail('讀取 CODEX_* 設定。', '在目前系統啟動 Codex。'), 'codex'],
    ]]]],
    ['工具', [['本專案', [
      ['Git 狀態', toolDetail('執行目前目錄的 git status。', '查看分支與異動。'), 'status'],
      ['Git 差異', toolDetail('顯示工作樹及暫存區 diff。', '查看尚未提交的程式異動。'), 'diff'],
      ['環境初始化／檢查', toolDetail('執行 scripts/onboarding.sh。', '建立缺少的 .env 設定並輸出環境檢測報告。'), 'onboarding'],
    ]]]],
    ['其它', [['ICA', [
      ['Setup ICA', toolDetail('執行既有 ICA 設定工具，依提示輸入 key。', '建立使用者目錄的 AI wrapper 與 ICA 設定。'), 'ica-setup'],
      ['更新 ICA key', toolDetail('執行既有 ICA key 更新工具。', '更新本機共用 ICA key。'), 'ica-key'],
      ['更新 ICA 模型選單', toolDetail('執行 setup-model-picker.mjs。', '更新使用者目錄的 ICA 專用模型選單。'), 'model-picker'],
    ]]]],
  ].map(([title, sections]) => [title, sections.map(([section, items]) => [section, items.map(item => [++number, ...item])])]);
}
export function menuItems() { return menuColumns().flatMap(([, sections]) => sections.flatMap(([, items]) => items)); }
export const MENU_LAST = menuItems().length;
export function layoutColumns(columns) {
  const groups = menuColumns();
  if (columns >= THREE_COLUMNS) return groups;
  if (columns >= TWO_COLUMNS) return [groups[0], ['工具與其它', [...groups[1][1], ...groups[2][1]]]];
  return groups;
}
export function columnRows([title, sections]) {
  return [{ title, level: 0 }, ...sections.flatMap(([section, items]) => [
    ...(section ? [{ title: section, level: 1 }] : []),
    ...items.map(item => ({ item, level: section ? 1 : 0 })),
  ])];
}
function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: REPO_ROOT, stdio: 'inherit' });
  if (result.error) throw new Error(`無法執行 ${cmd}：${result.error.message}`);
  if (result.status !== 0) throw new Error(`${cmd} 執行失敗（${result.status ?? result.signal}）。`);
}
export function agentCommand(agent, config) {
  if (!['claude', 'codex'].includes(agent)) throw new Error('請設定 AI_AGENT=codex 或 claude。');
  const prefix = agent.toUpperCase();
  let cmd = config[`${prefix}_ENTRY`] || agent;
  if (cmd.startsWith('~/')) cmd = join(homedir(), cmd.slice(2));
  const model = config[`${prefix}_MODEL`]?.trim();
  const effort = config[`${prefix}_EFFORT`]?.trim();
  const args = agent === 'claude'
    ? [...(model ? ['--model', model] : []), ...(effort ? ['--effort', effort] : [])]
    : [...(model ? ['-m', model] : []), ...(effort ? ['-c', `model_reasoning_effort=${JSON.stringify(effort)}`] : [])];
  return { cmd, args };
}
export async function main() {
  if (process.argv.includes('--help')) {
    console.log('用法：bash scripts/tool.sh 或 npm run tools\n需 Node.js 20+；先執行 bash scripts/onboarding.sh。\n只操作目前台股系統；AI 設定讀取 .env，環境變數優先。');
    return;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('請在互動式終端機執行 bash scripts/tool.sh。');
  while (true) {
    const answer = await selectMenu();
    if (answer === '0') return;
    const action = menuItems().find(([number]) => String(number) === answer)?.[3];
    try {
      if (['default-ai', 'claude', 'codex'].includes(action)) {
        const config = { ...readDotEnv(), ...process.env };
        const agent = action === 'default-ai' ? config.AI_AGENT : action;
        const { cmd, args } = agentCommand(agent, config);
        run(cmd, args);
      } else if (action === 'status') run('git', ['status', '--short', '--branch']);
      else if (action === 'diff') { run('git', ['diff']); run('git', ['diff', '--cached']); }
      else if (action === 'onboarding') run('bash', ['scripts/onboarding.sh']);
      else if (action === 'ica-setup' || action === 'ica-key') run(process.execPath, ['scripts/ai/setup-ica.mjs', action === 'ica-setup' ? 'setup' : 'update-key']);
      else if (action === 'model-picker') run(process.execPath, ['scripts/ai/setup-model-picker.mjs']);
    } catch (error) { console.error(color(error.message, 31)); }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try { await rl.question('操作結束，按 Enter 返回選單。'); } finally { rl.close(); }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
