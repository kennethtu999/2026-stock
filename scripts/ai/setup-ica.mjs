#!/usr/bin/env node
// 用途：建立 ICA Claude/Codex wrapper，或只更新共用 ICA API key。
// 用法：node scripts/ai/setup-ica.mjs setup | update-key
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from './lib/env.mjs';

// 實測可保留 thinking（native）的非 Anthropic model；wrapper 與 /model 選單共用。
export const NATIVE_MODELS = [
  'gpt-5.6-sol', 'gpt-5.6-luna', 'gpt-5.6-terra',
  'gemini-3.7-flash',
];

const wrappers = {
  'claude.sh': `#!/usr/bin/env bash
set -euo pipefail
key_file="\${ICA_API_KEY_FILE:-$HOME/.config/opencode/ibm-ica-api-key}"
[[ -s "$key_file" ]] || { echo "找不到 ICA API key：$key_file" >&2; exit 1; }
export ANTHROPIC_BASE_URL="\${ANTHROPIC_BASE_URL:-https://api.servicesessentials.ibm.com}"
export ANTHROPIC_AUTH_TOKEN="\${ANTHROPIC_AUTH_TOKEN:-$(<"$key_file")}"
export ANTHROPIC_SMALL_FAST_MODEL="\${ANTHROPIC_SMALL_FAST_MODEL:-claude-haiku-4-5}"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="$ANTHROPIC_SMALL_FAST_MODEL"
# 非 Anthropic model 不吃 LiteLLM 由 thinking 轉譯的 reasoning_effort，輸出上限多為 16384；
# 實測可保留 thinking 的列在 CLAUDE_NATIVE_MODELS，其餘關 thinking 並壓輸出上限（已設定的值不覆寫）。
model="\${ANTHROPIC_MODEL:-}"
args=("$@")
for ((i = 0; i < \${#args[@]}; i++)); do
  case "\${args[i]}" in
    --model) model="\${args[i + 1]:-}" ;;
    --model=*) model="\${args[i]#--model=}" ;;
  esac
done
native_models=" \${CLAUDE_NATIVE_MODELS:-${NATIVE_MODELS.join(' ')}} "
if [[ -n "$model" && "$model" != claude-* && "$model" != *.anthropic.* && "$native_models" != *" $model "* ]]; then
  export MAX_THINKING_TOKENS="\${MAX_THINKING_TOKENS:-0}"
  export CLAUDE_CODE_MAX_OUTPUT_TOKENS="\${CLAUDE_CODE_MAX_OUTPUT_TOKENS:-16384}"
fi
# /model 選單的 ICA model 放在專用設定檔，只在 ICA session 帶入，不影響自有訂閱的 ~/.claude。
ica_settings="$HOME/.config/opencode/claude-ica-settings.json"
if [[ -s "$ica_settings" ]]; then
  exec claude --settings "$ica_settings" "$@"
fi
exec claude "$@"
`,
  'codex.sh': `#!/usr/bin/env bash
set -euo pipefail
key_file="\${ICA_API_KEY_FILE:-$HOME/.config/opencode/ibm-ica-api-key}"
[[ -s "$key_file" ]] || { echo "找不到 ICA API key：$key_file" >&2; exit 1; }
export OPENAI_API_KEY="\${OPENAI_API_KEY:-$(<"$key_file")}"
base_url="\${OPENAI_BASE_URL:-https://api.servicesessentials.ibm.com/v1}"
exec codex -c "model_providers.ibm={ name = 'IBM ICA', base_url = '$base_url', env_key = 'OPENAI_API_KEY', wire_api = 'responses' }" -c 'model_provider="ibm"' -c 'web_search="disabled"' "$@"
`,
};

async function promptKey() {
  if (!process.stdin.isTTY) throw new Error('請在互動式終端機輸入 ICA key。');
  const input = process.stdin;
  const wasRaw = input.isRaw;
  process.stdout.write('請輸入 ICA key：');
  return await new Promise((resolve, reject) => {
    let value = '';
    const finish = (error) => {
      input.off('data', onData);
      input.setRawMode(Boolean(wasRaw));
      input.pause();
      process.stdout.write('\n');
      if (error) reject(error); else resolve(value.trim());
    };
    const onData = chunk => {
      for (const char of String(chunk)) {
        if (char === '\r' || char === '\n') return finish();
        if (char === '\u0003') return finish(new Error('已取消 ICA key 輸入。'));
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    };
    input.setEncoding('utf8');
    input.setRawMode(true);
    input.on('data', onData);
    input.resume();
  });
}

function updateEnv(repoRoot) {
  const path = join(repoRoot, '.env');
  if (!existsSync(path) || !readFileSync(path, 'utf8')) return;
  let value = readFileSync(path, 'utf8');
  for (const [key, entry] of [['CLAUDE_ENTRY', '~/bin/claude.sh'], ['CODEX_ENTRY', '~/bin/codex.sh']]) {
    const line = `${key}=${entry}`;
    value = new RegExp(`^${key}=.*$`, 'm').test(value) ? value.replace(new RegExp(`^${key}=.*$`, 'm'), line) : `${value.trimEnd()}\n${line}\n`;
  }
  writeFileSync(path, value, { mode: 0o600 });
}

function existingWrappers(home) {
  return Object.keys(wrappers).filter(name => existsSync(join(home, 'bin', name)));
}

export function setupIca(mode, key, { home = homedir(), repoRoot = REPO_ROOT, overwriteWrappers = false } = {}) {
  if (!['setup', 'update-key'].includes(mode)) throw new Error('用法：node scripts/ai/setup-ica.mjs setup | update-key');
  if (!key) throw new Error('ICA key 不可為空。');
  const keyFile = join(home, '.config', 'opencode', 'ibm-ica-api-key');
  const binDir = join(home, 'bin');
  mkdirSync(join(home, '.config', 'opencode'), { recursive: true, mode: 0o700 });
  writeFileSync(keyFile, `${key}\n`, { mode: 0o600 });
  chmodSync(keyFile, 0o600);
  if (mode === 'setup') {
    mkdirSync(binDir, { recursive: true, mode: 0o700 });
    for (const [name, content] of Object.entries(wrappers)) {
      const path = join(binDir, name);
      if (!existsSync(path) || overwriteWrappers) {
        if (existsSync(path)) copyFileSync(path, `${path}.bak`);
        writeFileSync(path, content, { mode: 0o700 });
        chmodSync(path, 0o700);
      }
    }
    updateEnv(repoRoot);
    console.log(`ICA setup 完成：已建立或更新 Claude/Codex 入口並更新 .env。${overwriteWrappers ? '原入口已備份為 .bak。' : ''}`);
  } else console.log('ICA key 已更新。');
}

export async function main(mode = process.argv[2]) {
  if (!['setup', 'update-key'].includes(mode)) throw new Error('用法：node scripts/ai/setup-ica.mjs setup | update-key');
  let overwriteWrappers = false;
  if (mode === 'setup' && existingWrappers(homedir()).length) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = (await rl.question('偵測到既有 ICA 入口，是否備份並更新？輸入 y 更新，其他保留：')).trim();
      overwriteWrappers = /^y$/i.test(answer);
    } finally { rl.close(); }
  }
  setupIca(mode, await promptKey(), { overwriteWrappers });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
