import { describe, expect, it } from 'vitest'
import { AWAY_PAGE_TITLE, resolveVisibilityTitle } from './visibility-title'

describe('visibility title state', () => {
  it('keeps the active page title while visible', () => {
    expect(resolveVisibilityTitle('old title', '个人主页 - DrTonks', false)).toEqual({
      pageTitle: '个人主页 - DrTonks',
      visibleTitle: '个人主页 - DrTonks',
    })
  })

  it('shows the away title and restores the latest route title', () => {
    const hidden = resolveVisibilityTitle('My Blog - DrTonks', '关于 - DrTonks', true)
    expect(hidden).toEqual({
      pageTitle: AWAY_PAGE_TITLE,
      visibleTitle: '关于 - DrTonks',
    })

    const routeChangedWhileHidden = resolveVisibilityTitle(
      hidden.visibleTitle,
      '友链 - DrTonks',
      true,
    )
    expect(routeChangedWhileHidden).toEqual({
      pageTitle: AWAY_PAGE_TITLE,
      visibleTitle: '友链 - DrTonks',
    })

    expect(
      resolveVisibilityTitle(
        routeChangedWhileHidden.visibleTitle,
        routeChangedWhileHidden.pageTitle,
        false,
      ),
    ).toEqual({
      pageTitle: '友链 - DrTonks',
      visibleTitle: '友链 - DrTonks',
    })
  })
})
