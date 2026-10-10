# 初始清理紀錄

日期：2026-10-10。

## 原因

此目錄沿用 hncb-gib-assist，內容主要是銀行交易開發協作、多 repo 管理及相關規則，與單一台股投資系統的用途不符。盤點未發現台股系統實作，且本目錄尚無 `.git`。

## 已完成

- 將原協作規則、README、文件（含個人 SQL）、GIB skills、專案層 AI 設定封存。
- 將多 repo 選單、onboarding、交易工具、審查與格式化工具及其測試封存。
- 將 Decision Dashboard、舊 npm 設定與已安裝依賴封存。
- 將舊 `.env`、環境範本與 GIB workspace 封存。
- 建立台股系統的協作規則、說明、文件索引與目標規劃草案。

## 封存與還原

封存位置：`logs/inherited-project-v1/`。
逐項搬移紀錄：`logs/inherited-project-cleanup.json`。
執行腳本：`scripts/ai/clean-inherited-project.mjs`。

封存可能包含帳密、內部文件與本機設定，僅留本機，不得提交或分享。
需要還原時，先備份目前同名檔案，再依搬移紀錄將封存項目搬回原相對路徑。應只還原需要的項目，避免覆蓋新的規劃。

## 保留工具機制（依使用者補充）

已恢復 `scripts/tool.sh` 與 `scripts/onboarding.sh` 入口，將選單調整為本台股系統使用。保留原選單多欄、方向鍵、數字選擇與說明區，以及 AI 入口／模型／推理強度設定、ICA setup、key 更新與模型選單工具。

onboarding 保留可重跑、建立 `.env`、補齊缺少設定與環境檢測報告的機制，移除其他 repo clone、銀行交易設定與 Java 等舊系統要求。只從封存 `.env` 搬回環境範本列出的 AI 設定；不恢復 GIB 專用設定。

工具不需第三方 npm 依賴；舊程式仍完整保留於封存。恢復腳本為 `scripts/ai/restore-tools.mjs`，選單顯示機制從舊工具抽取至 `scripts/menu.mjs`。

本次未修改本目錄外的其他專案，未建立 Git repo，未安裝新依賴。
舊測試與規則 lint 屬於已封存的 GIB 工具，不作為新系統的驗收依據。
