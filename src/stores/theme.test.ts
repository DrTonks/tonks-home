import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

async function setup(dark: boolean, stored: 'light' | 'dark' | 'system') {
  vi.resetModules()
  const entries = new Map<string, string>([['theme', stored]])
  const classes = new Set<string>()
  const root = {
    classList: {
      contains: (name: string) => classes.has(name),
      add: (...names: string[]) => names.forEach((name) => classes.add(name)),
      remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
      toggle(name: string, enabled: boolean) { enabled ? classes.add(name) : classes.delete(name) },
    },
    style: { setProperty: vi.fn() },
  }
  const system = new EventTarget() as EventTarget & { matches: boolean }
  system.matches = dark
  const window = Object.assign(new EventTarget(), {
    matchMedia: (query: string) => query.includes('color-scheme') ? system : { matches: false },
    location: { hostname: 'localhost' }, innerWidth: 1280, innerHeight: 900,
  })
  const meta = { setAttribute: vi.fn() }
  const document = Object.assign(new EventTarget(), {
    cookie: '', documentElement: root, querySelector: () => meta,
    startViewTransition: vi.fn((update: () => unknown) => {
      const finished = Promise.resolve(update())
      return { finished }
    }),
  })
  const raf = vi.fn(() => 1)
  vi.stubGlobal('window', window)
  vi.stubGlobal('document', document)
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
  })
  vi.stubGlobal('requestAnimationFrame', raf)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const { useThemeStore } = await import('./theme')
  setActivePinia(createPinia())
  const store = useThemeStore()
  return {
    store, document, entries, classes, raf, meta,
    system(matches: boolean) {
      system.matches = matches
      system.dispatchEvent(Object.assign(new Event('change'), { matches }))
    },
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('theme preference changes with unchanged resolved appearance', () => {
  it('dark -> system under dark skips VT/art fade, persists preference and resumes system following', async () => {
    const env = await setup(true, 'dark')
    env.store.cycle(10, 10)
    expect(env.store.mode).toBe('system')
    expect(env.entries.get('theme')).toBe('system')
    expect(env.document.cookie).toContain('tonks_theme=system;')
    expect(env.document.startViewTransition).not.toHaveBeenCalled()
    expect(env.raf).not.toHaveBeenCalled()
    expect([...env.classes]).toEqual(['dark'])
    env.system(false)
    expect(env.store.isDark).toBe(false)
    expect(env.classes.has('dark')).toBe(false)
    expect(env.meta.setAttribute).toHaveBeenLastCalledWith('content', '#F5F0F2')
    // No empty transition has consumed or delayed the next actual change.
    env.store.toggle(10, 10)
    expect(env.document.startViewTransition).toHaveBeenCalledTimes(1)
    expect(env.store.isDark).toBe(true)
  })

  it('system -> light under light skips VT and stops following future OS changes', async () => {
    const env = await setup(false, 'system')
    env.store.cycle(10, 10)
    expect(env.store.mode).toBe('light')
    expect(env.entries.get('theme')).toBe('light')
    expect(env.document.cookie).toContain('tonks_theme=light;')
    expect(env.document.startViewTransition).not.toHaveBeenCalled()
    expect(env.raf).not.toHaveBeenCalled()
    expect([...env.classes]).toEqual([])
    env.system(true)
    expect(env.store.isDark).toBe(false)
    env.store.cycle(10, 10)
    expect(env.document.startViewTransition).toHaveBeenCalledTimes(1)
    expect(env.store.isDark).toBe(true)
  })

  it('system -> light under dark remains a real animated color change', async () => {
    const env = await setup(true, 'system')
    env.store.cycle(10, 10)
    expect(env.document.startViewTransition).toHaveBeenCalledTimes(1)
    expect(env.store.isDark).toBe(false)
    expect(env.meta.setAttribute).toHaveBeenLastCalledWith('content', '#F5F0F2')
  })
})


describe('theme transitions preserve artwork in both snapshots', () => {
  it.each([
    [false, 'dark', 'system', false],
    [true, 'light', 'dark', true],
    [true, 'system', 'light', false],
  ] as const)('%s system: %s -> %s keeps artwork visible', async (systemDark, initial, next, expectedDark) => {
    const env = await setup(systemDark, initial)
    let update: (() => unknown) | undefined
    let finish!: () => void
    const finished = new Promise<void>((resolve) => { finish = resolve })
    env.document.startViewTransition.mockImplementation((callback) => {
      update = callback
      return { finished }
    })

    env.store.cycle(10, 10)
    // The old snapshot must keep the original theme and its artwork.
    expect(env.store.mode).toBe(initial)
    expect([...env.classes]).toEqual(initial === 'light' ? [] : ['dark'])
    expect(update).toBeDefined()
    await update!()
    // The new snapshot must include the complete destination background.
    expect(env.store.mode).toBe(next)
    expect(env.store.isDark).toBe(expectedDark)
    expect([...env.classes]).toEqual(expectedDark ? ['dark'] : [])
    expect(env.entries.get('theme')).toBe(next)
    finish()
    await finished
    expect(env.raf).not.toHaveBeenCalled()
    if (next === 'system') {
      env.system(true)
      expect(env.store.isDark).toBe(true)
    }
  })
})
