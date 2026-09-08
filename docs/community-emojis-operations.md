# 留言与表情运维说明（2026-09-08）

前一轮主页、博客、Sleepy 后端和 Apache2 静态资源映射已部署。本地当前有后续UI返工和表情删减，尚未部署，必须等用户`pnpm dev`验收及明确许可；详见 [本地验收记录](community-local-review-2026-09-08.md)。

## 功能

- 天气数据源文字已移除。管理员可以置顶/取消，主页在群公告下展示而不调整聊天时间顺序，博客将置顶留言或回复提前且不重复。
- 群聊打开、切换房间后到最新消息；图片加载改变高度时跟随最新消息，手动上翻时保留位置。
- 分组、搜索、最近使用、输入预览、每批80项“加载更多”。图片保存为文字标记；主页、博客、回复引用、反馈消息和迁移来源安全渲染；未知标记保留原文，图片失效显示名称。

## 资源

本地六组：Emoji 75、老普专用8、2233 15、Bilibili 21、Azukisan 40、Blobcat 20。合计179项，其中104张图片。Weibo和ALu分组及本地相关图片已按要求移除；线上仍是上次发布的8组592项，待用户验收后才更新。颜文字分组已移除；源 Blobcat 一张图片无法下载，已排除，不保留坏图按钮。Markdown与文章引用见 [新增功能说明](community-markdown-operations.md)。

- 老普原图：`public/assets/emoji/`。
- 可发布资源：`public/emojis/v1/`、`public/emojis/manifest.json`。
- 原始公开清单与来源说明：`scripts/emoji-sources/`。
- 服务器：`/var/www/shared/emojis/`，独立于两个网站发布目录。
- 两端清单：https://tonks.top/emojis/manifest.json 、https://blog.tonks.top/emojis/manifest.json 。

Apache2 的两个 HTTPS VirtualHost 分别 Include `/etc/apache2/conf-available/tonks-community-emojis.inc`，将 `/emojis/` 映射到共享目录。片段本地副本为 `scripts/apache-community-emojis.inc`。不需要新域名、DNS 或额外 PM2 进程。配置关闭目录索引、CGI 和 .htaccess；图片长期缓存、清单缓存五分钟。

## 添加图片表情

1. 在版本化目录放入图片，例如 `public/emojis/v2/laopu/hello.jpg`。文件名使用英文、数字、短横线或下划线，支持 PNG/GIF/JPEG/WebP。
2. 在清单对应分组增加项目：

```json
{"token":":laopu:hello:","label":"打招呼","src":"/emojis/v2/laopu/hello.jpg"}
```

3. 上传新图片，再上传清单到共享目录。下次打开页面加载清单即可使用，不需要修改后端或重建前端。保持旧标记和旧图片地址可用。
4. 用 `node scripts/sync-community-emojis.mjs` 同步两端本地模块和资源。

`python scripts/prepare-community-emojis.py` 可重新导入原示例清单与老普JPG文件，校验并下载图片。该命令会重建清单；手工新增分组应同步维护导入脚本或另存来源，避免重导入时丢失。

## 三个月懒清理

- 软删除普通留言树时记录 `deleted_at`。历史记录没有删除时间，按首次迁移时间开始保留，不能按留言创建时间推断。
- 新普通留言、反馈聊天室留言、反馈回复、反馈主题入库成功后触发，数据库保证每个 UTC 日最多检查一次。
- 三个自然月，月末夹取有效日期；满期且整棵树均已删除才永久清理。
- 转为反馈或仍有反馈关联的数据保留；无保留引用的过期已删除反馈主题，其消息、来源和事件一起清理。
- 事务失败回滚，不影响已入库留言；日志只记各表删除数量。
- 管理的是数据库软删除记录，不清理独立备份文件，也不为每次清理另建备份。根树仍有已发布成员时，不单独清理其中已删除子树。

## 部署与回滚

后端目录 `/var/sleepy`，PM2 `sleepy-server` 已重启；`is_pinned`、`deleted_at`、每日清理元数据表已只读核验。

主页生产构建已发布。博客使用已提交版本叠加本次改动的隔离构建，只更新42份线上HTML中的两条留言资源URL，保留文章正文和旧缓存资源，未发布其它未提交文章修改。

回滚目录 `/var/backups/tonks-community-20260908/` 保存 Apache 配置、旧后端代码与前端文件，没有创建留言数据库备份。恢复代码后重启指定 PM2 进程；恢复 Apache 配置后先 configtest，再平滑重载。

## 验证

主页类型检查、构建和66项测试通过；后端34项社区测试通过。真实浏览器验证桌面与390px窄屏、图片插入/预览、2233与老普资源、群聊滚动；博客专项类型/编译及交互断言通过。线上HTTPS核验两端清单哈希一致、各8张老普图片正常、页面引用新资源；Apache `Syntax OK`。未发送真实测试留言。
