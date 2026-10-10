/**
 * 用途：封存從 GIB 複製的專案內容，為單一台股系統清出工作目錄。
 * 用法：node scripts/ai/clean-inherited-project.mjs [--apply]
 * 預設只列出範圍；--apply 移至 logs/inherited-project-vN/，不刪除檔案。
 * 封存可能含本機憑證，不得提交或分享。此為一次性遷移工具。
 */
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const marker = path.join(root, 'logs/inherited-project-cleanup.json');
if (existsSync(marker)) {
  console.log('已完成清理；紀錄位於 logs/inherited-project-cleanup.json。');
  process.exit(0);
}
const targets = [
  'AGENTS.md', 'README.md', '.gitignore', '.env', '.env.example',
  'package.json', 'package-lock.json', 'hncb-gib.code-workspace',
  '.agents', '.claude', '.codex', 'docs', 'packages', 'node_modules', '.DS_Store',
];
for (const name of readdirSync(path.join(root, 'scripts'))) {
  if (name !== 'ai') targets.push(`scripts/${name}`);
}
for (const name of readdirSync(path.join(root, 'scripts/ai'))) {
  if (name !== 'clean-inherited-project.mjs') targets.push(`scripts/ai/${name}`);
}
const existing = targets.filter((name) => existsSync(path.join(root, name)));
if (!process.argv.includes('--apply')) {
  console.log(existing.join('\n'));
  process.exit(0);
}
let version = 1;
while (existsSync(path.join(root, `logs/inherited-project-v${version}`))) version++;
const archive = path.join(root, `logs/inherited-project-v${version}`);
mkdirSync(archive, { recursive: true, mode: 0o700 });
for (const name of existing) {
  const destination = path.join(archive, name);
  mkdirSync(path.dirname(destination), { recursive: true });
  renameSync(path.join(root, name), destination);
}
writeFileSync(marker, JSON.stringify({ archive: path.relative(root, archive), moved: existing }, null, 2) + '\n');
console.log(`已封存 ${existing.length} 項至 ${path.relative(root, archive)}。`);
