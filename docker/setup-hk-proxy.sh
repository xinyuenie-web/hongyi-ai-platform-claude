#!/bin/bash
# ============================================================
# 香港服务器 fal.ai 代理一键安装脚本
# 在香港服务器 (43.129.236.142) 上运行此脚本
#
# 用法: bash setup-hk-proxy.sh
# ============================================================

set -e

echo "=== 安装 Nginx ==="
apt-get update -y
apt-get install -y nginx

echo "=== 配置 fal.ai 反向代理 ==="
cat > /etc/nginx/sites-available/fal-proxy << 'NGINX_CONF'
server {
    listen 8462;
    server_name _;

    # Health check
    location /health {
        return 200 'fal-proxy OK';
        add_header Content-Type text/plain;
    }

    # Proxy fal.ai queue API (submit/poll jobs)
    location /fal/ {
        proxy_pass https://queue.fal.run/;
        proxy_http_version 1.1;
        proxy_set_header Host queue.fal.run;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_ssl_server_name on;
        proxy_read_timeout 300s;
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        client_max_body_size 50m;
        proxy_buffering off;
    }

    # Proxy fal.ai media CDN (download generated images)
    location /fal-media/ {
        proxy_pass https://v3.fal.media/;
        proxy_http_version 1.1;
        proxy_set_header Host v3.fal.media;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_ssl_server_name on;
        proxy_read_timeout 60s;
        proxy_buffering off;
    }

    # Also handle fal.media subdomains
    location /fal-cdn/ {
        proxy_pass https://fal.media/;
        proxy_http_version 1.1;
        proxy_set_header Host fal.media;
        proxy_ssl_server_name on;
        proxy_read_timeout 60s;
    }
}
NGINX_CONF

# Enable the site
ln -sf /etc/nginx/sites-available/fal-proxy /etc/nginx/sites-enabled/fal-proxy

# Test nginx config
echo "=== 测试 Nginx 配置 ==="
nginx -t

# Restart nginx
echo "=== 重启 Nginx ==="
systemctl restart nginx
systemctl enable nginx

# Test health endpoint
echo "=== 测试代理 ==="
sleep 2
curl -s http://localhost:8462/health && echo ""

echo ""
echo "=== 安装完成！ ==="
echo "代理地址: http://43.129.236.142:8462"
echo "健康检查: curl http://43.129.236.142:8462/health"
echo ""
echo "请确保防火墙已开放 8462 端口！"
echo "腾讯云控制台 → 安全组 → 添加入站规则 → TCP 8462"
