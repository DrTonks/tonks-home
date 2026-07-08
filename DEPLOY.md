# 部署指南

## 前置条件
- 服务器：8.137.145.5
- 后端：sleepy Flask 已运行在 9010 端口
- Web 服务器：Apache2（已启用 mod_proxy、mod_proxy_http、mod_rewrite）
- 本地：Node 20+ / pnpm

## 1. 本地构建

```bash
cd D:/myserver/tonks-home
pnpm install
pnpm build
```

构建产物在 `dist/` 目录，包含：
- `index.html`
- `assets/*.js`（已分包：vue-vendor / gsap-vendor / echarts-vendor / mediapipe-vendor / HomeView / index）
- `assets/*.css`
- `favicon.svg`
- `assets/avatar.jpg` / `avatar.gif`（头像资源）

## 2. 上传到服务器

```bash
# 在本地执行（需要服务器 SSH 访问权限）
scp -r dist/* user@8.137.145.5:/var/www/tonks-home/
```

或用 rsync 增量同步（推荐）：

```bash
rsync -avz --delete dist/ user@8.137.145.5:/var/www/tonks-home/
```

## 3. Apache2 配置

新建 `/etc/apache2/sites-available/tonks-home.conf`：

```apache
<VirtualHost *:80>
    ServerName tonks.top
    ServerAlias www.tonks.top
    DocumentRoot /var/www/tonks-home

    # 静态资源缓存
    <FilesMatch "\.(js|css|jpg|jpeg|png|gif|svg|ico|woff2?)$">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </FilesMatch>

    # API 反代到 sleepy 后端
    ProxyPreserveHost On

    # ★ 关键：允许 Range 请求穿透代理（音乐流/视频拖动必须）
    SetEnvIf Range "(.*)" Range-Header=$0
    RequestHeader set Range %{Range-Header}e env=Range-Header

    ProxyPass /api/ http://127.0.0.1:9010/
    ProxyPassReverse /api/ http://127.0.0.1:9010/

    # 图片接口（/images/<filename>）反代
    ProxyPass /images/ http://127.0.0.1:9010/images/
    ProxyPassReverse /images/ http://127.0.0.1:9010/images/

    # 音乐接口（/music/<filename>）反代 — 必须转发 Range
    <Location /music/>
        ProxyPass http://127.0.0.1:9010/music/
        ProxyPassReverse http://127.0.0.1:9010/music/
        RequestHeader set Range %{Range-Header}e env=Range-Header
    </Location>

    # SPA 路由 fallback：所有未匹配的路径返回 index.html
    <Directory /var/www/tonks-home>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/tonks-home_error.log
    CustomLog ${APACHE_LOG_DIR}/tonks-home_access.log combined
</VirtualHost>
```

## 4. 启用站点 + 模块

```bash
# 启用必要模块
sudo a2enmod proxy proxy_http rewrite headers

# 启用站点
sudo a2ensite tonks-home

# 测试配置
sudo apache2ctl configtest

# 重启 Apache2
sudo systemctl reload apache2
```

## 5. HTTPS（推荐）

```bash
# 申请 Let's Encrypt 证书
sudo certbot --apache -d tonks.top -d www.tonks.top

# certbot 会自动修改 Apache 配置，强制 HTTPS
```

## 6. 验证

```bash
# 检查首页
curl -I http://tonks.top/
# 期望：HTTP/1.1 200 OK

# 检查 API 反代
curl http://tonks.top/api/query
# 期望：返回 PC 当前状态 JSON

# 检查图片接口
curl -I http://tonks.top/images/projects/fc2026-1.jpg
# 期望：HTTP/1.1 200 OK + image/jpeg

# 浏览器访问
open http://tonks.top/
```

## 7. 更新部署

代码更新后：

```bash
# 本地
pnpm build
rsync -avz --delete dist/ user@8.137.145.5:/var/www/tonks-home/

# 服务器无需重启 Apache（静态资源）
# 但建议刷新浏览器缓存（Cache-Control 已设置 immutable）
```

## 排查

| 问题 | 检查 |
|------|------|
| 首页 404 | DocumentRoot 路径是否正确，index.html 是否存在 |
| API 502 | sleepy 服务是否运行 `systemctl status sleepy` |
| 图片 404 | ProxyPass /images/ 是否配置 |
| SPA 路由刷新 404 | RewriteRule 是否生效，AllowOverride All 是否设置 |
| 字体加载失败 | jsdelivr CDN 是否可达，或考虑本地化字体 |
| MediaPipe 加载失败 | storage.googleapis.com 是否可达，可换 jsdelivr 镜像 |

## 开发环境

```bash
pnpm dev
# 启动在 http://localhost:5173
# 自动代理 /api → http://127.0.0.1:9010
```

## 文件结构

```
tonks-home/
├── dist/                  # 构建产物（部署用）
├── src/
│   ├── api/              # API 封装
│   ├── components/       # 组件
│   │   ├── ui/          # shadcn-vue 基础组件
│   │   ├── layout/      # AvatarCore / BackgroundLayer
│   │   ├── auth/        # AdminAuth
│   │   ├── gesture/     # GestureToggle
│   │   ├── device/      # DeviceStatus
│   │   ├── music/       # MusicPlayer
│   │   ├── blog/        # BlogUpdates
│   │   ├── calendar/    # CalendarWidget
│   │   └── heatmap/     # ActivityHeatmap
│   ├── composables/      # 组合式函数
│   │   ├── useSpiralReveal.ts
│   │   ├── useParallax.ts
│   │   ├── useHandGesture.ts
│   │   └── useDevicePoll.ts
│   ├── stores/          # Pinia stores
│   ├── styles/          # tokens.css + index.css
│   ├── views/           # HomeView / NotFoundView
│   └── lib/utils.ts
├── public/assets/        # 头像图片
├── tailwind.config.ts
├── vite.config.ts
└── package.json
```
