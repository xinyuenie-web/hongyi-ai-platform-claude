#!/bin/bash
# ============================================================
# 红艺AI花木平台 - 服务器初始化脚本
# 适用于腾讯云轻量服务器 + 宝塔面板环境
# 服务器IP: 106.53.112.26
# ============================================================

set -e

echo "=========================================="
echo "  红艺AI花木平台 - 服务器环境初始化"
echo "=========================================="

# ----------------------------------------------------------
# 第一步：安装 nvm 和 Node.js 20
# ----------------------------------------------------------
echo ""
echo "[1/5] 安装 Node.js 20（通过 nvm）..."

# 检查是否已安装 nvm
if [ ! -d "$HOME/.nvm" ]; then
    echo "正在安装 nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
else
    echo "nvm 已存在，跳过安装。"
fi

# 加载 nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 安装 Node.js 20 LTS
nvm install 20
nvm use 20
nvm alias default 20

echo "Node.js 版本: $(node -v)"
echo "npm 版本: $(npm -v)"

# ----------------------------------------------------------
# 第二步：安装 MongoDB 7
# 说明：也可以通过宝塔面板「软件商店」安装 MongoDB
# ----------------------------------------------------------
echo ""
echo "[2/5] 安装 MongoDB 7..."

# 检查是否已安装 MongoDB
if command -v mongod &> /dev/null; then
    echo "MongoDB 已安装，跳过。"
    mongod --version
else
    echo "正在安装 MongoDB 7..."

    # 导入 MongoDB GPG 公钥
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
        gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

    # 添加 MongoDB 软件源（适用于 Ubuntu 22.04）
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
        tee /etc/apt/sources.list.d/mongodb-org-7.0.list

    # 更新包列表并安装
    apt-get update
    apt-get install -y mongodb-org

    # 启动 MongoDB 并设为开机自启
    systemctl start mongod
    systemctl enable mongod

    echo "MongoDB 安装完成！"
    mongod --version
fi

# ----------------------------------------------------------
# 第三步：安装 PM2 进程管理器
# ----------------------------------------------------------
echo ""
echo "[3/5] 安装 PM2 进程管理器..."

if command -v pm2 &> /dev/null; then
    echo "PM2 已安装，跳过。"
else
    npm install -g pm2
    echo "PM2 安装完成！"
fi

# 安装 tsx（用于直接运行 TypeScript）
echo "安装 tsx（TypeScript 执行器）..."
npm install -g tsx

pm2 --version

# ----------------------------------------------------------
# 第四步：创建项目目录
# ----------------------------------------------------------
echo ""
echo "[4/5] 创建项目目录..."

PROJECT_DIR="/www/wwwroot/hongyi"

if [ ! -d "$PROJECT_DIR" ]; then
    mkdir -p "$PROJECT_DIR"
    echo "已创建目录: $PROJECT_DIR"
else
    echo "目录已存在: $PROJECT_DIR"
fi

# 创建日志目录
mkdir -p /www/wwwlogs

# ----------------------------------------------------------
# 第五步：配置 PM2 开机自启
# ----------------------------------------------------------
echo ""
echo "[5/5] 配置 PM2 开机自启..."

pm2 startup systemd -u root --hp /root
echo "PM2 开机自启已配置。"

# ----------------------------------------------------------
# 完成
# ----------------------------------------------------------
echo ""
echo "=========================================="
echo "  服务器环境初始化完成！"
echo "=========================================="
echo ""
echo "接下来请："
echo "  1. 将项目代码上传到 $PROJECT_DIR"
echo "  2. 配置 .env 文件"
echo "  3. 运行 deploy.sh 部署脚本"
echo ""
