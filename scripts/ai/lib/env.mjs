// 用途：取得本系統根目錄與 .env 設定；不執行設定中的程式碼。
// 用法：import { REPO_ROOT, readDotEnv } from './lib/env.mjs'
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export function readDotEnv(root = REPO_ROOT) {
  const file = join(root, '.env');
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
