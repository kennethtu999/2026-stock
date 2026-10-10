# 台股投資系統

協助台股投資的單一系統。目前處於目標規劃階段，尚未建立投資功能。

## 文件

- [文件索引](docs/INDEX.md)
- [目標規劃草案](docs/product-plan.md)
- [清理紀錄](docs/cleanup.md)
- [協作規則](AGENTS.md)

## 目錄

| 目錄 | 用途 |
|---|---|
| `docs/` | 本系統需求與設計 |
| `scripts/ai/` | 本系統協作工具 |
| `logs/` | 本機封存與一次性紀錄，不進版控 |
| `local-data/` | 本機資料，不進版控 |

## 開發工具

先執行 `bash scripts/onboarding.sh` 建立或補齊 `.env` 並檢查環境，再執行 `bash scripts/tool.sh`（或 `npm run tools`）開啟選單。

選單保留方向鍵、數字選擇、說明區與依終端寬度切換欄數的機制，提供 Claude／Codex 啟動、目前專案 Git 狀態與差異、onboarding，以及 ICA setup／key 更新／模型選單更新。

AI 入口、模型與推理強度由 `.env` 設定，環境變數優先；模型留空時沿用 CLI 設定。ICA 使用者可指定 `~/bin/codex.sh` 或 `~/bin/claude.sh`。Setup ICA 會依提示寫入使用者目錄，onboarding 本身只更新本專案設定並檢查工具。

目前工具不需要第三方 npm 依賴。尚未選定投資系統的技術架構。
