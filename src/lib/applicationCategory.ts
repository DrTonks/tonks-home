export type ApplicationCategory =
  | 'AI'
  | 'APP'
  | 'BROWSE'
  | 'CHAT'
  | 'CODE'
  | 'GAME'
  | 'MEDIA'
  | 'NETWORK'
  | 'NOTE'
  | 'OFFICE'
  | 'OFFLINE'
  | 'SHELL'
  | 'SLEEP'
  | 'SYSTEM'
  | 'TRANSFER'

interface ApplicationCategoryRule {
  category: ApplicationCategory
  pattern: RegExp
}

// Rules are ordered deliberately: specific names such as QQ Music must be
// classified before broader names such as QQ.
const APPLICATION_CATEGORY_RULES: readonly ApplicationCategoryRule[] = [
  { category: 'MEDIA', pattern: /qq\s*音乐|qqmusic|music|照片|photos|obs studio/i },
  { category: 'AI', pattern: /chatgpt|claude|codex/i },
  {
    category: 'CODE',
    pattern: /vscode|visual studio code|github desktop|postman|electron应用开发/i,
  },
  { category: 'SHELL', pattern: /terminal|命令提示符|powershell|\bcmd\b/i },
  { category: 'BROWSE', pattern: /edge|chrome|firefox|浏览器/i },
  { category: 'OFFICE', pattern: /word|excel|powerpoint|ppt|wps/i },
  { category: 'NOTE', pattern: /typora|notion|obsidian|onenote|xmind|记事本/i },
  { category: 'GAME', pattern: /steam|游戏/i },
  { category: 'TRANSFER', pattern: /filezilla|onedrive|百度网盘/i },
  { category: 'NETWORK', pattern: /clash/i },
  { category: 'CHAT', pattern: /微信|wechat|(^|\s)qq($|\s)/i },
  {
    category: 'SYSTEM',
    pattern:
      /开始菜单|操作菜单|打开方式|搜索|运行时代理|系统设置|任务管理器|文件资源管理器|电脑-手机助手/i,
  },
]

export function getApplicationCategory(appName: string, color = ''): ApplicationCategory {
  const normalizedName = appName.trim()

  if (normalizedName === '关机中') return 'OFFLINE'
  if (color === 'sleeping' || /锁屏|睡眠状态/i.test(normalizedName)) return 'SLEEP'

  return (
    APPLICATION_CATEGORY_RULES.find((rule) => rule.pattern.test(normalizedName))?.category ?? 'APP'
  )
}
