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

function cacheLocation(city = 'San Jose', lat = 37.34, lon = -121.89) {
  localStorage.setItem(
    'pet_location',
    JSON.stringify({
      city,
      region: '',
      country: 'CN',
      lat,
      lon,
      updated_at: new Date().toISOString(),
    }),
  )
}

function geoResponse(city: string, latitude: number, longitude: number) {
  return jsonResponse({ city, latitude, longitude })
}

function nowResponse(city: string) {
  return jsonResponse({
    results: [
      {
        location: { name: city, path: `中国,${city}` },
        now: { text: '晴', code: '0', temperature: '26' },
      },
    ],
  })
}

function dailyResponse() {
  return jsonResponse({
    results: [
      {
        daily: [
          { date: '2026-08-09', text_day: '晴', code_day: '0', high: '31', low: '24' },
          { date: '2026-08-10', text_day: '多云', code_day: '4', high: '30', low: '23' },
        ],
      },
    ],
  })
}

async function loadWeatherVisitor() {
  const { useWeatherVisitor } = await import('./useWeatherVisitor')
  return useWeatherVisitor()
}

describe('useWeatherVisitor location cache after weather 403', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    vi.stubGlobal('localStorage', createStorage())
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  it('clears an existing location cache without retrying when weather returns 403', async () => {
    cacheLocation()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 403))
      .mockResolvedValueOnce(jsonResponse({}, 403))
    vi.stubGlobal('fetch', fetchMock)

    const visitor = await loadWeatherVisitor()
    await visitor.ensureLoaded()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(visitor.getLocationData()).toBeNull()
    expect(visitor.getWeatherData()).toBeNull()
    expect(localStorage.getItem('pet_location')).toBeNull()
  })

  it('removes a newly detected foreign location when its weather request returns 403', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geoResponse('San Jose', 37.34, -121.89))
      .mockResolvedValueOnce(jsonResponse({}, 403))
      .mockResolvedValueOnce(jsonResponse({}, 403))
    vi.stubGlobal('fetch', fetchMock)

    const visitor = await loadWeatherVisitor()
    await visitor.ensureLoaded()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(visitor.getLocationData()).toBeNull()
    expect(localStorage.getItem('pet_location')).toBeNull()
  })

  it('keeps the location and weather caches when weather succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geoResponse('福州', 26.08, 119.3))
      .mockResolvedValueOnce(nowResponse('福州'))
      .mockResolvedValueOnce(dailyResponse())
    vi.stubGlobal('fetch', fetchMock)

    const visitor = await loadWeatherVisitor()
    await visitor.ensureLoaded()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(visitor.getLocationData()).toMatchObject({ city: '福州', lat: 26.08, lon: 119.3 })
    expect(visitor.getWeatherData()).toMatchObject({ city: '福州', desc: '晴' })
    expect(JSON.parse(localStorage.getItem('pet_location') || '{}')).not.toHaveProperty('ip')
    expect(localStorage.getItem('pet_weather_cache')).not.toBeNull()
  })

  it('keeps the location cache for non-403 weather failures', async () => {
    cacheLocation()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({}, 500))
    vi.stubGlobal('fetch', fetchMock)

    const visitor = await loadWeatherVisitor()
    await visitor.ensureLoaded()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(visitor.getLocationData()).toMatchObject({ city: 'San Jose' })
    expect(localStorage.getItem('pet_location')).not.toBeNull()
  })
})
