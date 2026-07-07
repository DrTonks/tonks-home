/**
 * Mock 拦截器 — 拦截 axios 请求返回 mock 数据
 * 启用方式：环境变量 VITE_MOCK=true 或在 .env.local 设置
 */
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { mockData } from './data'

const MOCK_ENABLED = import.meta.env.VITE_MOCK === 'true'

interface MockRoute {
  method: 'GET' | 'POST'
  pattern: RegExp
  handler: (config: AxiosRequestConfig) => unknown
}

const routes: MockRoute[] = [
  { method: 'GET', pattern: /^\/query/, handler: () => mockData.query },
  { method: 'GET', pattern: /^\/get\/status_list/, handler: () => mockData.statusList },
  { method: 'GET', pattern: /^\/online_count/, handler: () => mockData.onlineCount },
  { method: 'GET', pattern: /^\/agent-activity/, handler: () => mockData.agentActivity },
  { method: 'POST', pattern: /^\/agent-activity/, handler: () => ({ success: true, code: 'OK', count: 0 }) },
  { method: 'GET', pattern: /^\/blog-posts/, handler: () => mockData.blogPosts },
  { method: 'GET', pattern: /^\/music\/list/, handler: () => mockData.musicList },
  {
    method: 'POST',
    pattern: /^\/music\/upload/,
    handler: () => ({
      success: true,
      code: 'OK',
      file: { filename: 'mock_uploaded.mp3', title: '新上传', artist: 'Unknown' },
    }),
  },
  {
    method: 'POST',
    pattern: /^\/music\/delete/,
    handler: (config) => {
      const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
      return { success: true, code: 'OK', deleted: body?.filename || '' }
    },
  },
  { method: 'GET', pattern: /^\/calendar\/events/, handler: () => mockData.calendarEvents },
  {
    method: 'POST',
    pattern: /^\/calendar\/events/,
    handler: (config) => {
      const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
      if (body?.action === 'add') {
        return {
          success: true,
          code: 'OK',
          event: { id: `mock-${Date.now()}`, ...body.event },
        }
      }
      if (body?.action === 'delete') {
        return { success: true, code: 'OK', deleted: body.event?.id || body.id }
      }
      return { success: true, code: 'OK' }
    },
  },
  { method: 'GET', pattern: /^\/calendar\/holidays/, handler: () => mockData.calendarHolidays },
  { method: 'GET', pattern: /^\/github\/stats/, handler: () => mockData.githubStats },
]

function findRoute(method: string, url: string): MockRoute | undefined {
  const m = method.toUpperCase()
  return routes.find((r) => r.method === m && r.pattern.test(url))
}

export function setupMock(api: AxiosInstance) {
  if (!MOCK_ENABLED) return

  api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const url = (config.url || '').split('?')[0]
    const method = config.method || 'get'
    const route = findRoute(method, url)

    if (route) {
      const data = route.handler(config)
      console.log(`[Mock] ${method} ${url} →`, data)
      // 用自定义 adapter 直接返回 mock 数据，跳过真实请求
      config.adapter = () =>
        Promise.resolve<AxiosResponse>({
          data,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {},
        } as AxiosResponse)
    } else {
      console.warn(`[Mock] 未匹配: ${method} ${url}`)
    }

    return config
  })

  console.info('[Mock] 已启用 mock 拦截，所有 API 请求返回模拟数据')
}
