#!/bin/bash
# ============================================================
# 一键部署：本地 → GitHub → 服务器
# 用法: bash scripts/deploy.sh "提交说明"
# ============================================================

set -e

MSG="${1:-update: $(date '+%Y%m%d_%H%M')}"

echo "🌳 红艺花木 - 一键部署"
echo "  提交说明: $MSG"
echo ""

# 1. Git add + commit
echo "[1/3] 📦 Git 提交..."
git add -A
git commit -m "$MSG" || echo "无新变更需要提交"

# 2. Push to GitHub
echo ""
echo "[2/3] 🚀 推送到 GitHub..."
git push origin main

# 3. 等待 GitHub Actions
echo ""
echo "[3/3] ⏳ GitHub Actions 自动部署中..."
echo "  查看进度: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/.git$//')/actions"
echo ""
echo "✅ 代码已推送！GitHub Actions 将自动部署到服务器。"
