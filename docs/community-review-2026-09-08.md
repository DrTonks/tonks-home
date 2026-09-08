# 留言系统改动审查与提交报告

> 这是修复前的历史审查快照。后续修复、多轮独立复审、发布结果和当前Git建议见 [最新修复与复审报告](community-fixes-2026-09-08.md)。下文“尚未修复”等表述只描述最初审查时状态。

审查日期：2026-09-08。范围覆盖主页、博客、Sleepy 后端及 Apache2/PM2 云端部署。审查中不提交 Git、不修改服务器状态。

**结论：业务功能已经上线，但尚未达到“审查无待办”的状态。三位子 agent 确认10项本次改动相关问题：8项P2、2项P3；另有2项既有环境/交互问题。审查覆盖范围内未确认P0/P1，但不代表不存在未覆盖风险。上述问题均尚未修复。三个仓库均未暂存、未提交。**

优先处理云端共享图片和回滚备份权限（F4/F5），再修复Markdown实体、断网重试、反馈交互和显示问题。下面的提交文案描述已实现功能，不能据此写成“所有审查通过”。

## 当前进度

| 模块 | 已完成内容 | 发布状态 |
| --- | --- | --- |
| 主页 | 天气来源文字移除；评论置顶侧栏与标记；打开群聊定位最新消息；分组图片表情；紧凑 Markdown；文章/小标题引用 | 已上线；反馈场景与引用摘要有待修复项 |
| 博客 | 置顶优先；分组图片表情；Markdown 评论及预览；文章/小标题引用；目录首页 AI 摘要匹配修复；构建时生成文章索引 | 已上线；实体解析、表情重试、预览样式待修复 |
| 后端 | 管理员置顶接口；最近300条窗口补齐置顶与父链；删除时间迁移；三自然月懒清理 | 已上线，线上源码与本地一致；清理成功日志待修复 |
| 云端 | Apache 两站共享表情目录与文章索引；保留发布前备份；PM2 托管原后端 | 服务正常；共享图片和第二份备份权限待收紧 |

图片表情现为8组、592项，其中517张图片；“老普专用”8张，颜文字独立分组已去除。文章索引目前包含22篇文章，支持实际小标题锚点。Markdown/@引用沿用留言原文存储，本轮无需额外数据库字段。

## 审查结果

三位子 agent 已完成独立审查，父 agent 已核对定位并合并重复发现。本轮仅审查，以下缺陷尚未修复，线上也仍存在对应实现。P2表示应修复的一般缺陷，P3表示较低优先级的显示问题；既有问题单列，不算本次引入。浏览器缺陷以本地隔离复现为证据，未将每一项在生产浏览器中再次复现。

### F1 · P2 · 两站 Markdown 实体未解码

位置：[主页 community-markdown.ts:34](D:/myserver/tonks-home/src/lib/community-markdown.ts:34)、[博客 community-markdown.ts:34](D:/myserver/blogExample/src/utils/community-markdown.ts:34)，链接地址处理在同文件51行。

复现：`&amp; &#x41;` 显示为原始字符串，而不是 `& A`；`[link](https://example.com/?a=1&amp;b=2)` 生成的地址保留 `amp;b` 参数名。共享渲染直接将 lexer 的实体文本交给 DOM，未执行 Markdown 实体解码。影响正文、复制自HTML的链接和带实体的文章标题显示。应解码文本及URL，并在解码URL之后再次校验协议。子 agent 已在隔离 Edge 中复现。

### F2 · P2 · 博客表情清单首次失败后没有重试入口

位置：[blog-community.ts:105](D:/myserver/blogExample/src/utils/blog-community.ts:105)、[blog-community.ts:197](D:/myserver/blogExample/src/utils/blog-community.ts:197)。

复现：编辑器初始化时断网，恢复网络后重复关闭/打开表情面板，请求次数仍为1；扩展分组不会恢复，需刷新页面或重新创建编辑器。面板打开只执行 `refresh()`，实际加载仅在挂载时调用。应在打开时调用可重试的清单加载函数。子 agent 已模拟失败请求并在隔离 Edge 中复现。

### F3 · P3 · 博客预览正文粗体被标题样式缩小

位置：[CommunityComments.astro:151](D:/myserver/blogExample/src/components/community/CommunityComments.astro:151)。

复现：输入 `ordinary **bold**`，普通文字13.12px，粗体变成10.88px且透明度0.65。选择器 `.community-comment-preview strong` 同时作用于“预览”标题和用户正文。应只选择标题节点，例如直接子级。子 agent 已实测该样式规则；这是预览与实际留言表现不一致的问题。

