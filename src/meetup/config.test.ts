import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG, defaults, parseConfig, readConfig, welcome, writeConfig } from './config'

afterEach(() => {
  vi.unstubAllGlobals()
})

function memory() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value)
  })
  return store
}

describe('meetup config', () => {
  it('only stores the venue fields', () => {
    expect(DEFAULT_CONFIG).toEqual({
      place: 'Mendoza',
      claimUrl: 'https://cursor.com/redeem/event/grok-bot-meetup-mendoza-stripe-oysmd4-9xxteg',
      morphSeconds: 10,
      claimTitle: ''
    })
    expect(defaults()).not.toBe(DEFAULT_CONFIG)
  })

  it('merges known string fields and ignores the rest', () => {
    const parsed = parseConfig(
      JSON.stringify({ place: 'Berlin', claimUrl: 'https://cursor.com/redeem', extra: 1, city: 'old' })
    )
    expect(parsed.place).toBe('Berlin')
    expect(parsed.claimUrl).toBe('https://cursor.com/redeem')
    expect(parsed).toEqual({
      place: 'Berlin',
      claimUrl: 'https://cursor.com/redeem',
      morphSeconds: 10,
      claimTitle: ''
    })
  })

  it('falls back when the payload is not an object', () => {
    expect(parseConfig(null)).toEqual(DEFAULT_CONFIG)
    expect(parseConfig('')).toEqual(DEFAULT_CONFIG)
    expect(parseConfig('not-json')).toEqual(DEFAULT_CONFIG)
    expect(parseConfig('[]')).toEqual(DEFAULT_CONFIG)
    expect(parseConfig('null')).toEqual(DEFAULT_CONFIG)
  })

  it('reads and writes under the shared storage prefix', () => {
    const store = memory()
    writeConfig({ place: 'Lisbon', claimUrl: '', morphSeconds: 10, claimTitle: 'Meetup Lisboa' })
    expect(store.get('bloub:meetup')).toContain('Lisbon')
    expect(readConfig().place).toBe('Lisbon')
    expect(readConfig().claimUrl).toBe(DEFAULT_CONFIG.claimUrl)
    expect(readConfig().morphSeconds).toBe(10)
    expect(readConfig().claimTitle).toBe('Meetup Lisboa')
  })

  it('fills empty stored fields with the Mendoza base', () => {
    expect(parseConfig(JSON.stringify({ place: '', claimUrl: '' }))).toEqual(DEFAULT_CONFIG)
  })

  it('keeps a valid morph interval and rejects junk', () => {
    expect(parseConfig(JSON.stringify({ morphSeconds: 25 })).morphSeconds).toBe(25)
    expect(parseConfig(JSON.stringify({ morphSeconds: '8' })).morphSeconds).toBe(8)
    expect(parseConfig(JSON.stringify({ morphSeconds: 0 })).morphSeconds).toBe(10)
    expect(parseConfig(JSON.stringify({ morphSeconds: 999 })).morphSeconds).toBe(120)
  })
})

describe('welcome', () => {
  it('fills {name} and leaves a missing placeholder visible', () => {
    expect(welcome('Welcome, {name}', 'Ana')).toBe('Welcome, Ana')
    expect(welcome('Hello', 'Ana')).toBe('Hello')
  })
})
