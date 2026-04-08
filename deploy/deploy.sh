#!/bin/bash
# ============================================================
# 红艺AI花木平台 - 部署脚本
# 前提条件：代码已上传到 /www/wwwroot/hongyi
# ============================================================

set -e

PROJECT_DIR="/www/wwwroot/hongyi"

echo "=========================================="
echo "  红艺AI花木平台 - 开始部署"
echo "=========================================="

# 加载 nvm（确保 node 命令可用）
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# ----------------------------------------------------------
# 第一步：进入项目目录
# ----------------------------------------------------------
echo ""
echo "[1/6] 进入项目目录..."
cd "$PROJECT_DIR"
echo "当前目录: $(pwd)"
echo "Node.js 版本: $(node -v)"

# ----------------------------------------------------------
# 第二步：检查 .env 文件是否存在
# ----------------------------------------------------------
echo ""
echo "[2/6] 检查环境变量配置..."

if [ ! -f "$PROJECT_DIR/apps/server/.env" ]; then
    echo "警告：未找到 apps/server/.env 文件！"
    echo "请先创建 .env 文件，参考以下模板："
    echo ""
    echo "  MONGODB_URI=mongodb://127.0.0.1:27017/hongyi"
    echo "  JWT_SECRET=your-super-secret-key-change-this"
    echo "  PORT=4000"
    echo "  NODE_ENV=production"
    echo ""
    read -p "是否继续部署？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "部署已取消。请先配置 .env 文件。"
        exit 1
    fi
else
    echo ".env 文件已存在，继续部署。"
fi

# ----------------------------------------------------------
# 第三步：安装依赖
# ----------------------------------------------------------
echo ""
echo "[3/6] 安装项目依赖（npm install）..."
npm install --production=false
echo "依赖安装完成。"

# ----------------------------------------------------------
# 第四步：构建共享包
# ----------------------------------------------------------
echo ""
echo "[4/6] 构建共享包（packages/shared）..."
npm run build:shared
echo "共享包构建完成。"

# ----------------------------------------------------------
# 第五步：构建 Next.js 网站
# ----------------------------------------------------------
echo ""
echo "[5/6] 构建 Next.js 网站..."
npm run build:website

# 复制静态资源到 standalone 目录（Next.js standalone 模式需要）
echo "复制静态资源到 standalone 目录..."
cp -r apps/website/public apps/website/.next/standalone/apps/website/public 2>/dev/null || true
cp -r apps/website/.next/static apps/website/.next/standalone/apps/website/.next/static 2>/dev/null || true

echo "网站构建完成。"

# ----------------------------------------------------------
# 第六步：运行数据种子脚本
# ----------------------------------------------------------
echo ""
echo "[6/6] 运行数据种子脚本..."
echo "（向数据库导入初始苗木数据）"
npm run seed || echo "种子脚本执行完毕（如数据已存在则可能跳过）。"

# ----------------------------------------------------------
# 重启 PM2 应用
# ----------------------------------------------------------
echo ""
echo "重启 PM2 应用..."

# 先停止已有的应用（如果存在）
pm2 delete hongyi-server 2>/dev/null || true
pm2 delete hongyi-website 2>/dev/null || true

# 使用 ecosystem 配置启动
pm2 start "$PROJECT_DIR/deploy/ecosystem.config.js"

# 保存 PM2 进程列表（重启服务器后自动恢复）
pm2 save

echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo ""
echo "查看应用状态:  pm2 status"
echo "查看服务端日志: pm2 logs hongyi-server"
echo "查看网站日志:  pm2 logs hongyi-website"
echo ""
echo "访问地址: http://106.53.112.26"
echo "API 地址: http://106.53.112.26/api"
echo ""
