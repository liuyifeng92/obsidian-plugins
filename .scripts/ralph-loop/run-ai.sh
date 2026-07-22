#!/bin/bash
# 单次执行：拉取 issue → 喂给 AI agent → agent 实现一个 issue
set -euo pipefail

ISSUE_ID="${1:?用法: $0 <issue-id>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

YELLOW='\033[0;33m'
RESET='\033[0m'
warn() { echo -e "${YELLOW}[run-ai] $*${RESET}" >&2; }

# ─── 配置 ───────────────────────────────────────
# 替换为你使用的 AI 编码工具命令
# kimi -p | claude -p --dangerously-skip-permissions | codex --approval-mode full-auto -q
AI_CMD="kimi -p"
# ────────────────────────────────────────────────

# 1. 确保在 feature 分支上
"$SCRIPT_DIR/ensure_branch.sh" "$ISSUE_ID"

# 2. 拉取 open 的 ready-for-agent 子 issue
issues=$("$SCRIPT_DIR/get_issues.sh" "$ISSUE_ID")

if [ -z "$issues" ]; then
  warn "没有剩余的 ready-for-agent 子 issue，任务完成"
  exit 2
fi

# 3. 获取最近 5 条 commit 作为上下文
commits=$(git log -n 5 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "暂无 commit")

# 4. 读取 prompt 模板
prompt=$(cat "$SCRIPT_DIR/run-ai-prompt.md")

# 5. 调用 AI agent 非交互模式
$AI_CMD "Parent issue: #$ISSUE_ID

Previous commits:
$commits

Issues to implement:
$issues

$prompt"
