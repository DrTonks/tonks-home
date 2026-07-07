/**
 * Mock 数据 — 模拟 sleepy 后端所有接口返回
 * 数据基于 D:\myserver\sleepy\API文档.md 的示例
 */

export const mockData = {
  // GET /query
  query: {
    success: true,
    status: 0,
    info: {
      id: 0,
      name: 'VSCode 编辑器',
      desc: '目前电脑正在使用的应用，大概率在玩手机摸鱼。',
      color: 'awake',
    },
    timestamp: Math.floor(Date.now() / 1000),
  },

  // GET /get/status_list
  statusList: [
    {
      id: 0,
      name: 'VSCode 编辑器',
      desc: '目前电脑正在使用的应用，大概率在玩手机摸鱼。',
      color: 'awake',
    },
    {
      id: 1,
      name: '似了',
      desc: '睡似了或其他原因不在线，紧急情况请使用电话联系。',
      color: 'sleeping',
    },
  ],

  // GET /online_count
  onlineCount: {
    success: true,
    online_count: 3,
    mobile_count: 1,
  },

  // GET /agent-activity
  agentActivity: {
    success: true,
    activities: generateAgentActivities(),
  },

  // GET /blog-posts
  blogPosts: {
    success: true,
    count: 3,
    posts: [
      {
        title: '贷款平台可视化数据大屏',
        link: 'https://blog.tonks.top/posts/dashboard/dash/',
        date: '2025-10-23T00:00:00.000Z',
        summary: '使用 three.js 与网上公开建模搭建的数据大屏，结合贷款平台业务场景实现可视化监控。',
      },
      {
        title: '金融学基础 - 通用计算器',
        link: 'https://blog.tonks.top/posts/calculator/calculator/',
        date: '2025-10-09T00:00:00.000Z',
        summary: '覆盖贷款、投资分析与项目评估的教学工具，集成多种金融公式。',
      },
      {
        title: 'Tonks 主页重构笔记',
        link: 'https://blog.tonks.top/posts/tonks-home/',
        date: '2026-07-01T00:00:00.000Z',
        summary: '从 old-vue 迁移到 Vue 3 + TS + Vite，记录天空薄荷配色与螺旋展开动画的实现。',
      },
    ],
    featuredProject: {
      id: 'career-planner-2026',
      title: '微光职引——职业规划智能体',
      description: '旨在让大学生快速了解当前就业市场，通过 AI 智能体提供个性化职业规划建议。',
      image: '', // 留空，组件会用兜底图标
      category: 'web',
      techStack: ['AI', 'LLM', '智能体'],
      status: 'in-progress',
      startDate: '2026-06-01',
      tags: ['服创', 'AI', '职业规划', '智能体'],
      award: '西部赛区一等奖',
      featured: true,
      links: [{ name: '预览', url: 'https://career-planner.tonks.top/', type: 'preview' }],
      images: [],
    },
    featuredTimeline: {
      id: '2026-06-career-planner',
      title: '第17届中国大学生服务外包创新创业大赛 - 微光职引',
      description: '参加第17届服创大赛【A13】赛题，开发职业规划智能体，最终获西部赛区一等奖晋级国赛。',
      type: 'achievement',
      startDate: '2026-06-01',
      icon: 'material-symbols:emoji-events',
      location: '四川 成都',
      organization: '中国大学生服务外包创新创业大赛',
      achievements: ['西部赛区一等奖 · 晋级国赛'],
      color: '#8DC4B0',
      links: [],
      images: [],
    },
  },

  // GET /music/list
  musicList: {
    success: true,
    music: [
      { filename: 'mock_song_1.mp3', title: '晴天', artist: '周杰伦' },
      { filename: 'mock_song_2.mp3', title: '夜的钢琴曲', artist: '石进' },
      { filename: 'mock_song_3.mp3', title: '稻香', artist: '周杰伦' },
    ],
  },

  // GET /calendar/events
  calendarEvents: {
    success: true,
    events: generateCalendarEvents(),
  },

  // GET /calendar/holidays
  calendarHolidays: {
    success: true,
    year: new Date().getFullYear(),
    country: 'CN',
    publicHolidays: [
      { date: `${new Date().getFullYear()}-01-01`, name: '元旦', countryCode: 'CN' },
      { date: `${new Date().getFullYear()}-02-17`, name: '春节', countryCode: 'CN' },
      { date: `${new Date().getFullYear()}-05-01`, name: '劳动节', countryCode: 'CN' },
      { date: `${new Date().getFullYear()}-06-19`, name: '端午节', countryCode: 'CN' },
      { date: `${new Date().getFullYear()}-09-25`, name: '中秋节', countryCode: 'CN' },
      { date: `${new Date().getFullYear()}-10-01`, name: '国庆节', countryCode: 'CN' },
    ],
    customHolidays: [],
  },

  // GET /github/stats
  githubStats: {
    success: true,
    username: 'DrTonks',
    totalContributions: 1287,
    days: generateGithubDays(),
    topLanguages: [
      { name: 'Vue', color: '#41b883', stars: 12 },
      { name: 'TypeScript', color: '#3178c6', stars: 9 },
      { name: 'Python', color: '#3572A5', stars: 7 },
      { name: 'JavaScript', color: '#f1e05a', stars: 5 },
      { name: 'CSS', color: '#563d7c', stars: 3 },
    ],
  },
}

