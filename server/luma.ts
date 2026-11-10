import {
  AsistenciaError,
  enlaceLuma,
  normalizarCorreo,
  paseDeInvitado,
  yaEntro,
  type Pase
} from '../src/meetup/asistencia.js'
import { toAllocation, type Allocation, type LumaGuestRaw } from '../src/meetup/guest.js'

const LUMA = 'https://public-api.luma.com'

export type LumaEnv = {
  apiKey: string
  eventId: string
}

export type WallHealth = {
  configured: boolean
  ok: boolean
  event: { id: string; name: string; url: string } | null
  checkedIn: number
  error: string
  lastSync: number
}

export type WallState = {
  allocations: Allocation[]
  luma: WallHealth
}

type Cache = { key: string; at: number; state: WallState }

let cache: Cache | null = null

export function invalidateLuma() {
  cache = null
}

async function lumaGet(apiKey: string, path: string, query: Record<string, string | undefined> = {}) {
  const url = new URL(LUMA + path)
  for (const [k, v] of Object.entries(query)) {
    if (v) url.searchParams.set(k, v)
  }
  const r = await fetch(url, { headers: { 'x-luma-api-key': apiKey, accept: 'application/json' } })
  const body = (await r.json().catch(() => ({}))) as { message?: string; event?: { id: string; name: string }; entries?: unknown[] }
  if (!r.ok) throw new Error(`Luma ${r.status} ${body.message || ''}`.trim())
  return body
}

async function resolveEvent(env: LumaEnv) {
  if (env.eventId) {
    const j = await lumaGet(env.apiKey, '/v1/events/get', { event_id: env.eventId })
    const ev = ficheEvenement(j.event) || ficheEvenement(j)
    if (!ev) throw new Error('event not found')
    return ev
  }
  const after = new Date(Date.now() - 18 * 3600e3).toISOString()
  const j = await lumaGet(env.apiKey, '/v1/calendars/events/list', {
    after,
    pagination_limit: '10',
    sort_column: 'start_at',
    sort_direction: 'asc'
  })
  const ev = ((j.entries || []) as unknown[])
    .map((e) => {
      const row = e && typeof e === 'object' ? (e as { event?: unknown }).event : null
      return ficheEvenement(row && typeof row === 'object' ? row : e)
    })
    .find((e) => e)
  if (!ev) throw new Error('no upcoming events on this calendar')
  return ev
}

async function listCheckedIn(apiKey: string, eventId: string): Promise<Allocation[]> {
  const allocations: Allocation[] = []
  let cursor: string | undefined
  for (let page = 0; page < 20; page++) {
    const j = await lumaGet(apiKey, '/v1/events/guests/list', {
      event_id: eventId,
      approval_status: 'approved',
      pagination_limit: '50',
      sort_column: 'checked_in_at',
      sort_direction: 'desc nulls last',
      pagination_cursor: cursor
    })
    const entries = (j.entries || []) as LumaGuestRaw[]
    for (const raw of entries) {
      const a = toAllocation(raw)
      if (a) allocations.push(a)
      else if (page === 0) {
        // sorted by checked_in_at desc: first page without a stamp means we are done
      }
    }
    const next = (j as { next_cursor?: string; has_more?: boolean }).next_cursor
    if (!next || !(j as { has_more?: boolean }).has_more) break
    if (entries.every((e) => !toAllocation(e))) break
    cursor = next
  }
  return allocations
}

export async function readWallState(env: LumaEnv, eventOverride = ''): Promise<WallState> {
  const eventId = eventOverride.trim() || env.eventId
  const cacheKey = `${env.apiKey ? 'k' : 'n'}:${eventId}`
  if (cache && cache.key === cacheKey && Date.now() - cache.at < 2500) return cache.state

  if (!env.apiKey) {
    const state: WallState = {
      allocations: [],
      luma: { configured: false, ok: false, event: null, checkedIn: 0, error: '', lastSync: 0 }
    }
    cache = { key: cacheKey, at: Date.now(), state }
    return state
  }

  try {
    const event = await resolveEvent({ ...env, eventId })
    const allocations = await listCheckedIn(env.apiKey, event.id)
    const state: WallState = {
      allocations,
      luma: {
        configured: true,
        ok: true,
        event,
        checkedIn: allocations.length,
        error: '',
        lastSync: Date.now()
      }
    }
    cache = { key: cacheKey, at: Date.now(), state }
    return state
  } catch (e) {
    const state: WallState = {
      allocations: cache?.state.allocations || [],
      luma: {
        configured: true,
        ok: false,
        event: cache?.state.luma.event || null,
        checkedIn: cache?.state.luma.checkedIn || 0,
        error: e instanceof Error ? e.message : String(e),
        lastSync: cache?.state.luma.lastSync || 0
      }
    }
    cache = { key: cacheKey, at: Date.now(), state }
    return state
  }
}

export type ResultadoAsistencia = {
  created: boolean
  email: string
  name: string
  qrUrl: string
}

export type EventoLuma = { id: string; name: string; startAt: string; url: string }

/** id, nom, et l'URL publique si Luma en a donne une. */
function ficheEvenement(crudo: unknown): { id: string; name: string; url: string } | null {
  if (!crudo || typeof crudo !== 'object') return null
  const ev = crudo as Record<string, unknown>
  const id = typeof ev.id === 'string' ? ev.id : ''
  if (!id) return null
  return {
    id,
    name: typeof ev.name === 'string' && ev.name ? ev.name : id,
    url: enlaceLuma(typeof ev.url === 'string' ? ev.url : '')
  }
}
export type TipoEntrada = { id: string; name: string }

