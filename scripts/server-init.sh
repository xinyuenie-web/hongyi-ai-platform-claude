#!/bin/bash
# ============================================================
# 红艺AI花木平台 - 服务器一键初始化
#
# 腾讯云服务器只需运行一次此脚本
# 之后所有部署通过 Docker + GitHub Actions 自动完成
#
# 用法: curl -sSL https://raw.githubusercontent.com/<user>/<repo>/main/scripts/server-init.sh | bash
# 或者: bash scripts/server-init.sh
# ============================================================

set -e

echo "=========================================="
echo "  🌳 红艺花木 - 服务器初始化"
echo "  只需运行一次，安装 Docker 即可"
echo "=========================================="

# ----------------------------------------------------------
# 1. 安装 Docker
# ----------------------------------------------------------
echo ""
echo "[1/4] 🐳 安装 Docker..."

if command -v docker &> /dev/null; then
    echo "Docker 已安装: $(docker --version)"
else
    # 使用官方脚本安装 Docker
    curl -fsSL https://get.docker.com | sh

    # 启动并设为开机自启
    systemctl start docker
    systemctl enable docker

    echo "Docker 安装完成: $(docker --version)"
fi

# 配置 Docker 国内镜像加速 (解决 Docker Hub 访问问题)
echo "配置 Docker 镜像加速..."
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'DAEMON_EOF'
{
  "registry-mirrors": [
    "https://docker.xuanyuan.me",
    "https://docker.1ms.run"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
DAEMON_EOF
systemctl daemon-reload
systemctl restart docker
echo "Docker 镜像加速配置完成"

# ----------------------------------------------------------
# 2. 安装 Docker Compose (v2 已内置于 Docker)
# ----------------------------------------------------------
echo ""
echo "[2/4] 📦 检查 Docker Compose..."

if docker compose version &> /dev/null; then
    echo "Docker Compose 已就绪: $(docker compose version)"
else
    # 安装 Docker Compose 插件
    apt-get update && apt-get install -y docker-compose-plugin
    echo "Docker Compose 安装完成"
fi

# ----------------------------------------------------------
# 3. 安装 Git
# ----------------------------------------------------------
echo ""
echo "[3/4] 📂 检查 Git..."

if command -v git &> /dev/null; then
    echo "Git 已安装: $(git --version)"
else
    apt-get update && apt-get install -y git
    echo "Git 安装完成"
fi

# ----------------------------------------------------------
# 4. 配置 SSH 密钥 (用于 GitHub Actions 部署)
# ----------------------------------------------------------
echo ""
echo "[4/4] 🔑 配置 SSH..."

if [ ! -f ~/.ssh/id_ed25519 ]; then
    ssh-keygen -t ed25519 -C "hongyi-server" -f ~/.ssh/id_ed25519 -N ""
    echo ""
    echo "⚠️  请将以下公钥添加到服务器的 ~/.ssh/authorized_keys:"
    echo ""
    cat ~/.ssh/id_ed25519.pub
    echo ""
    echo "⚠️  请将以下私钥配置到 GitHub 仓库的 Secrets (SERVER_SSH_KEY):"
    echo ""
    cat ~/.ssh/id_ed25519
    echo ""
else
    echo "SSH 密钥已存在"
fi

# 确保 SSH 配置正确
mkdir -p ~/.ssh
chmod 700 ~/.ssh
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys 2>/dev/null || true
chmod 600 ~/.ssh/authorized_keys

# ----------------------------------------------------------
# 5. 创建项目目录
# ----------------------------------------------------------
mkdir -p /opt/hongyi

# ----------------------------------------------------------
# 6. 配置防火墙
# ----------------------------------------------------------
echo ""
echo "📡 配置防火墙..."

# 开放必要端口
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 22/tcp
    echo "UFW 端口已开放"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=80/tcp
    firewall-cmd --permanent --add-port=443/tcp
    firewall-cmd --reload
    echo "Firewalld 端口已开放"
fi

echo ""
echo "=========================================="
echo "  ✅ 服务器初始化完成！"
echo "=========================================="
echo ""
echo "  服务器已安装:"
echo "  ├── Docker $(docker --version 2>/dev/null | grep -o '[0-9.]*' | head -1)"
echo "  ├── Docker Compose $(docker compose version 2>/dev/null | grep -o '[0-9.]*' | head -1)"
echo "  └── Git $(git --version 2>/dev/null | grep -o '[0-9.]*')"
echo ""
echo "  ┌────────────────────────────────────────┐"
echo "  │  下一步:                                │"
echo "  │                                        │"
echo "  │  1. 在 GitHub 创建仓库                  │"
echo "  │  2. 配置 GitHub Secrets:               │"
echo "  │     - SERVER_HOST = 106.53.112.26      │"
echo "  │     - SERVER_USER = root               │"
echo "  │     - SERVER_SSH_KEY = (上面的私钥)      │"
echo "  │     - JWT_SECRET = (随机字符串)          │"
echo "  │  3. 本地 git push 到 main 分支          │"
echo "  │  4. GitHub Actions 自动部署！           │"
echo "  └────────────────────────────────────────┘"
echo ""