// 生成 365 天的 Agent 活动数据
function generateAgentActivities() {
  const activities = []
  const today = new Date()
  for (let i = 150; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const isWeekend = d.getDay() === 0 || d.getDay() === 6
    const rand = Math.random()
    let intensity: 0 | 1 | 2 | 3 | 4
    if (isWeekend) {
      intensity = rand < 0.3 ? 0 : rand < 0.55 ? 1 : rand < 0.75 ? 2 : rand < 0.9 ? 3 : 4
    } else {
      intensity = rand < 0.10 ? 0 : rand < 0.30 ? 1 : rand < 0.50 ? 2 : rand < 0.70 ? 3 : 4
    }
    // 几乎不跳过，只跳过 10% 的 level 0
    if (intensity === 0 && Math.random() < 0.1) continue
    const messageCount = intensity * 60 + Math.floor(Math.random() * 80)
    activities.push({
      date: `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d
        .getDate()
        .toString()
        .padStart(2, '0')}`,
      messageCount,
      sessionCount: Math.max(1, Math.floor(messageCount / 40)),
      toolCallCount: messageCount * 3 + Math.floor(Math.random() * 200),
      intensity,
    })
  }
  return activities
}

// 生成 150 天的 GitHub 贡献数据（密集可见）
function generateGithubDays() {
  const days = []
  const today = new Date()
  for (let i = 150; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const rand = Math.random()
    let level: 0 | 1 | 2 | 3 | 4
    let count: number
    if (rand < 0.2) {
      level = 0; count = 0
    } else if (rand < 0.45) {
      level = 1; count = Math.floor(Math.random() * 3) + 1
    } else if (rand < 0.70) {
      level = 2; count = Math.floor(Math.random() * 5) + 3
    } else if (rand < 0.88) {
      level = 3; count = Math.floor(Math.random() * 8) + 8
    } else {
      level = 4
      count = Math.floor(Math.random() * 15) + 16
    }
    days.push({
      date: `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d
        .getDate()
        .toString()
        .padStart(2, '0')}`,
      count,
      level,
    })
  }
  return days
}

// 生成本月日历事件
function generateCalendarEvents() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const events = []
  // 本月 15 号 - 项目截止
  events.push({
    id: 'mock-1',
    date: `${y}-${(m + 1).toString().padStart(2, '0')}-15`,
    name: '项目截止日',
    type: 'work',
  })
  // 本月 20 号 - 朋友生日
  events.push({
    id: 'mock-2',
    date: `${y}-${(m + 1).toString().padStart(2, '0')}-20`,
    name: '朋友生日',
    type: 'personal',
  })
  // 下月 1 号 - 团队 outing
  const nextMonth = new Date(y, m + 1, 1)
  events.push({
    id: 'mock-3',
    date: `${nextMonth.getFullYear()}-${(nextMonth.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-01`,
    name: '团队 outing',
    type: 'personal',
  })
  // 今天 - 当前进行中
  events.push({
    id: 'mock-today',
    date: `${y}-${(m + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`,
    name: 'Tonks 主页微调',
    type: 'work',
  })
  return events
}