### F4 · P2 · 云端共享图片为所有本机用户可写

位置：`/var/www/shared/emojis/v1/`。子 agent 只读核验发现全部517张图片为 `0666`，并确认 `www-data` 可以写入，例如 `laopu/angry.jpg`。Web用户不需要修改静态图片；目前其他本机服务进程可污染两站共用资源，一年 immutable 缓存会延长污染影响。

建议保留部署账户所有权，将图片设为 `0644`、资源目录设为 `0755`。这是服务器文件权限修复，不能仅靠 Git 提交文本文件完成。本轮未执行 chmod。

### F5 · P2 · 第二份云端回滚备份可被非管理员进程污染

位置：`/var/backups/tonks-rich-20260908-120749/`。顶层目录为 `0755`，内部454个文件为 `0666`；已确认 `www-data` 可写备份中的 `emoji-manifest.json`。因此这份回滚副本缺少独立写保护。第一份备份顶层为 `0700`，没有相同的可访问条件。

建议备份目录仅允许管理员访问（如目录 `0700`、文件 `0600`，保持管理员所有权），并核对备份内容是否仍与创建时一致。本轮只检查权限，没有执行恢复或改权限。

### F6 · P2 · 默认日志级别屏蔽清理成功计数

位置：[community.py:795](D:/myserver/sleepy/community.py:795)、[test_community.py:335](D:/myserver/sleepy/tests/test_community.py:335)。清理成功使用 INFO 日志，但隔离导入实际根日志级别为 WARNING，`community.isEnabledFor(INFO)=False`；线上启动代码未配置该日志级别。测试中的 `assertLogs(..., INFO)` 临时打开日志，不能证明正常进程会记录清理计数。

建议显式配置社区模块的INFO日志输出，并增加不依赖 `assertLogs` 临时提升级别的启动配置验证。该问题由本地模拟环境确认；本轮没有为验证日志而触发线上物理清理。

### F7 · P2 · 反馈卡片的表情面板越界并被裁切

位置：[CommunityEmojiPicker.vue:34](D:/myserver/tonks-home/src/components/blog/CommunityEmojiPicker.vue:34)、[CommunityFeedbackChatRoom.vue:618](D:/myserver/tonks-home/src/components/blog/CommunityFeedbackChatRoom.vue:618)。

复现：900px宽视口，打开“发送反馈卡片”并点击卡片编辑器表情按钮。面板固定向右展开，实测右边界940.55px，关闭按钮中心918.70px，命中测试为空；右侧内容和关闭按钮不可用。390px下该入口未复现同样越界，因此仅检查手机宽度不能覆盖此问题。建议使用具备视口避让的浮层定位并处理祖先裁切。

### F8 · P2 · 反馈消息异步图片加载后丢失底部跟随

位置：[CommunityFeedbackChatRoom.vue:110](D:/myserver/tonks-home/src/components/blog/CommunityFeedbackChatRoom.vue:110)、[community-markdown.ts:58](D:/myserver/tonks-home/src/lib/community-markdown.ts:58)。

复现：用户在最新反馈消息底部，消息包含延迟加载图片。加载前距底部0px，加载后163px，scrollTop未变化。反馈组件仍只监听消息/主题数量及筛选，未像普通聊天一样观察内容尺寸；本次加入异步图片后出现集成缺陷。建议仅在用户处于底部跟随状态时响应图片/内容尺寸变化，用户上翻时保留位置。

### F9 · P2 · 反馈卡片内链接同时触发打开反馈详情

位置：[CommunityFeedbackChatRoom.vue:543](D:/myserver/tonks-home/src/components/blog/CommunityFeedbackChatRoom.vue:543)，外层点击处理在533行。

复现：反馈首条内容含文章引用，点击卡片摘要内链接；打开文章的同时，当前页面的反馈详情层由0个变为1个。普通Markdown链接同样受影响。新增链接嵌在可点击卡片按钮内且继续冒泡。建议将卡片导航与链接交互分离，避免交互元素嵌套，或将卡片摘要保持为非交互预览。

### F10 · P3 · 回复摘要不随表情清单加载完成更新

位置：[CommunityMessageBubble.vue:33](D:/myserver/tonks-home/src/components/blog/CommunityMessageBubble.vue:33)。

复现：首次进入，父消息使用ALu等非内置表情，回复先于完整表情清单渲染。清单加载后正文的对应图片/标签已可用，引用仍显示 `:alu:08306e5dbe9b3258:`。`quotedContent` 只依赖props，不订阅清单版本变化。建议像其他渲染路径一样订阅清单更新并在卸载时清理。

