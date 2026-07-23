#!/bin/bash
# 外循环：反复调用 run-ai.sh，直到所有子 issue 完成或达到上限
set -eo pipefail

if [ -z "${1:-}" ]; then
  echo "用法: $0 <parent-issue-id> [最大轮次=25]"
  echo "示例: $0 42 10"
  exit 1
fi

ISSUE_ID="$1"
ITERATIONS="${2:-25}"

CYAN='\033[0;36m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
RESET='\033[0m'

log()  { echo -e "${CYAN}[loop] $*${RESET}" >&2; }
warn() { echo -e "${YELLOW}[loop] $*${RESET}" >&2; }
ok()   { echo -e "${GREEN}[loop] $*${RESET}" >&2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/loop-$(date +%Y%m%d-%H%M%S)-issue${ISSUE_ID}.log"

# 同时输出到终端和日志文件
exec > >(tee -a "$LOG_FILE") 2>&1

log "启动 Ralph Loop — 父 issue #$ISSUE_ID，最多 $ITERATIONS 轮"
log "日志保存至: $LOG_FILE"

for ((i=1; i<=ITERATIONS; i++)); do
  log "─── 第 $i / $ITERATIONS 轮 ───────────────────────────"

  set +e
  "$SCRIPT_DIR/run-ai.sh" "$ISSUE_ID"
  exit_code=$?
  set -e

  if [ "$exit_code" -eq 2 ]; then
    ok "所有 ready-for-agent 子 issue 已完成。共执行 $((i-1)) 轮。"
    exit 0
  elif [ "$exit_code" -ne 0 ]; then
    warn "run-ai.sh 异常退出 (code $exit_code)，停止循环。"
    exit "$exit_code"
  fi

  log "第 $i 轮完成。"
done

warn "达到轮次上限 ($ITERATIONS)，停止。"
