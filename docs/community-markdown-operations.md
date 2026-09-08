# 评论 Markdown 与文章引用（2026-09-08）

两站已上线，无数据库迁移，无需新增域名或重启 PM2。

## 使用

- 支持标题、粗体、斜体、删除线、引用、列表、任务列表、表格、链接、图片、行内代码和代码块。图片表情可以混排；代码里的表情标记保留原文。HTML 按文字显示，不执行；仅允许 HTTP/HTTPS/mailto 链接。
- 博客按留言板段落排版。主页聊天气泡缩小标题与间距，长代码/表格在内部滚动；回复摘要使用简短文字，防止撑大气泡。
- 在输入框输入单独的 `@`，或点「@ 文章」。搜索标题，点击文章直接引用；点击「小标题」后可以引用某个章节。发送后显示可点击的「文章标题」或「文章标题：小标题」，在新标签打开目标文章/锚点。800字限制不变，引用文本和URL计入长度。
- 引用使用普通 Markdown 链接保存，例如 `[@文章样式备忘录](https://blog.tonks.top/posts/writing-guide/)`。不改变现有公共留言区的分组规则。
- 颜文字分组已移除；直接输入颜文字仍可显示。现为8组、592项，其中517张图片。

## 文章目录

博客 `src/pages/community/articles.json.ts` 在构建时从 Astro 内容集合生成目录，使用实际 `post.slug` 与渲染后的 heading.slug；过滤草稿，加密文章不公开小标题。当前已上线22篇文章，全部锚点与线上HTML核验一致。

两站访问同源 `/community/articles.json`。Apache 配置片段 `scripts/apache-community-articles.inc` 已放到 `/etc/apache2/conf-available/tonks-community-articles.inc`，只被两个 HTTPS VirtualHost 引用，映射到 `/var/www/blog/community/articles.json`。以后正常构建和发布博客会同时更新目录，主页不必重新构建。清单读取失败可关闭选择器后重试。

## 摘要匹配

问题是 Astro 将目录首页的公开 slug 从 `writing-guide/index` 规范为 `writing-guide`，不是连字符失效。`src/utils/ai-summary.ts` 按公开slug、源文件ID（去扩展名）、旧的 `/index` 键依次匹配；现有 `ai-summaries.json` 不必改键。线上文章样式备忘录的摘要已经更新。

## 共享代码与验证

主页 `src/lib/community-{emojis,markdown,articles}` 为共享实现，`node scripts/sync-community-emojis.mjs` 同步到博客对应utils目录和表情资源，不执行部署。

Vue类型检查、70项源码测试、主页生产构建、隔离博客生产构建（含字体子集和Pagefind）通过。Edge实际验证两站桌面/390px移动端、文章与小标题引用、@触发、预览、HTML与危险URL、代码中的表情标记。线上HTTPS清单、资源、摘要验证通过。未向线上发送测试留言。博客有既有 ClarityApi 分析脚本错误，评论交互验证正常。

## 本次增量发布与回滚

备份：`/var/backups/tonks-rich-20260908-120749/`，含两个旧站点、Apache VirtualHost配置和旧表情清单。新哈希资源发布在前，HTML引用替换在后；博客仅替换43个HTML中的资源引用及文章样式备忘录的摘要，未发布本地无关文章改动。

需要回滚时恢复备份中的站点HTML、`default-ssl.conf` 和 `emoji-manifest.json` 到对应原路径，先执行 `apache2ctl configtest`，通过后 reload Apache。旧哈希资源仍在，不必删除新资源。此备份不包含数据库，本次也未改数据库。