### E1 · P2 · 既有环境问题：社区数据库对 Web 用户可读

位置：`/var/sleepy/community.sqlite3`，权限 `0644`。只读权限检查确认 `www-data` 具有读取权限，schema含邮箱和身份字段。建议数据库仅对实际运行 Sleepy 的账户开放，并兼顾SQLite的WAL/SHM文件权限。

**未发现 HTTP 可下载数据库的证据，也无法确认此权限由本次部署引入。** 因此它作为既有环境待办，单独于本次新增缺陷计数。

### E2 · 既有交互问题：反馈用户上翻后新消息仍会强制滚到底部

位置同 [CommunityFeedbackChatRoom.vue:110](D:/myserver/tonks-home/src/components/blog/CommunityFeedbackChatRoom.vue:110)。子 agent 与HEAD比较确认数量监听逻辑未在本次修改，故不计入新增问题。可在处理F8的底部跟随状态时一起解决，但提交说明应区分新增图片适配与原有滚动行为修复。

## 本次复核

- 主页 `vue-tsc -b` 通过。
- 主页 `vitest run src`：15个测试文件、70项测试通过。
- 两端5份共享 TS/CSS 文件 SHA-256 一致，表情清单完全一致。
- 后端隔离模拟数据测试：34项社区测试通过。
- 三仓库本任务已跟踪代码的 `git diff --check` 通过；只有换行格式提示。
- 前一轮已完成主页生产构建、隔离博客构建（Astro/字体子集/Pagefind）、Edge桌面与390px移动端交互验证、线上HTTPS资源/摘要/锚点验证。本次审查不把历史验证写成重新执行。

### 独立审查分工与边界

| 审查者 | 范围 | 证据与限制 |
| --- | --- | --- |
| Singer | 主页差异、新Vue组件、共享模块、脚本与配置片段 | 使用真实Vue/Tailwind的隔离Edge页面复现F7–F10；文章弹层卸载数量1→0；逐项核验517张图片文件头。未做完整主页E2E、真实移动软键盘或线上写接口 |
| Schrodinger | 博客评论、置顶、Markdown/@、索引与摘要 | 隔离Edge复现F1–F3，原始HTML/javascript样例未执行，摘要fallback及基本引用插入/清理通过。未重跑完整Astro构建、整页Swup往返、移动输入法 |
| Heisenberg | Sleepy后端及云服务器 | 隔离34项测试、只读SSH/SQLite/权限与HTTP核验；确认F4–F6及E1。未触发线上清理、写接口或实际回滚，未直接比对进程内存代码 |

没有把“未发现其他问题”当成完整安全保证。当前测试缺少上述异常网络、实体解码、中等宽度浮层和延迟图片场景，需要在修复时补充针对性回归。

## Git 范围与建议

审查开始时三个仓库均在 `main`，均无暂存内容：主页 HEAD `aafee9e`，博客 HEAD `c3fb549`，后端 HEAD `020c724`。以下为按仓库划分的提交建议；是否可作为稳定版本提交，以最终审查结论为准。

本次审查新增的是这份报告，没有修复上述业务代码或云端权限，也没有创建Git提交。若要提交当前进展，提交说明应如实标注已上线功能及已知问题；若要提交作为稳定版本，建议先处理F4/F5权限，再修复功能缺陷并复测。推荐按后端、主页、博客三个仓库分别提交，天气小改动可再拆为第四个提交。

### 主页：D:/myserver/tonks-home

建议标题：

```text
feat(community): 支持置顶、图片表情、Markdown 和文章引用
```

建议正文：

```text
在群公告下展示置顶留言，聊天记录保持时间顺序；修复进入房间后的最新消息定位。
新增分组图片表情、搜索、最近使用与预览，包含老普专用，移除颜文字分组。
加入紧凑 Markdown 和文章/小标题引用，提供共享资源同步脚本及 Apache 配置片段。

验证：Vue 类型检查、70项源码测试、生产构建、桌面与移动端浏览器检查。
```

提交范围：`src/api/community.ts`；`src/components/blog/Community{ChatWorkspace,FeedbackChatRoom,MessageBubble,ArticleButton,EmojiButton,EmojiPicker,EmojiText}.vue`；`src/lib/community-{emojis,articles,markdown}` 对应源码、样式与测试；`public/emojis/`；`package.json`/`pnpm-lock.yaml`；`.gitignore`；表情导入/同步脚本、`scripts/emoji-sources/`、两个 Apache `.inc` 文件及运维文档。

