import { describe, expect, it } from 'vitest'
import { parseTerminalRecommendationOptions } from './terminalRecommendationOptions'

describe('parseTerminalRecommendationOptions', () => {
  it('keeps a recommendation without administrator options unchanged', () => {
    expect(parseTerminalRecommendationOptions('《三体》')).toEqual({ content: '《三体》' })
  })

  it.each([
    ['《三体》 -city San Jose', 'San Jose'],
    ['《三体》 -city 四川 成都', '四川 成都'],
    ['《三体》 -city "San Jose"', 'San Jose'],
    ["《三体》 -city 'New York'", 'New York'],
  ])('parses a multi-word city from %s', (command, city) => {
    expect(parseTerminalRecommendationOptions(command)).toEqual({ content: '《三体》', city })
  })

  it('parses multiple multi-word options up to the next known option', () => {
    expect(
      parseTerminalRecommendationOptions('《三体》 -city San Jose -source Admin User'),
    ).toEqual({
      content: '《三体》',
      city: 'San Jose',
      source: 'Admin User',
    })
  })

  it('does not treat an option-like phrase inside quotes as another option', () => {
    expect(parseTerminalRecommendationOptions('《三体》 -source "visitor -city tester"')).toEqual({
      content: '《三体》',
      source: 'visitor -city tester',
    })
  })

  it('lets the last duplicate option win', () => {
    expect(parseTerminalRecommendationOptions('《三体》 -city 福州 -city San Jose')).toEqual({
      content: '《三体》',
      city: 'San Jose',
    })
  })

  it.each([
    ['《三体》 -city', 'city'],
    ['《三体》 -source ""', 'source'],
  ])('reports an administrator option without a value in %s', (command, invalidOption) => {
    expect(parseTerminalRecommendationOptions(command)).toEqual({
      content: '《三体》',
      invalidOption,
    })
  })
})
