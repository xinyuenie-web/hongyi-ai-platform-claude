# 红艺AI花木平台 - 宝塔面板部署指南

## 服务器信息

- 服务器 IP：106.53.112.26
- 操作系统：Ubuntu（腾讯云轻量服务器）
- 管理面板：宝塔面板
- 前端端口：3000（Next.js）
- 后端端口：4000（Express API）

---

## 一、通过宝塔面板安装必要软件

### 1.1 安装 Nginx

1. 登录宝塔面板（通常地址为 http://106.53.112.26:8888）
2. 进入「软件商店」
3. 搜索「Nginx」，点击安装（推荐 1.24 版本）
4. 等待安装完成

### 1.2 安装 MongoDB

**方式一：通过宝塔面板（推荐）**

1. 进入「软件商店」
2. 搜索「MongoDB」，点击安装
3. 安装完成后在软件列表中确认 MongoDB 已启动

**方式二：通过命令行**

1. 进入宝塔面板「终端」
2. 执行初始化脚本：
   ```bash
   cd /www/wwwroot/hongyi/deploy
   chmod +x setup.sh
   bash setup.sh
   ```

### 1.3 安装 Node.js

1. 进入宝塔面板「终端」
2. 运行初始化脚本（如果还没运行过）：
   ```bash
   cd /www/wwwroot/hongyi/deploy
   chmod +x setup.sh
   bash setup.sh
   ```
3. 这会安装 Node.js 20、PM2、tsx 等工具

---

## 二、上传项目代码

### 2.1 通过宝塔面板文件管理器上传

1. 进入宝塔面板「文件」
2. 导航到 `/www/wwwroot/` 目录
3. 如果没有 `hongyi` 目录，点击「新建目录」创建
4. 进入 `hongyi` 目录
5. 点击「上传」，将项目打包的 zip 文件上传
6. 上传完成后，右键点击 zip 文件选择「解压」
7. 确保项目结构如下：
   ```
   /www/wwwroot/hongyi/
   ├── apps/
   │   ├── server/
   │   └── website/
   ├── packages/
   │   └── shared/
   ├── deploy/
   │   ├── nginx.conf
   │   ├── ecosystem.config.js
   │   ├── setup.sh
   │   └── deploy.sh
   ├── package.json
   └── package-lock.json
   ```

### 2.2 通过 Git 上传（备选方案）

```bash
cd /www/wwwroot
git clone <你的仓库地址> hongyi
```

---

## 三、配置环境变量

### 3.1 创建 .env 文件

在宝塔面板「终端」中执行：

```bash
cat > /www/wwwroot/hongyi/apps/server/.env << 'EOF'
# ========================================
# 红艺AI花木平台 - 生产环境配置
# ========================================

# MongoDB 数据库连接
MONGODB_URI=mongodb://127.0.0.1:27017/hongyi

# JWT 密钥（请修改为随机字符串）
JWT_SECRET=hongyi-production-secret-change-this-to-random-string

# 服务端口
PORT=4000

# 运行环境
NODE_ENV=production
EOF
```

**重要：请务必修改 `JWT_SECRET` 为一个随机字符串！** 可以用以下命令生成：

```bash
openssl rand -hex 32
```

---

## 四、配置 Nginx 站点

### 4.1 在宝塔面板中添加站点

1. 进入宝塔面板「网站」
2. 点击「添加站点」
3. 域名填写：`106.53.112.26`（域名备案后可改为正式域名）
4. 选择「纯静态」（我们会手动配置反向代理）
5. 点击确定

### 4.2 修改 Nginx 配置

1. 在站点列表中找到刚创建的站点
2. 点击「设置」 -> 「配置文件」
3. 将 `deploy/nginx.conf` 的内容复制粘贴替换原有配置
4. 点击「保存」
5. 回到「软件商店」-> Nginx -> 「服务」-> 点击「重载配置」

---

## 五、执行部署

### 5.1 运行部署脚本

在宝塔面板「终端」中执行：

```bash
cd /www/wwwroot/hongyi/deploy
chmod +x deploy.sh
bash deploy.sh
```

脚本会自动执行以下步骤：
- 安装项目依赖
- 构建共享包
- 构建 Next.js 网站
- 导入种子数据
- 启动 PM2 进程

### 5.2 查看部署状态

```bash
pm2 status
```

应该看到两个应用：
- `hongyi-server` - 状态为 online
- `hongyi-website` - 状态为 online（2个实例）

---

## 六、验证部署

### 6.1 检查服务是否正常

```bash
# 检查 API 是否响应
curl http://127.0.0.1:4000/api

# 检查网站是否响应
curl http://127.0.0.1:3000

# 检查 Nginx 是否正常代理
curl http://106.53.112.26
curl http://106.53.112.26/api
```

### 6.2 在浏览器中访问

- 网站首页：http://106.53.112.26
- API 接口：http://106.53.112.26/api

### 6.3 查看日志排查问题

```bash
# 查看后端日志
pm2 logs hongyi-server

# 查看前端日志
pm2 logs hongyi-website

# 查看 Nginx 错误日志
tail -f /www/wwwlogs/hongyi.error.log

# 查看 MongoDB 状态
systemctl status mongod
```

---

## 七、.env 生产环境模板

```env
# ========================================
# 红艺AI花木平台 - 生产环境配置模板
# ========================================

# MongoDB 数据库连接地址
# 如果 MongoDB 设置了用户名密码，格式为：
# mongodb://用户名:密码@127.0.0.1:27017/hongyi?authSource=admin
MONGODB_URI=mongodb://127.0.0.1:27017/hongyi

# JWT 密钥（用于用户认证，必须修改为随机字符串）
JWT_SECRET=请替换为随机字符串

# Express 服务端口
PORT=4000

# 运行环境
NODE_ENV=production

# 腾讯云 COS 配置（如需使用图片上传功能）
# COS_SECRET_ID=your-secret-id
# COS_SECRET_KEY=your-secret-key
# COS_BUCKET=your-bucket-name
# COS_REGION=ap-guangzhou
```

---

## 八、常用运维命令

```bash
# 查看应用状态
pm2 status

# 重启所有应用
pm2 restart all

# 重启单个应用
pm2 restart hongyi-server
pm2 restart hongyi-website

# 查看实时日志
pm2 logs

# 查看监控面板
pm2 monit

# 停止所有应用
pm2 stop all

# 更新代码后重新部署
cd /www/wwwroot/hongyi/deploy
bash deploy.sh
```

---

## 九、常见问题

### Q: 网站无法访问？

1. 检查防火墙是否开放 80 端口（宝塔面板「安全」-> 放行端口 80）
2. 检查腾讯云安全组是否开放 80 端口
3. 检查 Nginx 是否运行：`nginx -t && systemctl status nginx`
4. 检查 PM2 应用状态：`pm2 status`

### Q: API 返回 502 错误？

1. 检查后端是否启动：`pm2 logs hongyi-server`
2. 检查 MongoDB 是否运行：`systemctl status mongod`
3. 检查 .env 配置是否正确

### Q: 构建失败？

1. 确认 Node.js 版本：`node -v`（需要 >= 18）
2. 删除 node_modules 重新安装：`rm -rf node_modules && npm install`
3. 检查磁盘空间：`df -h`

### Q: 域名备案后如何切换？

1. 修改 `deploy/nginx.conf` 中的 `server_name`，取消域名注释
2. 在宝塔面板中更新站点配置
3. 重载 Nginx 配置
