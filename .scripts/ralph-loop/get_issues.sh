#!/bin/bash
# 用 GitHub GraphQL API 拉取父 issue 下 open、带 ready-for-agent 标签、且无未完成阻塞项的子 issue
# （to-tickets v1.1 起用 GitHub 原生 blocked-by 建依赖，只有 frontier 上的 issue 才可开工）
set -euo pipefail

ISSUE_ID="${1:?用法: $0 <parent-issue-id>}"

# 从 git remote 提取 owner/repo
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$REMOTE_URL" ]; then
  echo "错误: 找不到 git remote origin" >&2
  exit 1
fi

# 支持 SSH 和 HTTPS 格式
OWNER=$(echo "$REMOTE_URL" | sed -E 's#(git@github\.com:|https://github\.com/)##; s#\.git$##' | cut -d'/' -f1)
REPO_NAME=$(echo "$REMOTE_URL" | sed -E 's#(git@github\.com:|https://github\.com/)##; s#\.git$##' | cut -d'/' -f2)

gh api graphql -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        subIssues(first: 50) {
          nodes {
            number
            title
            body
            state
            labels(first: 20) {
              nodes { name }
            }
            blockedBy(first: 20) {
              nodes { number state }
            }
            comments(first: 50) {
              nodes {
                author { login }
                createdAt
                body
              }
            }
          }
        }
      }
    }
  }
' \
  -f owner="$OWNER" \
  -f repo="$REPO_NAME" \
  -F number="$ISSUE_ID" \
  --jq '
    .data.repository.issue.subIssues.nodes
    | map(select(
        .state == "OPEN"
        and (.labels.nodes | map(.name) | contains(["ready-for-agent"]))
        and ((.blockedBy.nodes // []) | map(select(.state == "OPEN")) | length == 0)
      ))
    | map(
        "## Issue #\(.number): \(.title)\n\n\(.body // "")"
        + (
            if (.comments.nodes | length) > 0 then
              "\n\n### Comments\n\n" +
              (.comments.nodes | map(
                "**\(.author.login) (\(.createdAt | split("T")[0])):** \(.body)"
              ) | join("\n\n"))
            else "" end
          )
      )
    | join("\n\n---\n\n")
  '
