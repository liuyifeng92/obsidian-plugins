#!/bin/bash
# 确保父 issue 有一个关联的 feature 分支并 checkout
set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RESET='\033[0m'

log() { echo -e "${CYAN}[ensure_branch] $*${RESET}" >&2; }
ok()  { echo -e "${GREEN}[ensure_branch] $*${RESET}" >&2; }

ISSUE_NUM="${1:?用法: $0 <issue-num>}"

# 检查是否已有关联分支
existing=$(gh issue develop --list "$ISSUE_NUM" 2>/dev/null | awk '{print $1}' | head -1 || echo "")
if [ -n "$existing" ]; then
  current=$(git branch --show-current)
  if [ "$current" != "$existing" ]; then
    log "切换到已有分支: $existing"
    git checkout "$existing"
  else
    log "已在分支: $existing"
  fi
  exit 0
fi

# 创建新分支
title=$(gh issue view "$ISSUE_NUM" --json title -q .title 2>/dev/null || echo "issue-$ISSUE_NUM")
slug=$(echo "$title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/-\+/-/g; s/^-//; s/-$//' | cut -c1-40)
branch_name="feat/${ISSUE_NUM}-${slug}"

log "创建分支 $branch_name ..."
gh issue develop "$ISSUE_NUM" --name "$branch_name" --base main --checkout
ok "分支已创建并切换: $branch_name"
