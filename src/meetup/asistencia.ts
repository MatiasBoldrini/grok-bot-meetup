import { guestName, type LumaGuestRaw } from './guest.js'

/** Codes renvoyes au mur. Pas le corps Luma : il ne doit pas fuiter. */
export type CodigoAsistencia = 'correo' | 'config' | 'omitido' | 'ausente' | 'temprano' | 'espera' | 'luma'

export class AsistenciaError extends Error {
  readonly codigo: CodigoAsistencia
  constructor(codigo: CodigoAsistencia) {
    super(codigo)
    this.codigo = codigo
  }
}

export type Pase = {
  id: string
  email: string
  name: string
  qrUrl: string
}

/** Vrai tant que l'heure de debut est dans le futur. Sans heure, on ne bloque pas. */
export function aunNoEmpieza(startAt: string, ahora = Date.now()): boolean {
  const debut = Date.parse(startAt)
  if (!Number.isFinite(debut)) return false
  return ahora < debut
}
export function normalizarCorreo(value: string): string | null {
  const email = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

/**
 * Page publique d'un evenement Luma. On ne rend que `https` sur `luma.com`
 * ou `lu.ma` : le champ vient de l'API, pas d'une saisie.
 */
export function enlaceLuma(valeur: string): string {
  try {
    const u = new URL(valeur.trim())
    const hote = u.hostname
    const luma = hote === 'luma.com' || hote === 'lu.ma' || hote.endsWith('.luma.com')
    if (u.protocol !== 'https:' || !luma) return ''
    return u.toString()
  } catch {
    return ''
  }
}

/**
 * `check_in_qr_code` est parfois deja une URL, parfois la cle `pk` du billet.
 * Le QR du mur encode toujours une URL http.
 */
export function urlDelQr(eventId: string, code: string): string | null {
  const c = code.trim()
  if (!c) return null
  if (/^https?:\/\//i.test(c)) return c
  const id = eventId.trim()
  if (!id) return null
  return `https://luma.com/check-in/${encodeURIComponent(id)}?pk=${encodeURIComponent(c)}`
}

function comoObjeto(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const guest = o.guest
  if (guest && typeof guest === 'object') return guest as Record<string, unknown>
  return o
}

/** L'invite est entre si le guest ou l'un de ses billets porte une heure. */
export function yaEntro(raw: unknown): boolean {
  const guest = comoObjeto(raw)
  if (!guest) return false
  if (typeof guest.checked_in_at === 'string' && guest.checked_in_at) return true
  const tickets = Array.isArray(guest.event_tickets) ? guest.event_tickets : []
  return tickets.some((t) => {
    if (!t || typeof t !== 'object') return false
    const at = (t as { checked_in_at?: unknown }).checked_in_at
    return typeof at === 'string' && at.length > 0
  })
}

/** Nom, id Luma et URL du QR, lus sur la reponse de `guests/get`. */
export function paseDeInvitado(eventId: string, raw: unknown): Pase | null {
  const guest = comoObjeto(raw)
  if (!guest) return null
  const code = typeof guest.check_in_qr_code === 'string' ? guest.check_in_qr_code : ''
  const id = typeof guest.id === 'string' ? guest.id : typeof guest.api_id === 'string' ? guest.api_id : ''
  const email = typeof guest.user_email === 'string' ? guest.user_email : ''
  const qrUrl = urlDelQr(eventId, code)
  if (!id || !email || !qrUrl) return null
  return { id, email, name: guestName(guest as LumaGuestRaw), qrUrl }
}
