# 搜索与 Agent 访问

`src/config/public-profile.json` 为公开资料的唯一来源，首页名称与签名也从此读取。`scripts/search-artifacts.mjs` 在 dev 和 build 提供相同检索资源：robots.txt、sitemap.xml、llms.txt、index.md、agent/site.json，以及 404.html。初始 HTML 内含可阅读简介与真实导航链接；Vue 挂载后显示原互动应用，无 JS 则保留静态阅读。这不是整站 SSR，不请求后端生成 HTML，不区分爬虫 UA。

维护资料只改 JSON，不改 dist。`pnpm build` 包含搜索产物检查；`pnpm check:build` 同时校验资源。`pnpm test:search` 检查只读工具。安装配置、源码、测试和文档必须随本次提交一起保存。

WebMCP 是可选增强，检测 document.modelContext / 早期 navigator.modelContext。只注册 tonks_home_info 与 tonks_find_destinations：读取公开资料、返回目的链接，不自动导航、留言、投票、读取访客或设备/会话数据。不支持时无 polyfill、无轮询；不论是否支持，工具不需要网络请求。标准仍在演进，注册失败不阻止页面；升级浏览器 API 时集中维护 src/lib/agent-tools.ts。

## Apache 发布条件

此版本未部署。先本地确认，获批后再 pnpm ship。新的 public/.htaccess 需要 Apache 允许 FileInfo/Indexes 类型覆盖，mod_mime/mod_headers 生效；它禁用 FallbackResource 并使用 404.html。

若虚拟主机有更早执行的全站 RewriteRule，发布时必须调整：真实文件直接服务；未知路径返回 HTTP 404。主页有效内容路由只有 `/`，不要让 txt/xml/md/json 路径回退为首页 HTML 200。保留现有 `/api/`、`/images/`、`/music/` 和 `/community/` 的代理或 Alias。Vite preview 依然可能对不存在路径返回 SPA HTML，这不能替代 Apache 上的 HTTP 验证。

获批发布后运行（只读）：

```sh
node scripts/check-search-http.mjs https://tonks.top home
```

检查真实 robots/MIME/Sitemap/JSON/Markdown 与不存在资源的 404，再检查 JS 互动和无 JS 阅读。该脚本失败时不能宣称发布验收完成。完整两站浏览器测试位于 blogExample/scripts/test-search-browser.mjs，需同时启动两个本地 production preview。

现有 robots 允许抓取，不意味着允许访问私密接口，也不保证被 AI 引用。本次未改变训练/搜索爬虫的政策。静态 core HTML、metadata 与注册代码增加少量体积；普通用户不加载全文目录，不增加后端或轮询。

## 独立审查修复

生成器与 HTML 校验器共用转义规则，避免描述包含特殊字符或导航含多个查询参数时误阻断构建。新增 scripts/search-artifacts.test.ts 验证正确转义和缺失链接，已纳入 pnpm test:search。两项测试、完整构建与资源检查通过，子 agent 复审通过；修复没有客户端运行时开销。

公开资料修改后开发服务重启读取配置，生产需重新构建并部署。博客文章与项目目录由博客自身生成；主页的稳定导航无需随每篇新文章重新发布，也不代表后端最新动态接口已被本次静态导出接管。


## 2026-11-15 发布记录

用户明确批准后，先合入远程已有桌宠/公告更新，再通过 pnpm ship 完成构建、资源校验、上传校验和 HTML 发布。23 个测试文件、124 项测试通过（排除 .tmp 中的旧仓库快照）。

Apache `/etc/apache2/sites-enabled/default-ssl.conf` 中仅将 `/var/www/html` 旧的泛化 RewriteRule 改成 RewriteEngine Off；未知地址交给已部署 .htaccess 返回 404。其他虚拟主机以及 API、图片、音乐、community 代理或 Alias 保留。配置备份：`/root/apache-release-backups/default-ssl-search-20261115T023406Z.conf`。configtest 通过后平滑 reload，服务 active，没有 PM2 重启。

生产 check-search-http.mjs 已通过：公开文档返回正确 MIME，未知 txt 路径为真实 404。后续若增加正式前端路由，应显式配置这些路由，避免重新启用会吞掉所有未知资源的 fallback。


生产真实 Edge 回归通过：无 JS 核心内容可读，Vue 挂载和新版欢迎界面正常；普通访问 Agent 请求为 0，主页两项只读工具无网络请求。工具测试使用模拟支持接口，不等同于原生 Agent 客户端认证。

## 404 视觉回归修复（已发布：2026-11-15）

前次发布的简易静态 404 替代了原 NotFoundView 动画，属于用户体验回归。现在构建后的 404.html 从同一次构建的 index.html 提取应用脚本、样式和字体，加载原有 NotFoundView.vue，保留字效、星空和 15 秒返回逻辑；不复制组件或另做动画。错误文档保留 noindex，移除首页 canonical、分享元数据和 Person/WebSite 标记，无 JS 时提供黑底 404 和返回入口。等待错误路由就绪后再挂载，避免错误页面闪过首页加载界面。

Apache 继续使用 ErrorDocument 404 /404.html 和已关闭的泛化 fallback，无需恢复错误的 HTTP 200。开发模式 /404 继续走原 Vue 路由；生产 ErrorDocument 的 HTTP 状态要通过实际服务器或本地静态服务器夹具验证，Vite SPA 回退状态不能代替 Apache。

新增 scripts/test-404-browser.mjs 在本地静态服务器夹具上返回真实 404，并使用真实 Edge 验证直接/深层路径、无 JS、桌面/手机动画、手动返回、站内路由和自动返回。它验证构建产物，不能冒充生产 Apache 已验收。本轮 125 项测试、完整构建与资源校验通过，截图已检查；NotFoundView.vue 本身没有修改。上线后需执行本仓库加强后的 check-search-http.mjs，并在浏览器直接打开 /404 检查动画。

用户批准后，修复提交 59a28cf 已通过 pnpm ship 发布。生产 HTTP 检查及真实 Edge 验收通过：/404 与深层未知地址返回 404，桌面 1280px 和手机 390px 均显示原故障字效及 30 个星点，无 JS 回退可读，手动与 15 秒自动返回正常，脚本错误 0。本次不需要调整 Apache 或重启服务。

