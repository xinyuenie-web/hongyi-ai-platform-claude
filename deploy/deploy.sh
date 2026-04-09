#!/bin/bash
# ============================================================
# 红艺AI花木平台 - 一键部署脚本
# 服务器: 腾讯云轻量 106.53.112.26
# 域名: ai花木.com (xn--ai-0p4ew22l.com)
# 宝塔面板 + PM2 + MongoDB + Nginx
# ============================================================

set -e

PROJECT_DIR="/www/wwwroot/hongyi"

echo "=========================================="
echo "  🌳 红艺AI花木平台 - 开始部署"
echo "=========================================="

# 加载 nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# ----------------------------------------------------------
# 第一步：进入项目目录
# ----------------------------------------------------------
echo ""
echo "[1/7] 进入项目目录..."
cd "$PROJECT_DIR"
echo "当前目录: $(pwd)"
echo "Node.js 版本: $(node -v)"

# ----------------------------------------------------------
# 第二步：创建生产环境 .env
# ----------------------------------------------------------
echo ""
echo "[2/7] 配置环境变量..."

if [ ! -f "$PROJECT_DIR/.env" ]; then
    cat > "$PROJECT_DIR/.env" << 'ENVEOF'
# 红艺AI花木平台 - 生产环境配置
MONGODB_URI=mongodb://127.0.0.1:27017/hongyi
JWT_SECRET=hongyi-prod-secret-2026-change-this
PORT=4000
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://106.53.112.26
NEXT_PUBLIC_SITE_URL=http://106.53.112.26
ENVEOF
    echo "已创建 .env 文件，请修改 JWT_SECRET！"
else
    echo ".env 文件已存在。"
fi

# ----------------------------------------------------------
# 第三步：安装依赖
# ----------------------------------------------------------
echo ""
echo "[3/7] 安装项目依赖..."
npm install --production=false
echo "依赖安装完成。"

# ----------------------------------------------------------
# 第四步：构建共享包
# ----------------------------------------------------------
echo ""
echo "[4/7] 构建共享包..."
cd packages/shared && npx tsc && cd "$PROJECT_DIR"
echo "共享包构建完成。"

# ----------------------------------------------------------
# 第五步：构建 Next.js 网站 (standalone 模式)
# ----------------------------------------------------------
echo ""
echo "[5/7] 构建 Next.js 网站..."
cd apps/website && npx next build && cd "$PROJECT_DIR"

# 复制静态资源到 standalone 目录
echo "复制静态资源..."
mkdir -p apps/website/.next/standalone/apps/website/public
mkdir -p apps/website/.next/standalone/apps/website/.next/static
cp -r apps/website/public/* apps/website/.next/standalone/apps/website/public/ 2>/dev/null || true
cp -r apps/website/.next/static/* apps/website/.next/standalone/apps/website/.next/static/ 2>/dev/null || true
echo "网站构建完成。"

# ----------------------------------------------------------
# 第六步：运行数据种子脚本
# ----------------------------------------------------------
echo ""
echo "[6/7] 导入初始数据..."
npx tsx apps/server/src/scripts/seed-trees.ts || echo "种子数据已存在或导入完成。"

# ----------------------------------------------------------
# 第七步：PM2 启动/重启应用
# ----------------------------------------------------------
echo ""
echo "[7/7] 启动/重启 PM2 应用..."

pm2 delete hongyi-server 2>/dev/null || true
pm2 delete hongyi-website 2>/dev/null || true

pm2 start "$PROJECT_DIR/deploy/ecosystem.config.js"
pm2 save

echo ""
echo "=========================================="
echo "  ✅ 部署完成！"
echo "=========================================="
echo ""
echo "┌────────────────────────────────────────┐"
echo "│  应用状态:  pm2 status                 │"
echo "│  服务端日志: pm2 logs hongyi-server     │"
echo "│  网站日志:  pm2 logs hongyi-website     │"
echo "│                                        │"
echo "│  官网: http://106.53.112.26            │"
echo "│  后台: http://106.53.112.26/admin      │"
echo "│  API:  http://106.53.112.26/api/health │"
echo "│                                        │"
echo "│  管理员: admin / hongyi2026            │"
echo "└────────────────────────────────────────┘"
echo ""
