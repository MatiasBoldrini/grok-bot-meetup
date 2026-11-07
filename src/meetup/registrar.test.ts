import { afterEach, describe, expect, it, vi } from 'vitest'
import { AsistenciaError } from './asistencia'
import { registrarAsistencia } from '../../server/luma'

const attendre = () => Promise.resolve()

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('registrarAsistencia', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refuse sans cle et sans courriel, sans appeler Luma', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(registrarAsistencia({ apiKey: '', eventId: 'evt-1' }, 'ana@example.com', { attendre })).rejects.toMatchObject({
      codigo: 'config'
    })
    await expect(registrarAsistencia({ apiKey: 'k', eventId: 'evt-1' }, 'no', { attendre })).rejects.toBeInstanceOf(AsistenciaError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('cree l invite absent, puis coche l entree et rend son QR', async () => {
    let lectures = 0
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.includes('/v1/events/get')) return json(200, { event: { id: 'evt-1', name: 'Meetup' } })
      if (url.includes('/v1/events/guests/add')) return json(200, { skipped: [] })
      if (url.includes('/v1/event/check-in-guest')) return json(200, {})
      if (url.includes('/v1/events/guests/get')) {
        lectures += 1
        if (lectures === 1) return json(404, {})
        return json(200, {
          id: 'gst-1',
          user_email: 'ana@example.com',
          user_name: 'Ana',
          check_in_qr_code: 'g-abc'
        })
      }
      return json(500, { method })
    })
    vi.stubGlobal('fetch', fetch)

    const r = await registrarAsistencia({ apiKey: 'secret', eventId: 'evt-1' }, 'Ana@Example.com', { attendre })
    expect(r).toEqual({
      created: true,
      email: 'ana@example.com',
      name: 'Ana',
      qrUrl: 'https://luma.com/check-in/evt-1?pk=g-abc'
    })
    const add = fetch.mock.calls.find((c) => String(c[0]).includes('/guests/add'))
    expect(JSON.parse(String(add?.[1]?.body))).toMatchObject({
      event_id: 'evt-1',
      guests: [{ email: 'ana@example.com' }],
      send_email: false
    })
    const entree = fetch.mock.calls.find((c) => String(c[0]).includes('check-in-guest'))
    expect(JSON.parse(String(entree?.[1]?.body))).toEqual({ api_id: 'gst-1' })
    const cle = fetch.mock.calls.map((c) => (c[1]?.headers as Record<string, string>)?.['x-luma-api-key'])
    expect(cle.every((k) => k === 'secret')).toBe(true)
  })

  it('ne recree pas un invite deja la', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/v1/events/get')) return json(200, { event: { id: 'evt-1', name: 'Meetup' } })
      if (url.includes('/v1/events/guests/get')) {
        return json(200, { id: 'gst-9', user_email: 'ana@example.com', user_name: 'Ana', check_in_qr_code: 'g-deja' })
      }
      if (url.includes('/v1/event/check-in-guest')) return json(200, {})
      return json(500, { init })
    })
    vi.stubGlobal('fetch', fetch)
    const r = await registrarAsistencia({ apiKey: 'secret', eventId: 'evt-1' }, 'ana@example.com', { attendre })
    expect(r.created).toBe(false)
    expect(r.qrUrl).toContain('pk=g-deja')
    expect(fetch.mock.calls.some((c) => String(c[0]).includes('/guests/add'))).toBe(false)
  })
})
