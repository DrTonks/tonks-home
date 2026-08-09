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

function cacheLocation(city = 'San Jose', lat = 37.34, lon = -121.89, region = 'California') {
  localStorage.setItem(
    'pet_location',
    JSON.stringify({
      city,
      region,
      country: 'CN',
      lat,
      lon,
      updated_at: new Date().toISOString(),
    }),
  )
}

function geoResponse(city: string, lat: number, lon: number, region = '福建') {
  return jsonResponse({ success: true, city, region, country: 'CN', lat, lon })
}

function ipSbResponse(city: string, latitude: number, longitude: number, region = 'Fujian') {
  return jsonResponse({ city, region, country_code: 'CN', latitude, longitude })
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

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(visitor.getLocationData()).toBeNull()
    expect(visitor.getWeatherData()).toBeNull()
    expect(localStorage.getItem('pet_location')).toBeNull()
  })

  it('removes a newly detected foreign location when its weather request returns 403', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geoResponse('San Jose', 37.34, -121.89, 'California'))
      .mockResolvedValueOnce(jsonResponse({}, 403))
    vi.stubGlobal('fetch', fetchMock)

    const visitor = await loadWeatherVisitor()
    await visitor.ensureLoaded()

    expect(fetchMock).toHaveBeenCalledTimes(2)
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
    expect(fetchMock.mock.calls[1]?.[0]).toContain('location=26.08%3A119.3')
    expect(fetchMock.mock.calls[2]?.[0]).toContain('location=26.08%3A119.3')
    expect(visitor.getLocationData()).toMatchObject({ city: '福州', lat: 26.08, lon: 119.3 })
    expect(visitor.getWeatherData()).toMatchObject({ city: '福州', desc: '晴' })
    expect(JSON.parse(localStorage.getItem('pet_location') || '{}')).not.toHaveProperty('ip')
    expect(localStorage.getItem('pet_weather_cache')).not.toBeNull()
  })

  it('invalidates old location and weather caches that do not contain a region', async () => {
    cacheLocation('郑州', 34.77, 113.72, '')
    localStorage.setItem(
      'pet_weather_cache',
      JSON.stringify({ city: '郑州', desc: '晴', _cachedAt: Date.now() }),
    )
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geoResponse('福州', 26.08, 119.3))
      .mockResolvedValueOnce(nowResponse('福州'))
      .mockResolvedValueOnce(dailyResponse())
    vi.stubGlobal('fetch', fetchMock)

    const visitor = await loadWeatherVisitor()
    await visitor.ensureLoaded()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1]?.[0]).toContain('location=26.08%3A119.3')
    expect(visitor.getLocationData()).toMatchObject({ city: '福州', region: '福建' })
    expect(visitor.getWeatherData()).toMatchObject({ city: '福州' })
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

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(visitor.getLocationData()).toMatchObject({ city: 'San Jose' })
    expect(localStorage.getItem('pet_location')).not.toBeNull()
  })

  it('uses ip.sb coordinates when primary coordinates resolve to a different city', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geoResponse('福州', 34.77, 113.72))
      .mockResolvedValueOnce(nowResponse('郑州'))
      .mockResolvedValueOnce(ipSbResponse('Fuzhou', 26.08, 119.3))
      .mockResolvedValueOnce(nowResponse('福州'))
      .mockResolvedValueOnce(dailyResponse())
    vi.stubGlobal('fetch', fetchMock)

    const visitor = await loadWeatherVisitor()
    await visitor.ensureLoaded()

    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(fetchMock.mock.calls[1]?.[0]).toContain('location=34.77%3A113.72')
    expect(fetchMock.mock.calls[3]?.[0]).toContain('location=26.08%3A119.3')
    expect(fetchMock.mock.calls[4]?.[0]).toContain('location=26.08%3A119.3')
    expect(visitor.getLocationData()).toMatchObject({ city: '福州', lat: 34.77, lon: 113.72 })
    expect(visitor.getWeatherData()).toMatchObject({ city: '福州' })
  })

  it('falls back to primary province and city when both coordinate lookups disagree', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geoResponse('福州', 34.77, 113.72))
      .mockResolvedValueOnce(nowResponse('郑州'))
      .mockResolvedValueOnce(ipSbResponse('Hangzhou', 30.27, 120.15, 'Zhejiang'))
      .mockResolvedValueOnce(nowResponse('杭州'))
      .mockResolvedValueOnce(nowResponse('福州'))
      .mockResolvedValueOnce(dailyResponse())
    vi.stubGlobal('fetch', fetchMock)

    const visitor = await loadWeatherVisitor()
    await visitor.ensureLoaded()

    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(fetchMock.mock.calls[4]?.[0]).toContain('location=%E7%A6%8F%E5%BB%BA%20%E7%A6%8F%E5%B7%9E')
    expect(fetchMock.mock.calls[5]?.[0]).toContain('location=%E7%A6%8F%E5%BB%BA%20%E7%A6%8F%E5%B7%9E')
    expect(visitor.getLocationData()).toMatchObject({ city: '福州', region: '福建' })
  })

  it('does not repeat the same coordinate weather lookup when both providers agree', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geoResponse('福州', 26.08, 119.3))
      .mockResolvedValueOnce(nowResponse('闽侯'))
      .mockResolvedValueOnce(ipSbResponse('Fuzhou', 26.0805, 119.3005))
      .mockResolvedValueOnce(nowResponse('福州'))
      .mockResolvedValueOnce(dailyResponse())
    vi.stubGlobal('fetch', fetchMock)

    const visitor = await loadWeatherVisitor()
    await visitor.ensureLoaded()

    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(fetchMock.mock.calls[3]?.[0]).toContain('location=%E7%A6%8F%E5%BB%BA%20%E7%A6%8F%E5%B7%9E')
    expect(fetchMock.mock.calls[4]?.[0]).toContain('location=%E7%A6%8F%E5%BB%BA%20%E7%A6%8F%E5%B7%9E')
  })

  it('accepts ip.sb coordinates after dynamically matching Fuzhou with 福州', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 502))
      .mockResolvedValueOnce(ipSbResponse('Fuzhou', 26.08, 119.3))
      .mockResolvedValueOnce(nowResponse('福州'))
      .mockResolvedValueOnce(nowResponse('福州'))
      .mockResolvedValueOnce(dailyResponse())
    vi.stubGlobal('fetch', fetchMock)

    const visitor = await loadWeatherVisitor()
    await visitor.ensureLoaded()

    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(fetchMock.mock.calls[2]?.[0]).toContain('location=26.08%3A119.3')
    expect(fetchMock.mock.calls[3]?.[0]).toContain('location=Fujian%20Fuzhou')
    expect(fetchMock.mock.calls[4]?.[0]).toContain('location=26.08%3A119.3')
    expect(visitor.getLocationData()).toMatchObject({ city: 'Fuzhou', region: 'Fujian' })
    expect(visitor.getWeatherData()).toMatchObject({ city: '福州' })
  })

  it('rejects wrong ip.sb coordinates after comparing them with the English city query', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 502))
      .mockResolvedValueOnce(ipSbResponse('Fuzhou', 34.77, 113.72))
      .mockResolvedValueOnce(nowResponse('郑州'))
      .mockResolvedValueOnce(nowResponse('福州'))
      .mockResolvedValueOnce(dailyResponse())
    vi.stubGlobal('fetch', fetchMock)

    const visitor = await loadWeatherVisitor()
    await visitor.ensureLoaded()

    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(fetchMock.mock.calls[4]?.[0]).toContain('location=Fujian%20Fuzhou')
    expect(visitor.getWeatherData()).toMatchObject({ city: '福州' })
  })
})
