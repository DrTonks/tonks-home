import {describe,it,expect} from 'vitest'
import {homeTools} from './agent-tools'
describe('public agent tools', () => {
  it('only exposes public profile and destinations', async () => {
    const tools = homeTools()
    expect(tools.map(t => t.name)).toEqual(['tonks_home_info','tonks_find_destinations'])
    expect(tools.every(t => t.annotations.readOnlyHint)).toBe(true)
    const profile = JSON.parse(await tools[0].execute({}))
    expect(profile.name).toBe('DrTonks')
    expect(JSON.parse(await tools[1].execute({query:'相册'}))).toHaveLength(1)
    expect(JSON.parse(await tools[1].execute({query:[] })).error).toBeTruthy()
    expect(JSON.parse(await tools[1].execute({query:'a'.repeat(161)})).error).toBeTruthy()
    expect(JSON.parse(await tools[0].execute({secret:true})).error).toBeTruthy()
  })
})
