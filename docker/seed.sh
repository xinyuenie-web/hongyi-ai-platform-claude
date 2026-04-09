#!/bin/sh
# ============================================================
# 数据初始化脚本 - 在 server 容器内运行
# 用法: docker compose exec server sh /app/docker/seed.sh
# ============================================================

echo "🌳 开始导入种子数据..."
cd /app
tsx apps/server/src/scripts/seed-trees.ts
echo "✅ 种子数据导入完成"
