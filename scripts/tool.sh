#!/usr/bin/env bash
# 用途：開發同仁的 AI 與 Git 任務選單。
# 用法：bash scripts/tool.sh（先執行 bash scripts/onboarding.sh）
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo '請先安裝 Node.js 20 以上，並執行 bash scripts/onboarding.sh' >&2
  exit 1
fi
exec node scripts/tools.mjs "$@"
