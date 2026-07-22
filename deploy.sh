#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# vault 插件目录
VAULT_AUTO="/Users/liuyifeng/Library/Mobile Documents/iCloud~md~obsidian/Documents/FutureLAB/.obsidian/plugins/auto-frontmatter"
VAULT_UPLOAD="/Users/liuyifeng/Library/Mobile Documents/iCloud~md~obsidian/Documents/FutureLAB/.obsidian/plugins/obsidian-image-auto-upload-plugin"
VAULT_DASHBOARD="/Users/liuyifeng/Library/Mobile Documents/iCloud~md~obsidian/Documents/FutureLAB/.obsidian/plugins/homepage-dashboard"
VAULT_TABLE="/Users/liuyifeng/Library/Mobile Documents/iCloud~md~obsidian/Documents/FutureLAB/.obsidian/plugins/table-column-width"

deploy_plugin() {
  local name=$1
  local src="$SCRIPT_DIR/$name"
  local dest=$2

  echo "🔨 构建 $name ..."
  cd "$src"
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  pnpm build

  echo "📦 部署 $name ..."
  mkdir -p "$dest"
  cp main.js "$dest/"
  cp manifest.json "$dest/"
  [ -f styles.css ] && cp styles.css "$dest/"

  echo "✅ $name 部署完成"
  echo ""
}

# 可选参数：deploy.sh auto / upload / dashboard / table / 不传则全部部署
case "${1:-all}" in
  auto)
    deploy_plugin "auto-frontmatter" "$VAULT_AUTO"
    ;;
  upload)
    deploy_plugin "file-auto-upload-plugin" "$VAULT_UPLOAD"
    ;;
  dashboard)
    deploy_plugin "homepage-dashboard" "$VAULT_DASHBOARD"
    ;;
  table)
    deploy_plugin "table-column-width" "$VAULT_TABLE"
    ;;
  all)
    deploy_plugin "auto-frontmatter" "$VAULT_AUTO"
    deploy_plugin "file-auto-upload-plugin" "$VAULT_UPLOAD"
    deploy_plugin "homepage-dashboard" "$VAULT_DASHBOARD"
    deploy_plugin "table-column-width" "$VAULT_TABLE"
    ;;
  *)
    echo "用法: ./deploy.sh [auto|upload|dashboard|table|all]"
    exit 1
    ;;
esac

echo "🎉 全部完成，请重启 Obsidian 或在设置中重新加载插件"
