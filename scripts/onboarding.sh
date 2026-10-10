#!/usr/bin/env bash
# 用途：建立單一台股系統的 .env、補上缺少的設定並輸出環境報告。
# 用法：bash scripts/onboarding.sh（可重跑；不覆寫既有值、不 clone 其他 repo）。
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
failures=0
results=()
pass() { results+=("PASS  $1"); }
fail() { results+=("FAIL  $1"); failures=$((failures + 1)); }
optional() { results+=("OPTIONAL  $1"); }
echo '台股系統環境初始化'
if ! command -v node >/dev/null 2>&1; then
  echo 'FAIL  請先安裝 Node.js 20 以上' >&2
  exit 1
fi
if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)'; then
  echo 'FAIL  需 Node.js 20 以上' >&2
  exit 1
fi
pass "Node.js $(node --version)"
if node --input-type=module <<'NODE'
import { copyFileSync, existsSync, readFileSync, appendFileSync, chmodSync } from 'node:fs';
import { readDotEnv } from './scripts/ai/lib/env.mjs';
if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
  chmodSync('.env', 0o600);
  console.log('已建立 .env');
} else {
  const current = readDotEnv();
  for (const line of readFileSync('.env.example', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (match && !(match[1] in current)) appendFileSync('.env', `\n${line}\n`);
  }
  console.log('.env 已存在，保留原值並補上缺少的設定');
}
NODE
then pass '.env 設定已備妥'; else fail '.env 建立或更新失敗'; fi
if command -v git >/dev/null 2>&1; then
  pass "Git $(git --version)"
  if git rev-parse --show-toplevel >/dev/null 2>&1; then
    pass 'Git 工作目錄可讀取'
  else
    optional '尚未初始化 Git；目前可使用 AI 與環境工具'
  fi
else fail 'Git 未安裝或不在 PATH'; fi
if command -v npm >/dev/null 2>&1; then pass "npm $(npm --version)"; else fail 'npm 未安裝或不在 PATH'; fi
for agent in codex claude; do
  if command -v "$agent" >/dev/null 2>&1; then pass "$agent CLI 已安裝";
  else optional "$agent CLI 未安裝；使用對應 AI 時需要"; fi
done
for agent in codex claude; do
  if [[ -x "$HOME/bin/$agent.sh" ]]; then pass "ICA $agent wrapper 可執行";
  else optional "ICA $agent wrapper 未設定；可從工具選單執行 Setup ICA"; fi
done
if command -v rtk >/dev/null 2>&1; then pass 'RTK 已安裝'; else optional 'RTK 未安裝'; fi
printf '\n環境檢測報告\n'
printf '%s\n' "${results[@]}"
if (( failures > 0 )); then
  echo "檢測結果：$failures 項失敗；修正後可重跑。"
  exit 1
fi
echo '檢測結果：必要檢查通過'
echo '下一步：bash scripts/tool.sh'
