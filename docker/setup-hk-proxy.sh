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

    # Increase buffer sizes for large base64 payloads
    client_max_body_size 100m;
    proxy_buffer_size 128k;
    proxy_buffers 8 256k;
    proxy_busy_buffers_size 512k;
    client_body_buffer_size 50m;

    # Health check
    location /health {
        return 200 'fal-proxy OK';
        add_header Content-Type text/plain;
    }

    # Proxy fal.ai SYNCHRONOUS API (fal.run — blocks until done)
    # Used for: POST /fal-sync/fal-ai/flux-pro/v1/fill
    location /fal-sync/ {
        proxy_pass https://fal.run/;
        proxy_http_version 1.1;
        proxy_set_header Host fal.run;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_ssl_server_name on;
        proxy_read_timeout 300s;
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        client_max_body_size 100m;
        proxy_buffering off;
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
        client_max_body_size 100m;
        proxy_buffering off;
    }

    # Proxy fal.ai media CDN (download generated images)
    # Dynamic: /fal-cdn/{hostname}/{path} → https://{hostname}/{path}
    # Supports any fal.media subdomain (v3.fal.media, v3b.fal.media, etc.)
    location ~ ^/fal-cdn/([^/]+)/(.*) {
        resolver 8.8.8.8 ipv6=off;
        set $cdn_host $1;
        set $cdn_path $2;
        proxy_pass https://$cdn_host/$cdn_path;
        proxy_http_version 1.1;
        proxy_set_header Host $cdn_host;
        proxy_ssl_server_name on;
        proxy_read_timeout 60s;
        proxy_buffering off;
    }

    # Legacy: fixed v3.fal.media CDN proxy
    location /fal-media/ {
        proxy_pass https://v3.fal.media/;
        proxy_http_version 1.1;
        proxy_set_header Host v3.fal.media;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_ssl_server_name on;
        proxy_read_timeout 60s;
        proxy_buffering off;
    }
}
NGINX_CONF

# Enable the site
ln -sf /etc/nginx/sites-available/fal-proxy /etc/nginx/sites-enabled/fal-proxy

# Remove default site if exists (avoid port conflicts)
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# Test nginx config
echo "=== 测试 Nginx 配置 ==="
nginx -t

# Restart nginx
echo "=== 重启 Nginx ==="
systemctl restart nginx
systemctl enable nginx

# Open firewall port if ufw is active
if command -v ufw &>/dev/null && ufw status | grep -q "active"; then
    echo "=== 开放防火墙端口 8462 ==="
    ufw allow 8462/tcp
fi

# Test health endpoint
echo "=== 测试代理 ==="
sleep 2
curl -s http://localhost:8462/health && echo ""

# Test fal.run proxy (expect auth error, that's fine — means proxy works)
echo ""
echo "=== 测试 fal.run 代理 ==="
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8462/fal-sync/fal-ai/flux-pro/v1/fill \
  -H "Content-Type: application/json" -d '{"prompt":"test"}')
if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "422" ]; then
    echo "fal-sync 代理正常! (HTTP $HTTP_CODE = 预期的认证/参数错误)"
elif [ "$HTTP_CODE" = "000" ]; then
    echo "错误: fal-sync 代理无响应"
else
    echo "fal-sync 代理返回 HTTP $HTTP_CODE"
fi

echo ""
echo "=== 安装完成！ ==="
echo "代理地址: http://43.129.236.142:8462"
echo "健康检查: curl http://43.129.236.142:8462/health"
echo ""
echo "============================================"
echo "重要！请确保腾讯云安全组已开放 8462 端口："
echo "腾讯云控制台 → 轻量应用服务器 → 防火墙 → 添加规则"
echo "  协议: TCP"
echo "  端口: 8462"
echo "  策略: 允许"
echo "  来源: 0.0.0.0/0"
echo "============================================"
