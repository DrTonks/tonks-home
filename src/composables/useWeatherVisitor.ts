/**
 * useWeatherVisitor — 访客位置 + 天气数据层。
 *
 * 数据流：同源 /api/weather → sleepy 从可信代理链取得访客公网 IP
 * → 服务端以显式 IP 请求心知天气 → 返回统一的城市、实时天气和明日预报。
 * API 私钥与访客 IP 均不会进入浏览器响应。
 *
 * 缓存策略：位置 12h，天气正常使用 1h；请求失败时最多保留 6h 的旧天气兜底。
 */

import { ref, type Ref } from 'vue'
import { usePetMemory } from './usePetMemory'

// ===== 类型 =====

export interface LocationData {
  city: string
  region: string
  country: string
  updated_at: string
  source: 'seniverse-ip'
  /** 兼容迁移前的本地缓存；新接口不再向浏览器返回经纬度。 */
  lat?: number
  lon?: number
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
  constructor(readonly status: number) {
    super(`Weather API returned ${status}`)
    this.name = 'WeatherHttpError'
  }
}

interface WeatherApiResponse {
  success: boolean
  location: {
    city: string
    region: string
    country: string
  }
  now: {
    text: string
    code: number
    temperature: number
  }
  tomorrow: {
    date: string
    text: string
    code: number
    low: number
    high: number
  }
  cached_at: string
  stale?: boolean
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
      // 旧链路使用 ip-api/ip.sb，迁移后强制刷新一次以免继续展示错误城市。
      if (data.source !== 'seniverse-ip' || !data.city?.trim()) {
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
      // 最多保留 6 小时旧数据；超过 1 小时时仍会请求刷新，失败才继续显示旧值。
      if (Date.now() - data._cachedAt > 6 * 60 * 60 * 1000) return null
      return data as WeatherData
    } catch { return null }
  }

  function hasFreshWeatherCache(): boolean {
    try {
      const raw = localStorage.getItem(LS_WEATHER)
      if (!raw) return false
      const data = JSON.parse(raw)
      return Number.isFinite(data._cachedAt)
        && Date.now() - data._cachedAt <= 60 * 60 * 1000
    } catch { return false }
  }

  function saveCachedWeather(data: WeatherData, cachedAt: string) {
    try {
      const timestamp = new Date(cachedAt).getTime()
      localStorage.setItem(LS_WEATHER, JSON.stringify({
        ...data,
        _cachedAt: Number.isFinite(timestamp) ? timestamp : Date.now(),
      }))
    } catch { /* ignore */ }
  }

  // ===== API 调用 =====

  function assertWeatherResponse(value: unknown): asserts value is WeatherApiResponse {
    const data = value as Partial<WeatherApiResponse> | null
    if (
      !data?.success
      || !data.location?.city
      || !data.now?.text
      || !Number.isFinite(data.now?.code)
      || !Number.isFinite(data.now?.temperature)
      || !data.tomorrow?.date
      || !data.tomorrow?.text
      || !Number.isFinite(data.tomorrow?.code)
      || !Number.isFinite(data.tomorrow?.low)
      || !Number.isFinite(data.tomorrow?.high)
      || !data.cached_at
    ) {
      throw new Error('天气接口返回了无效数据')
    }
  }

  async function fetchWeatherBundle(): Promise<{
    location: LocationData
    weather: WeatherData
    cachedAt: string
  }> {
    const resp = await fetch('/api/weather', {
      signal: AbortSignal.timeout(10_000),
    })
    if (!resp.ok) throw new WeatherHttpError(resp.status)
    const data: unknown = await resp.json()
    assertWeatherResponse(data)

    const code = data.now.code
    const tomorrowCode = data.tomorrow.code
    return {
      location: {
        city: data.location.city,
        region: data.location.region || '',
        country: data.location.country || '',
        updated_at: data.cached_at,
        source: 'seniverse-ip',
      },
      weather: {
        icon: seniverseCodeToIcon(code),
        temp: data.now.temperature,
        desc: data.now.text,
        city: data.location.city,
        weatherCode: code,
        tomorrow: {
          icon: seniverseCodeToIcon(tomorrowCode),
          tempMin: data.tomorrow.low,
          tempMax: data.tomorrow.high,
          desc: data.tomorrow.text,
          weatherCode: tomorrowCode,
        },
      },
      cachedAt: data.cached_at,
    }
  }

  // ===== 初始化 =====
  async function ensureLoaded(): Promise<void> {
    // 本次页面会话已经拿到可用天气（包括故障时保留的陈旧值）后不重复打接口。
    if (_initialized && weatherData.value) return
    if (_initPromise) return _initPromise

    _initPromise = (async () => {
      try {
        if (locationData.value && weatherData.value && hasFreshWeatherCache()) {
          console.log('[useWeatherVisitor] 使用缓存天气:', weatherData.value.desc, weatherData.value.temp + '°C')
          return
        }

        console.log('[useWeatherVisitor] 请求安全天气聚合接口…')
        const bundle = await fetchWeatherBundle()
        locationData.value = bundle.location
        weatherData.value = bundle.weather
        saveCachedLocation(bundle.location)
        saveCachedWeather(bundle.weather, bundle.cachedAt)
        console.log('[useWeatherVisitor] 位置结果:', bundle.location.city)
        console.log('[useWeatherVisitor] 天气结果:', bundle.weather)
      } catch (e) {
        // 保留最多 6 小时的旧天气。后端也会在心知短暂故障时返回陈旧缓存。
        console.warn('[useWeatherVisitor] 获取失败:', e)
      } finally {
        _initialized = true
        _initPromise = null
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
