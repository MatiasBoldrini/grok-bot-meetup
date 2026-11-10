import { describe, expect, it } from 'vitest'
import { enlaceLuma, normalizarCorreo, paseDeInvitado, urlDelQr, yaEntro } from './asistencia'

describe('asistencia', () => {
  it('accepte un courriel et refuse le reste', () => {
    expect(normalizarCorreo('  Ana@Example.com ')).toBe('ana@example.com')
    expect(normalizarCorreo('ana')).toBeNull()
    expect(normalizarCorreo('ana@')).toBeNull()
  })

  it('fabrique l url du QR a partir de la cle, ou la garde si c est deja une url', () => {
    expect(urlDelQr('evt-1', 'g-abc')).toBe('https://luma.com/check-in/evt-1?pk=g-abc')
    expect(urlDelQr('evt-1', 'https://luma.com/check-in/evt-1?pk=g-abc')).toBe(
      'https://luma.com/check-in/evt-1?pk=g-abc'
    )
    expect(urlDelQr('', 'g-abc')).toBeNull()
  })

  it('lit le passe sur la reponse Luma, imbriquee ou non', () => {
    const guest = {
      id: 'gst-1',
      user_email: 'ana@example.com',
      user_name: 'Ana',
      check_in_qr_code: 'g-abc'
    }
    expect(paseDeInvitado('evt-1', guest)?.qrUrl).toBe('https://luma.com/check-in/evt-1?pk=g-abc')
    expect(paseDeInvitado('evt-1', { guest })?.name).toBe('Ana')
    expect(paseDeInvitado('evt-1', { id: 'gst-1', user_email: 'a@b.c' })).toBeNull()
  })

  it('ne garde qu une page https de Luma', () => {
    expect(enlaceLuma('https://luma.com/z8bwjr4j')).toBe('https://luma.com/z8bwjr4j')
    expect(enlaceLuma(' https://lu.ma/abc ')).toBe('https://lu.ma/abc')
    expect(enlaceLuma('http://luma.com/abc')).toBe('')
    expect(enlaceLuma('https://evil.example/luma.com')).toBe('')
    expect(enlaceLuma('javascript:alert(1)')).toBe('')
  })

  it('voit l entree sur le guest ou sur un billet', () => {
    expect(yaEntro({ checked_in_at: '2026-11-06T12:00:00Z' })).toBe(true)
    expect(yaEntro({ event_tickets: [{ checked_in_at: '2026-11-06T12:00:00Z' }] })).toBe(true)
    expect(yaEntro({ event_tickets: [{ checked_in_at: null }] })).toBe(false)
  })
})