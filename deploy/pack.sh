#!/bin/bash
# ============================================================
# 红艺AI花木平台 - 打包脚本
# 打包所有必需文件用于上传到宝塔面板
# ============================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT="$PROJECT_DIR/hongyi-platform-deploy.tar.gz"

echo "打包项目: $PROJECT_DIR"
echo "输出文件: $OUTPUT"

cd "$PROJECT_DIR"

tar -czf "$OUTPUT" \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='*.tar.gz' \
  --exclude='202604091400新增信息' \
  --exclude='素材*' \
  --exclude='apps/miniapp/node_modules' \
  --exclude='apps/miniapp/dist' \
  apps/ \
  packages/ \
  deploy/ \
  package.json \
  package-lock.json \
  tsconfig.json \
  .env \
  "十种造型树木清单20260402.csv" \
  "五类庭院别墅清单20260402.csv" \
  2>/dev/null

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo ""
echo "✅ 打包完成: $OUTPUT ($SIZE)"
echo "请将此文件上传到宝塔面板 /www/wwwroot/hongyi/ 并解压"
