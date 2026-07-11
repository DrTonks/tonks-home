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

/**
 * 校验管理员密钥是否有效（登录前调用，不写入本地）。
 *
 * 后端没有独立的验证接口，所以用一个「无副作用」的管理请求探测：
 * 对一个不存在的日历事件发起 update（不携带任何可变字段）。
 * - 密钥错误 → { success:false, code:'not authorized' } → 返回 false
 * - 密钥正确 → 事件不存在时仅返回 code:'not found'（非 not authorized）→ 返回 true
 *
 * 为什么用 update 而不是 delete（fail-safe）：
 * 真实事件的 id 由后端生成的 UUID（如 79ada2ec-…），而探测用的
 * '__verify_admin_secret__' 不是 UUID，永不与真实 id 碰撞；且客户端无法
 * 通过 add 指定 id，因此不可能存在同名事件。即便退一万步真的碰撞了，
 * 这个 update 没有携带 name/date/type 任何字段，只是一次空更新，不会改动
 * 数据——而 delete 在碰撞时会真的删除。故 update 是更安全的探测方式。
 *
 * secret 显式拼进 URL，绕过请求拦截器（此时新密钥尚未写入 localStorage）。
 *
 * 注意：网络/超时等请求异常会向上抛出（不吞掉），以便调用方区分
 * 「密钥错误」与「网络故障」并给出不同提示。空密钥直接返回 false。
 */
export async function verifyAdminSecret(secret: string): Promise<boolean> {
  const trimmed = secret.trim()
  if (!trimmed) return false
  const { data } = await api.post(
    `/calendar/events?secret=${encodeURIComponent(trimmed)}`,
    { action: 'update', event: { id: '__verify_admin_secret__' } },
  )
  return data?.code !== 'not authorized'
}
