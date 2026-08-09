/**
 * useWeatherVisitor — 访客位置 + 天气数据层。
 *
 * 数据流：
 *   ip.sb（或 fallback /geoip）→ 获取客户端公网 IP 的 lat/lon
 *   → 心知天气 free API（now.json + daily.json）→ 获取天气 + 中文城市名
 *
 * 注意：用的是纯前端 HTTPS 请求到 ip.sb，不经过服务端代理，
 * 因此无论部署到哪里（云服务器 / CDN / 静态托管），定位的都是访客 IP。
 *
 * 心知天气免费版：
 *   - 私钥 SEFuPYYOQzfvLE_DK，作为 key 参数直传
 *   - 400 次/天，足够个人站使用
 *   - 支持坐标 lat:lon 格式，天气码 0-38
 *   - 返回中文城市名（如 "闽侯"），无需英→中映射
 *
 * 缓存策略：位置 12h，天气 1h。
 */

import { ref, type Ref } from 'vue'
import { usePetMemory } from './usePetMemory'

// ===== 心知天气 API Key（免费版，400次/天） =====
// 浏览器 Network 面板可见，免费 key 靠每日限额保护
const SENIVERSE_KEY = import.meta.env.VITE_SENIVERSE_KEY || 'SEFuPYYOQzfvLE_DK'

// ===== 类型 =====

export interface LocationData {
  city: string
  region: string
  country: string
  lat: number
  lon: number
  updated_at: string
}

export interface WeatherData {
  icon: WeatherIcon
  temp: number
  desc: string
  city: string
  /** 心知天气原始 weather code，用于对话类型判定 */
  weatherCode: number
  tomorrow: {
    icon: WeatherIcon
    tempMin: number
    tempMax: number
    desc: string
    weatherCode: number
  }
}

export type WeatherIcon = 'sunny' | 'partly-cloudy' | 'cloudy' | 'rain' | 'snow' | 'thunder' | 'fog' | 'shower'

// ===== 心知天气码 → 内部图标映射 =====
// 心知天气 V3 天气码表：https://seniverse.yuque.com/hyper_data/api_v3/format
//   0-1=晴, 2-3=晴(夜间), 4-5=多云/晴间多云, 6-8=多云/阴(夜间变种),
//   9=阴, 10=阵雨, 11-12=雷阵雨, 13-19=雨, 20-25=雪,
//   26-29=雨夹雪/沙尘, 30-32=浮尘/扬沙/沙尘暴,
//   33-38=霾, 99=未知
function seniverseCodeToIcon(code: number): WeatherIcon {
  if (code === 0 || code === 1) return 'sunny'
  if (code === 10) return 'shower'
  if (code === 11 || code === 12) return 'thunder'
  if (code >= 20 && code <= 25) return 'snow'
  if (code >= 30 && code <= 32) return 'fog'
  if (code >= 13 && code <= 19) return 'rain'
  // 夜间变种(2,3,6,7,8) / 多云(4,5) / 阴(9) / 雨夹雪(26-29) / 霾(33-38) / 未知(99)
  // 统一下方 cloudy
  // 4-5=多云/晴间多云 → 映射为 cloudy（与 partly-cloudly 区分，partly-cloudly 仅用于 WMO code 1）
  return 'cloudy'
}

/** 图标 → 对话句类型 key */
function iconToWeatherType(icon: WeatherIcon): string {
  if (icon === 'sunny') return 'sunny'
  if (icon === 'partly-cloudy') return 'partly_cloudy'
  if (icon === 'cloudy') return 'cloudy'
  if (icon === 'shower') return 'rain' // 阵雨归类到雨
  if (icon === 'rain') return 'rain'
  if (icon === 'snow') return 'snow'
  if (icon === 'thunder') return 'rain' // 雷暴归类到雨
  if (icon === 'fog') return 'cloudy'
  return 'default'
}

// ===== 缓存 keys =====
const LS_LOCATION = 'pet_location'
const LS_WEATHER = 'pet_weather_cache'
const LS_WEATHER_DAILY = 'weather_daily_shown'