天气改动可独立提交：`fix(weather): 移除天气来源展示`，文件为 `src/components/layout/pet/WeatherBubble.vue`。

`public/emojis/` 包含517个图片文件与1份清单，约3.17MB。`scripts/deploy.js` 和 `scripts/deploy.config.json` 按现有规则忽略，不属于本次提交清单。`.planning/`、`.tmp*`、构建产物不提交。

### 博客：D:/myserver/blogExample

建议标题：

```text
feat(comments): 支持富文本和文章引用并修复目录页摘要匹配
```

建议正文：

```text
评论支持置顶、分组图片表情、Markdown 渲染和输入预览。
新增文章与小标题选择器，构建时输出文章目录供两站共用。
兼容公开 slug、源文件 ID 和旧 /index 摘要键，修复文章样式备忘录摘要。

验证：隔离生产构建、桌面与移动端交互、线上摘要和文章锚点检查。
```

本次提交范围：

- `src/components/community/CommunityComments.astro`
- `src/utils/blog-community.ts`
- `src/utils/community-emojis.ts`
- `src/utils/community-markdown.ts`、`src/utils/community-markdown.css`
- `src/utils/community-articles.ts`、`src/utils/community-articles.css`
- `src/utils/ai-summary.ts`
- `src/pages/posts/[...slug].astro`
- `src/pages/community/articles.json.ts`
- `public/emojis/`（517张图片与1份清单）

**不要把现有 `src/content/posts/**` 和 `src/utils/category-icons.ts` 混入此功能提交。** 它们属于本任务开始前已有修改，包括 `src/content/posts/writing-guide/index.md`。本次摘要修复改的是页面匹配逻辑，不是文章正文，也没有修改 `src/content/ai-summaries.json`。因此不建议在博客仓库直接 `git add .`。

### 后端：D:/myserver/sleepy

建议标题：

```text
feat(community): 增加留言置顶及三个月软删除数据懒清理
```

建议正文：

```text
增加管理员置顶接口和 is_pinned 字段，返回最新留言窗口并补齐置顶与父链。
迁移 deleted_at；新留言成功后每天最多清理一次超过三个自然月的已删除留言树。
保留反馈关联数据，清理失败不影响新留言入库，补充 API 文档及回归测试。
```

提交范围：`community.py`、`server.py`、`tests/test_community.py`、`API文档.md`。

## 云端变更台账

| 云端对象 | 当前状态及本次只读核验 |
| --- | --- |
| `/var/sleepy/community.py`、`server.py` | 两文件SHA-256均与本地一致 |
| PM2 `sleepy-server` | online；启动时间晚于代码更新时间，未直接比对进程内存中的代码 |
| `community.sqlite3` | 只读连接确认 `is_pinned`、`deleted_at` 和清理元数据表；完整性/外键检查通过；每日清理标记尚为空 |
| Apache2 | `apache2ctl configtest` 返回 Syntax OK；两个 include 只在主页、博客的目标HTTPS VirtualHost中启用 |
| `/emojis/` | 映射 `/var/www/shared/emojis/`；两站清单200且哈希一致；517张图片文件齐全，抽样HTTPS正常；目录浏览403；权限问题见F4 |
| `/community/articles.json` | 指向 `/var/www/blog/community/articles.json`；博客实际 Cache-Control 为 `no-cache`，主页为300秒。此前文档统一写五分钟不完全准确，这是现有响应头覆盖差异 |
| `/var/www/html` | 主页生产构建已发布 |
| `/var/www/blog` | 本轮富文本发布增量替换43份HTML中的5个资源引用，仅对文章样式备忘录修改摘要节点；未覆盖用户未提交文章正文 |
| `/var/backups/tonks-community-20260908/` | 第一轮发布前备份，包含旧前端、后端代码和Apache配置；顶层0700 |
| `/var/backups/tonks-rich-20260908-120749/` | 第二轮发布前备份，包含旧站点、VirtualHost和旧表情清单；权限问题见F5 |

两份备份HTML中引用的根路径JS/CSS文件当前仍存在。没有进行实际回滚演练。备份不包含留言数据库；已接受的三个月物理删除不能靠恢复代码和配置撤销。

本轮云端操作全部只读：没有重启/重载服务、修改配置或权限、写留言、触发懒清理。未逐张HTTP请求全部517张图片，也未测试线上写接口。

服务器实际配置和文件权限不属于三个Git仓库。两个Apache配置片段的本地副本、操作说明可以随主页提交，但 Include 激活、文件权限、PM2运行状态、备份目录需要作为部署记录另行管理。
