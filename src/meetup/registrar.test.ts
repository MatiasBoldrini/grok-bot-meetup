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

  it('refuse un courriel qui n est pas deja sur l evenement, sans l inscrire', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.includes('/v1/events/get')) return json(200, { event: { id: 'evt-1', name: 'Meetup' } })
      if (url.includes('/v1/events/guests/get')) return json(404, {})
      return json(500, { method })
    })
    vi.stubGlobal('fetch', fetch)

    await expect(registrarAsistencia({ apiKey: 'secret', eventId: 'evt-1' }, 'ana@example.com', { attendre })).rejects.toMatchObject({
      codigo: 'ausente'
    })
    expect(fetch.mock.calls.some((c) => String(c[0]).includes('/guests/add'))).toBe(false)
    expect(fetch.mock.calls.some((c) => String(c[0]).includes('check-in-guest'))).toBe(false)
  })

  it('refuse un invite qui n a pas confirme, sans l inscrire', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/v1/events/get')) return json(200, { event: { id: 'evt-1', name: 'Meetup' } })
      if (url.includes('/v1/events/guests/get')) {
        return json(200, { id: 'gst-9', user_email: 'ana@example.com', approval_status: 'invited' })
      }
      return json(500, {})
    })
    vi.stubGlobal('fetch', fetch)
    await expect(registrarAsistencia({ apiKey: 'secret', eventId: 'evt-1' }, 'ana@example.com', { attendre })).rejects.toMatchObject({
      codigo: 'ausente'
    })
    expect(fetch.mock.calls.some((c) => String(c[0]).includes('/guests/add'))).toBe(false)
    expect(fetch.mock.calls.some((c) => String(c[0]).includes('check-in-guest'))).toBe(false)
  })

  it('refuse avant le debut, sans inscrire ni cocher', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/v1/events/get')) {
        return json(200, { event: { id: 'evt-1', name: 'Meetup', start_at: '2099-01-01T00:00:00.000Z' } })
      }
      return json(500, {})
    })
    vi.stubGlobal('fetch', fetch)
    await expect(registrarAsistencia({ apiKey: 'secret', eventId: 'evt-1' }, 'ana@example.com', { attendre })).rejects.toMatchObject({
      codigo: 'temprano'
    })
    expect(fetch.mock.calls.some((c) => String(c[0]).includes('/guests/'))).toBe(false)
    expect(fetch.mock.calls.some((c) => String(c[0]).includes('check-in-guest'))).toBe(false)
  })

  it('coche l entree d un invite deja inscrit, sans le recreer', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/v1/events/get')) return json(200, { event: { id: 'evt-1', name: 'Meetup' } })
      if (url.includes('/v1/events/guests/get')) {
        return json(200, {
          id: 'gst-9',
          user_email: 'ana@example.com',
          user_name: 'Ana',
          approval_status: 'approved',
          check_in_qr_code: 'g-deja'
        })
      }
      if (url.includes('/v1/event/check-in-guest')) return json(200, {})
      return json(500, { init })
    })
    vi.stubGlobal('fetch', fetch)
    const r = await registrarAsistencia({ apiKey: 'secret', eventId: 'evt-1' }, 'ana@example.com', { attendre })
    expect(r.created).toBe(false)
    expect(r.qrUrl).toContain('pk=g-deja')
    expect(fetch.mock.calls.some((c) => String(c[0]).includes('/guests/add'))).toBe(false)
    const entree = fetch.mock.calls.find((c) => String(c[0]).includes('check-in-guest'))
    expect(JSON.parse(String(entree?.[1]?.body))).toEqual({ api_id: 'gst-9' })
  })

  it('laisse passer un invite deja coche, sans rappeler le check-in, et rend les liens https', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/v1/events/get')) return json(200, { event: { id: 'evt-1', name: 'Meetup' } })
      if (url.includes('/v1/events/guests/get')) {
        return json(200, {
          id: 'gst-9',
          user_email: 'ana@example.com',
          user_name: 'Ana',
          check_in_qr_code: 'g-deja',
          approval_status: 'approved',
          checked_in_at: '2026-11-18T22:10:00.000Z'
        })
      }
      return json(500, {})
    })
    vi.stubGlobal('fetch', fetch)
    const r = await registrarAsistencia(
      {
        apiKey: 'secret',
        eventId: 'evt-1',
        linkNew: 'https://cursor.com/redeem/new',
        linkExisting: 'http://cursor.com/redeem/old'
      },
      'ana@example.com',
      { attendre }
    )
    expect(r.qrUrl).toContain('pk=g-deja')
    expect(r.nuevo).toBe('https://cursor.com/redeem/new')
    expect(r.existente).toBe('')
    expect(fetch.mock.calls.some((c) => String(c[0]).includes('check-in-guest'))).toBe(false)
  })

  it('rend les credits quand la route de check-in a disparu', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/v1/events/get')) return json(200, { event: { id: 'evt-1', name: 'Meetup' } })
      if (url.includes('/v1/events/guests/get')) {
        return json(200, {
          id: 'gst-9',
          user_email: 'ana@example.com',
          user_name: 'Ana',
          approval_status: 'approved',
          check_in_qr_code: 'g-deja'
        })
      }
      if (url.includes('check-in-guest')) return json(404, { message: 'Not found.' })
      return json(500, {})
    })
    vi.stubGlobal('fetch', fetch)
    const r = await registrarAsistencia(
      { apiKey: 'secret', eventId: 'evt-1', linkNew: 'https://cursor.com/redeem/new', linkExisting: 'https://cursor.com/redeem/old' },
      'ana@example.com',
      { attendre }
    )
    expect(r.name).toBe('Ana')
    expect(r.qrUrl).toContain('pk=g-deja')
    expect(r.nuevo).toBe('https://cursor.com/redeem/new')
    expect(r.existente).toBe('https://cursor.com/redeem/old')
    expect(fetch.mock.calls.filter((c) => String(c[0]).includes('check-in-guest'))).toHaveLength(1)
  })
})