// ===== 模块级单例 =====
let _locationData: Ref<LocationData | null> | null = null
let _weatherData: Ref<WeatherData | null> | null = null
let _initialized = false
let _initPromise: Promise<void> | null = null

class WeatherHttpError extends Error {
  constructor(
    readonly status: number,
    endpoint: 'now' | 'daily',
  ) {
    super(`Seniverse ${endpoint} returned ${status}`)
    this.name = 'WeatherHttpError'
  }
}

export function useWeatherVisitor() {
  if (!_locationData) _locationData = ref(loadCachedLocation())
  if (!_weatherData) _weatherData = ref(loadCachedWeather())
  const locationData = _locationData!
  const weatherData = _weatherData!

  // ===== 缓存读写 =====
  function loadCachedLocation(): LocationData | null {
    try {
      const raw = localStorage.getItem(LS_LOCATION)
      if (!raw) return null
      const data = JSON.parse(raw) as LocationData
      // 旧版位置缓存没有省份，无法组成稳定的“省份 + 城市”天气查询；自动失效一次。
      if (!data.region?.trim()) {
        localStorage.removeItem(LS_LOCATION)
        localStorage.removeItem(LS_WEATHER)
        return null
      }
      const age = Date.now() - new Date(data.updated_at).getTime()
      if (age > 12 * 60 * 60 * 1000) return null
      return data
    } catch { return null }
  }

  function saveCachedLocation(data: LocationData) {
    try { localStorage.setItem(LS_LOCATION, JSON.stringify(data)) } catch { /* ignore */ }
  }

  function loadCachedWeather(): WeatherData | null {
    try {
      const raw = localStorage.getItem(LS_WEATHER)
      if (!raw) return null
      const data = JSON.parse(raw)
      if (Date.now() - data._cachedAt > 60 * 60 * 1000) return null
      return data as WeatherData
    } catch { return null }
  }

  function saveCachedWeather(data: WeatherData) {
    try {
      localStorage.setItem(LS_WEATHER, JSON.stringify({ ...data, _cachedAt: Date.now() }))
    } catch { /* ignore */ }
  }

  // ===== API 调用 =====

  /**
   * 获取客户端公网 IP 对应的 lat/lon + 城市。
   *
   * 使用纯前端 HTTPS API（非服务端代理），确保无论部署到哪里都定位的是访客而非服务器。
   * 多层 fallback 保证可用性。
   */
  async function fetchLatLon(): Promise<{
    lat: number; lon: number; city?: string; region?: string; country?: string
  }> {
    const sources: Array<() => Promise<{
      lat: number; lon: number; city?: string; region?: string; country?: string
    }>> = [
      // 1) ip.sb — CORS OK, HTTPS, 全球节点, 返回 city/latitude/longitude
      async () => {
        const resp = await fetch('https://api.ip.sb/geoip', { signal: AbortSignal.timeout(5000) })
        if (!resp.ok) throw new Error(`${resp.status}`)
        const json = await resp.json()
        console.log('[useWeatherVisitor] ip.sb:', json)
        return {
          lat: json.latitude || 0,
          lon: json.longitude || 0,
          city: json.city || '',
          region: json.region || '',
          country: json.country_code || json.country || '',
        }
      },
      // 2) Vite proxy（仅开发环境可用；生产环境需 Nginx 透传 $remote_addr）
      async () => {
        const resp = await fetch('/geoip', { signal: AbortSignal.timeout(5000) })
        if (!resp.ok) throw new Error(`${resp.status}`)
        const json = await resp.json()
        console.log('[useWeatherVisitor] /geoip proxy:', json)
        return {
          lat: json.lat || 0,
          lon: json.lon || 0,
          city: json.city || json.regionName || '',
          region: json.regionName || '',
          country: json.country || '',
        }
      },
    ]

    for (const fn of sources) {
      try {
        return await fn()
      } catch (e) {
        console.warn('[useWeatherVisitor] IP 定位源失败，尝试下一个:', e)
      }
    }

    throw new Error('所有 IP 定位源均失败')
  }

  /** 心知天气实时天气（走代理路径，避免浏览器直连 403） */
  async function fetchSeniverseNow(location: string): Promise<{
    city: string; path: string
    text: string; code: string; temp: string
  }> {
    const url = `/seniverse/v3/weather/now.json?key=${SENIVERSE_KEY}&location=${encodeURIComponent(location)}&language=zh-Hans&unit=c`
    const resp = await fetch(url)
    if (!resp.ok) throw new WeatherHttpError(resp.status, 'now')
    const json = await resp.json()
    console.log('[useWeatherVisitor] 心知天气 now:', json)
    if (!json.results?.length) throw new Error('Seniverse now: empty results')
    const r = json.results[0]
    return { city: r.location.name, path: r.location.path, text: r.now.text, code: r.now.code, temp: r.now.temperature }
  }

  /** 心知天气每日预报（含明天，走代理路径） */
  async function fetchSeniverseDaily(location: string): Promise<{
    date: string; text_day: string; code_day: string; high: string; low: string
  }> {
    const url = `/seniverse/v3/weather/daily.json?key=${SENIVERSE_KEY}&location=${encodeURIComponent(location)}&language=zh-Hans&unit=c&start=0&days=2`
    const resp = await fetch(url)
    if (!resp.ok) throw new WeatherHttpError(resp.status, 'daily')
    const json = await resp.json()
    console.log('[useWeatherVisitor] 心知天气 daily:', json)
    if (!json.results?.length || !json.results[0].daily?.length) throw new Error('Seniverse daily: empty results')
    const d = json.results[0].daily[1] // index 1 = 明天
    return { date: d.date, text_day: d.text_day, code_day: d.code_day, high: d.high, low: d.low }
  }

  async function fetchLocation(): Promise<LocationData> {
    const geo = await fetchLatLon()
    return {
      city: geo.city || '未知城市',
      region: geo.region || '',
      country: geo.country || 'CN',
      lat: geo.lat,
      lon: geo.lon,
      updated_at: new Date().toISOString(),
    }
  }

  async function fetchWeather(location: LocationData): Promise<WeatherData> {
    const city = location.city.trim()
    const region = location.region.trim()
    const query = city && city !== '未知城市'
      ? [region, city].filter(Boolean).join(' ')
      : `${location.lat}:${location.lon}`
    const [now, daily] = await Promise.all([
      fetchSeniverseNow(query),
      fetchSeniverseDaily(query),
    ])

    const code = parseInt(now.code, 10) || 0
    const tomorrowCode = parseInt(daily.code_day, 10) || 0

    return {
      icon: seniverseCodeToIcon(code),
      temp: parseInt(now.temp, 10) || 0,
      desc: now.text,
      city: now.city,
      weatherCode: code,
      tomorrow: {
        icon: seniverseCodeToIcon(tomorrowCode),
        tempMin: parseInt(daily.low, 10) || 0,
        tempMax: parseInt(daily.high, 10) || 0,
        desc: daily.text_day,
        weatherCode: tomorrowCode,
      },
    }
  }

  // ===== 初始化 =====
  async function ensureLoaded(): Promise<void> {
    if (_initialized && weatherData.value) return
    if (_initPromise) return _initPromise

    _initPromise = (async () => {
      try {
        let loc = locationData.value
        if (!loc) {
          console.log('[useWeatherVisitor] 位置无缓存，请求中…')
          loc = await fetchLocation()
          locationData.value = loc
          saveCachedLocation(loc)
          console.log('[useWeatherVisitor] 位置结果:', loc)
        } else {
          console.log('[useWeatherVisitor] 使用缓存位置:', loc.city)
        }

        let w = weatherData.value
        if (!w) {
          console.log('[useWeatherVisitor] 天气无缓存，请求中…')
          w = await fetchWeather(loc)
          weatherData.value = w
          saveCachedWeather(w)
          // 用 心知天气 返回的中文城市名更新位置缓存
          if (w.city && w.city !== loc.city) {
            loc.city = w.city
            locationData.value = { ...loc }
            saveCachedLocation(loc)
          }
          console.log('[useWeatherVisitor] 天气结果:', w)
        } else {
          console.log('[useWeatherVisitor] 使用缓存天气:', w.desc, w.temp + '°C')
        }
      } catch (e) {
        if (e instanceof WeatherHttpError && e.status === 403) {
          locationData.value = null
          try {
            localStorage.removeItem(LS_LOCATION)
          } catch {
            /* ignore */
          }
          console.warn('[useWeatherVisitor] 天气返回 403，已清除位置缓存')
        }
        console.warn('[useWeatherVisitor] 获取失败:', e)
        _initPromise = null
      } finally {
        _initialized = true
      }
    })()

    return _initPromise
  }

  // ===== 位置变更检测 =====
  function hasLocationChanged(): boolean {
    const memory = usePetMemory()
    const prev = memory.getLocation()
    const cur = locationData.value
    if (!cur || !cur.city) return false
    if (!prev) { memory.saveLocation(cur); return false }
    if (prev.city !== cur.city || prev.country !== cur.country) {
      memory.saveLocation(cur)
      return true
    }
    return false
  }

  function getWeatherData(): WeatherData | null { return weatherData.value }
  function getLocationData(): LocationData | null { return locationData.value }

  // ===== 每日天气展示标记 =====
  function isDailyWeatherShown(): boolean {
    try {
      return localStorage.getItem(LS_WEATHER_DAILY) === new Date().toISOString().slice(0, 10)
    } catch { return false }
  }
  function markDailyWeatherShown(): void {
    try { localStorage.setItem(LS_WEATHER_DAILY, new Date().toISOString().slice(0, 10)) } catch { /* ignore */ }
  }

  // ===== 对话句选取 =====

  /** 只有"中性天气"才允许温度覆盖——雨/雪/雷暴等确定性天气保持自己的专属台词 */
  const NEUTRAL_ICONS = new Set<WeatherIcon>(['sunny', 'partly-cloudy', 'cloudy', 'fog'])

  function pickWeatherLine(weatherTalk?: Record<string, string[]>): string | null {
    if (!weatherTalk || !weatherData.value) return null
    const w = weatherData.value

    const iconType = iconToWeatherType(w.icon)
    let type: string

    // 极端温度 + 中性天气（晴/多云/雾）→ hot/cold 覆盖；雪/雨/雷暴不受影响
    if (w.temp >= 30 && NEUTRAL_ICONS.has(w.icon) && weatherTalk['hot']) {
      type = 'hot'
    } else if (w.temp <= 5 && NEUTRAL_ICONS.has(w.icon) && weatherTalk['cold']) {
      type = 'cold'
    } else {
      type = iconType
    }

    const lines = weatherTalk[type] || weatherTalk['default']
    if (!lines?.length) return null
    const line = lines[Math.floor(Math.random() * lines.length)]
    return line
      .replace(/\{\{city\}\}/g, w.city)
      .replace(/\{\{desc\}\}/g, w.desc)
      .replace(/\{\{temp\}\}/g, String(w.temp))
  }

  function pickLocationChangeLine(locationChange?: string[]): string | null {
    if (!locationChange?.length || !locationData.value) return null
    const line = locationChange[Math.floor(Math.random() * locationChange.length)]
    return line.replace(/\{\{city\}\}/g, locationData.value.city)
  }

  function pickWeatherCareLine(weatherTalk?: Record<string, string[]>): string {
    return pickWeatherLine(weatherTalk) || ''
  }

  return {
    locationData,
    weatherData,
    ensureLoaded,
    hasLocationChanged,
    getWeatherData,
    getLocationData,
    pickWeatherLine,
    pickLocationChangeLine,
    pickWeatherCareLine,
    isDailyWeatherShown,
    markDailyWeatherShown,
  }
}
