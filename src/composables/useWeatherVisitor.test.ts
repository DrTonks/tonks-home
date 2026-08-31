import { beforeEach, describe, expect, it, vi } from 'vitest'

function createStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function weatherApiResponse() {
  return {
    success: true,
    location: {
      id: 'WT7W3R63DQMH',
      city: '福州',
      region: '福建',
      country: 'CN',
      path: '福州,福建,中国',
      timezone: 'Asia/Shanghai',
    },
    now: { text: '晴', code: 0, temperature: 26 },
    tomorrow: {
      date: '2026-09-01',
      text: '多云',
      code: 4,
      low: 23,
      high: 30,
    },
    cached_at: new Date().toISOString(),
    stale: false,
  }
}

function cacheLocation(source: 'seniverse-ip' | null = 'seniverse-ip') {
  localStorage.setItem('pet_location', JSON.stringify({
    city: '福州',
    region: '福建',
    country: 'CN',
    ...(source ? { source } : { lat: 26.08, lon: 119.3 }),
    updated_at: new Date().toISOString(),
  }))
}

function cacheWeather(ageMs = 0) {
  localStorage.setItem('pet_weather_cache', JSON.stringify({
    icon: 'sunny',
    temp: 25,
    desc: '晴',
    city: '福州',
    weatherCode: 0,
    tomorrow: {
      icon: 'cloudy',
      tempMin: 22,
      tempMax: 29,
      desc: '多云',
      weatherCode: 4,
    },
    _cachedAt: Date.now() - ageMs,
  }))
}

async function loadWeatherVisitor() {
  const { useWeatherVisitor } = await import('./useWeatherVisitor')
  return useWeatherVisitor()
}

describe('useWeatherVisitor secure backend weather flow', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    vi.stubGlobal('localStorage', createStorage())
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  it('loads location, current weather and tomorrow forecast in one same-origin request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(weatherApiResponse()))
    vi.stubGlobal('fetch', fetchMock)

    const visitor = await loadWeatherVisitor()
    await visitor.ensureLoaded()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/weather')
    expect(visitor.getLocationData()).toMatchObject({
      city: '福州',
      region: '福建',
      country: 'CN',
      source: 'seniverse-ip',
    })
    expect(visitor.getWeatherData()).toMatchObject({
      city: '福州',
      desc: '晴',
      temp: 26,
      tomorrow: { desc: '多云', tempMin: 23, tempMax: 30 },
    })
    const cachedLocation = JSON.parse(localStorage.getItem('pet_location') || '{}')
    expect(cachedLocation).not.toHaveProperty('ip')
    expect(cachedLocation).not.toHaveProperty('lat')
    expect(cachedLocation).not.toHaveProperty('lon')
  })

  it('uses fresh local caches without another request', async () => {
    cacheLocation()
    cacheWeather()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const visitor = await loadWeatherVisitor()
    await visitor.ensureLoaded()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(visitor.getWeatherData()).toMatchObject({ city: '福州', desc: '晴' })
  })

  it('invalidates the legacy multi-provider location cache once', async () => {
    cacheLocation(null)
    cacheWeather()
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(weatherApiResponse()))
    vi.stubGlobal('fetch', fetchMock)

    const visitor = await loadWeatherVisitor()
    await visitor.ensureLoaded()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(visitor.getLocationData()).toMatchObject({ source: 'seniverse-ip' })
    expect(JSON.parse(localStorage.getItem('pet_location') || '{}')).not.toHaveProperty('lat')
  })

  it('keeps a recent stale cache when the backend is temporarily unavailable', async () => {
    cacheLocation()
    cacheWeather(2 * 60 * 60 * 1000)
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 502))
    vi.stubGlobal('fetch', fetchMock)

    const visitor = await loadWeatherVisitor()
    await visitor.ensureLoaded()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(visitor.getLocationData()).toMatchObject({ city: '福州' })
    expect(visitor.getWeatherData()).toMatchObject({ city: '福州', desc: '晴' })
    expect(localStorage.getItem('pet_weather_cache')).not.toBeNull()
  })

  it('rejects malformed backend data without poisoning caches', async () => {
    const invalid = { ...weatherApiResponse(), tomorrow: null }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(invalid))
    vi.stubGlobal('fetch', fetchMock)

    const visitor = await loadWeatherVisitor()
    await visitor.ensureLoaded()

    expect(visitor.getLocationData()).toBeNull()
    expect(visitor.getWeatherData()).toBeNull()
    expect(localStorage.getItem('pet_location')).toBeNull()
    expect(localStorage.getItem('pet_weather_cache')).toBeNull()
  })
})
