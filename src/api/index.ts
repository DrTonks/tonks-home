import axios, { type AxiosInstance, type AxiosError } from 'axios'

/**
 * 后端基础 URL
 * - 开发环境：vite proxy 转发 /api → http://127.0.0.1:9010
 * - 生产环境：Apache2 ProxyPass /api/ → http://127.0.0.1:9010/
 * 统一用 /api 前缀，避免硬编码域名
 */
const BASE_URL = '/api'

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器：自动附加管理员密钥（如果有且 URL 中未携带）
api.interceptors.request.use((config) => {
  const secret = localStorage.getItem('admin_secret')
  if (secret && config.url && !/[?&]secret=/.test(config.url)) {
    const sep = config.url.includes('?') ? '&' : '?'
    config.url = `${config.url}${sep}secret=${secret}`
  }
  return config
})

// 响应拦截器：统一错误处理
api.interceptors.response.use(
  (response) => {
    const data = response.data
    if (data && data.success === false) {
      console.warn(`[API ${data.code}] ${data.message}`)
    }
    return response
  },
  (error: AxiosError) => {
    if (error.code === 'ECONNABORTED') {
      console.error('[API] 请求超时')
    } else if (!error.response) {
      console.error('[API] 网络错误:', error.message)
    } else {
      console.error(`[API] HTTP ${error.response.status}`)
    }
    return Promise.reject(error)
  },
)

/**
 * 获取管理员密钥（用于需要认证的请求）
 */
export function getAdminSecret(): string {
  return localStorage.getItem('admin_secret') || ''
}

/**
 * 设置管理员密钥（登录后调用）
 */
export function setAdminSecret(secret: string): void {
  localStorage.setItem('admin_secret', secret)
}

/**
 * 清除管理员密钥（退出登录）
 */
export function clearAdminSecret(): void {
  localStorage.removeItem('admin_secret')
}
