# 表情清单来源

`owo.json` 是用户指定的公开示例清单快照（2026-09-08）：
https://github.com/LeeHero0803/leehenry-blog/blob/main/public/emotion/owo.json

快照保留颜文字、Emoji、Azukisan、Bilibili、Blobcat、2233；已移除 Weibo、ALu 的源声明。导入脚本仅导入 Emoji、Azukisan、Bilibili、Blobcat、2233，不导入颜文字或已移除分组，即使传入旧版上游清单也不会重新带回。原始资源地址保存在快照中；Bilibili 镜像失效后使用相同图片哈希对应的原始 hdslb CDN。

“老普专用”由用户提供，源文件在 `public/assets/emoji/`。这些文件独立于上述快照。

执行 `python scripts/prepare-community-emojis.py` 会提取图片 URL、校验光栅图片签名、下载到 `public/emojis/v1/` 并生成 `public/emojis/manifest.json`；不会将 OwO 的 HTML 插入留言。已有文件会复用，失败资源不进入选择器，失败清单在忽略的 `.tmp-emoji-download-failures.json`。

来源记录用于追溯；不将上游代码许可证视为第三方角色图片的统一授权声明。
