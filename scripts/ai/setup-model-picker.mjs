#!/usr/bin/env node
// 用途：把實測可走 native 的非 Anthropic model 補進 ICA 專用的 Claude Code 設定檔
//       （~/.config/opencode/claude-ica-settings.json 的 modelPicker.options），由 ~/bin/claude.sh 以 --settings 帶入；
//       不動 ~/.claude/settings.json，自有訂閱的 Claude Code 不會看到這些選項。
//       已有的行與其他設定保留，只補缺少的 model；本工具產生的行（description 為 ICA proxy · native）不在清單內時移除。設定檔不是合法 JSON 時不改檔。
//       ~/.claude/settings.json 設有 availableModels 白名單時（只讀不寫），專用檔同步寫入白名單與 native model 的聯集，
//       否則 /model 會濾掉不在白名單的選項；沒有白名單時不寫，避免反把 Claude model 擋掉。
// 用法：node scripts/ai/setup-model-picker.mjs
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { NATIVE_MODELS } from './setup-ica.mjs';

const NATIVE_DESCRIPTION = 'ICA proxy · native';

function userAllowlist(home) {
  try {
    const list = JSON.parse(readFileSync(join(home, '.claude', 'settings.json'), 'utf8'))?.availableModels;
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

export function setupModelPicker({ home = homedir(), models = NATIVE_MODELS } = {}) {
  const dir = join(home, '.config', 'opencode');
  const path = join(dir, 'claude-ica-settings.json');
  let settings = {};
  if (existsSync(path)) {
    const text = readFileSync(path, 'utf8');
    try {
      settings = text.trim() ? JSON.parse(text) : {};
    } catch {
      throw new Error(`${path} 不是合法 JSON，未更新 /model 選單。`);
    }
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error(`${path} 頂層不是物件，未更新 /model 選單。`);
  }
  const picker = settings.modelPicker && typeof settings.modelPicker === 'object' ? settings.modelPicker : {};
  const current = Array.isArray(picker.options) ? picker.options : [];
  const removed = current.filter(option => option?.description === NATIVE_DESCRIPTION && !models.includes(option.model)).map(option => option.model);
  const options = current.filter(option => !removed.includes(option?.model));
  const existing = new Set(options.map(option => option?.model));
  const added = models.filter(model => !existing.has(model));
  const allowlist = userAllowlist(home);
  const allowed = (Array.isArray(settings.availableModels) ? settings.availableModels : []).filter(model => !removed.includes(model));
  const allowedAdded = allowlist ? [...allowlist, ...models].filter(model => !allowed.includes(model)) : [];
  if (!added.length && !allowedAdded.length && !removed.length) return added;
  settings.modelPicker = { ...picker, options: [...options, ...added.map(model => ({ model, description: NATIVE_DESCRIPTION }))] };
  if (allowedAdded.length || (removed.length && Array.isArray(settings.availableModels))) settings.availableModels = [...new Set([...allowed, ...allowedAdded])];
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(`${path}.tmp`, `${JSON.stringify(settings, null, 2)}\n`);
  renameSync(`${path}.tmp`, path);
  return added;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const added = setupModelPicker();
    console.log(added.length ? `已補上 /model 選單：${added.join('、')}` : '/model 選單已含全部 native model');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