type LumaReponse = { ok: boolean; status: number; json: unknown }

async function lumaSend(
  apiKey: string,
  method: 'GET' | 'POST',
  path: string,
  init: { query?: Record<string, string | undefined>; body?: unknown } = {}
): Promise<LumaReponse> {
  const url = new URL(LUMA + path)
  for (const [k, v] of Object.entries(init.query ?? {})) {
    if (v) url.searchParams.set(k, v)
  }
  const r = await fetch(url, {
    method,
    headers: {
      'x-luma-api-key': apiKey,
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {})
    },
    body: init.body ? JSON.stringify(init.body) : undefined
  })
  const json = (await r.json().catch(() => ({}))) as unknown
  return { ok: r.ok, status: r.status, json }
}

async function obtenerInvitado(apiKey: string, eventId: string, email: string): Promise<unknown | null> {
  const r = await lumaSend(apiKey, 'GET', '/v1/events/guests/get', {
    query: { event_id: eventId, id: email }
  })
  if (r.status === 404) return null
  if (!r.ok) throw new AsistenciaError('luma')
  return r.json
}

/**
 * Le check-in n'est pas `guests/update-status` : ce POST ne change que
 * Going / declined / waitlist. L'heure d'entree vit sur le billet. L'ancienne
 * route reste servie (le changelog Luma le dit) et c'est elle qui la pose.
 */
async function marcarEntrada(
  apiKey: string,
  eventId: string,
  email: string,
  guestId: string,
  attendre: (ms: number) => Promise<void>
) {
  for (let i = 0; i < 3; i++) {
    const r = await lumaSend(apiKey, 'POST', '/v1/event/check-in-guest', { body: { api_id: guestId } })
    if (r.ok) return
    const apres = await obtenerInvitado(apiKey, eventId, email)
    if (apres && yaEntro(apres)) return
    if (i === 2) throw new AsistenciaError('luma')
    await attendre(400)
  }
}

function passeOuRien(eventId: string, crudo: unknown): Pase {
  const pase = paseDeInvitado(eventId, crudo)
  if (!pase) throw new AsistenciaError('espera')
  return pase
}

/**
 * Confirmer le courriel : l'invite doit deja etre sur l'evenement. On pose
 * l'entree et on rend l'URL de son QR. La cle reste dans l'environnement.
 */
function filas(json: unknown): Record<string, unknown>[] {
  if (!json || typeof json !== 'object') return []
  const entries = (json as { entries?: unknown }).entries
  if (!Array.isArray(entries)) return []
  return entries.filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
}

/** Evenements du calendrier. Sans `LUMA_EVENT_ID`, le mur n'a rien a deviner. */
export async function listarEventos(env: LumaEnv): Promise<EventoLuma[]> {
  if (!env.apiKey) throw new AsistenciaError('config')
  const after = new Date(Date.now() - 36 * 3600e3).toISOString()
  const r = await lumaSend(env.apiKey, 'GET', '/v1/calendars/events/list', {
    query: { after, pagination_limit: '20', sort_column: 'start_at', sort_direction: 'asc' }
  })
  if (!r.ok) throw new AsistenciaError('luma')
  const vus = new Set<string>()
  const lista: EventoLuma[] = []
  for (const entry of filas(r.json)) {
    const ev = (
      entry.event && typeof entry.event === 'object' ? entry.event : entry
    ) as Record<string, unknown>
    const fiche = ficheEvenement(ev)
    if (!fiche || vus.has(fiche.id)) continue
    vus.add(fiche.id)
    lista.push({
      ...fiche,
      startAt: typeof ev.start_at === 'string' ? ev.start_at : ''
    })
  }
  return lista
}

/** Types de billet de l'evenement choisi. Un seul type n'est pas un choix. */
export async function listarTipos(env: LumaEnv, eventId: string): Promise<TipoEntrada[]> {
  if (!env.apiKey) throw new AsistenciaError('config')
  const id = eventId.trim()
  if (!id) return []
  const r = await lumaSend(env.apiKey, 'GET', '/v1/events/ticket-types/list', {
    query: { event_id: id }
  })
  if (!r.ok) throw new AsistenciaError('luma')
  const lista: TipoEntrada[] = []
  for (const entry of filas(r.json)) {
    const tipo = (
      entry.ticket_type && typeof entry.ticket_type === 'object' ? entry.ticket_type : entry
    ) as Record<string, unknown>
    const tid = typeof tipo.id === 'string' ? tipo.id : ''
    if (!tid) continue
    lista.push({ id: tid, name: typeof tipo.name === 'string' && tipo.name ? tipo.name : tid })
  }
  return lista
}

export async function registrarAsistencia(
  env: LumaEnv,
  emailBrut: string,
  opciones: { eventId?: string; ticketTypeId?: string; attendre?: (ms: number) => Promise<void> } = {}
): Promise<ResultadoAsistencia> {
  const attendre = opciones.attendre ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  const email = normalizarCorreo(emailBrut)
  if (!email) throw new AsistenciaError('correo')
  if (!env.apiKey) throw new AsistenciaError('config')

  const event = await resolveEvent({ ...env, eventId: opciones.eventId?.trim() || env.eventId }).catch(() => {
    throw new AsistenciaError('luma')
  })
  const crudo = await obtenerInvitado(env.apiKey, event.id, email)
  if (!crudo) throw new AsistenciaError('ausente')
  const pase = passeOuRien(event.id, crudo)
  await marcarEntrada(env.apiKey, event.id, email, pase.id, attendre)
  invalidateLuma()
  return { created: false, email: pase.email, name: pase.name, qrUrl: pase.qrUrl }
}
