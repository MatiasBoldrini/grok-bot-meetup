import { loadEnv, type Plugin } from 'vite'
import { AsistenciaError, type CodigoAsistencia } from '../src/meetup/asistencia.js'
import { invalidateLuma, listarEventos, listarTipos, readWallState, registrarAsistencia, type LumaEnv } from './luma.js'

function statutDe(codigo: CodigoAsistencia) {
  if (codigo === 'correo') return 400
  if (codigo === 'config') return 503
  if (codigo === 'omitido') return 409
  if (codigo === 'ausente') return 404
  if (codigo === 'temprano') return 425
  if (codigo === 'espera') return 504
  return 502
}

function lireCorps(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const morceaux: Buffer[] = []
    let n = 0
    req.on('data', (c: Buffer) => {
      n += c.length
      if (n > 4096) {
        reject(new AsistenciaError('correo'))
        req.destroy()
        return
      }
      morceaux.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(morceaux).toString('utf8')))
    req.on('error', reject)
  })
}

function json(res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (s: string) => void }, body: unknown, code = 200) {
  res.statusCode = code
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

export function lumaWall(): Plugin {
  return {
    name: 'luma-wall',
    configureServer(server) {
      const envFile = loadEnv(server.config.mode, server.config.root, '')
      const env = (): LumaEnv => ({
        apiKey: envFile.LUMA_API_KEY || process.env.LUMA_API_KEY || '',
        eventId: envFile.LUMA_EVENT_ID || process.env.LUMA_EVENT_ID || ''
      })

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://127.0.0.1')
        if (url.pathname === '/wall/state' || url.pathname === '/wall/health') {
          const state = await readWallState(env(), url.searchParams.get('event') || '')
          return json(res, url.pathname === '/wall/health' ? state.luma : state)
        }
        if (url.pathname === '/wall/events' && req.method === 'GET') {
          try {
            return json(res, { events: await listarEventos(env()) })
          } catch (e) {
            const codigo = e instanceof AsistenciaError ? e.codigo : 'luma'
            return json(res, { error: codigo, events: [] }, statutDe(codigo))
          }
        }
        if (url.pathname === '/wall/ticket-types' && req.method === 'GET') {
          try {
            return json(res, { types: await listarTipos(env(), url.searchParams.get('event') || '') })
          } catch (e) {
            const codigo = e instanceof AsistenciaError ? e.codigo : 'luma'
            return json(res, { error: codigo, types: [] }, statutDe(codigo))
          }
        }
        if (url.pathname === '/wall/check-in' && req.method === 'POST') {
          try {
            const corps = JSON.parse(await lireCorps(req) || '{}') as {
              email?: unknown
              eventId?: unknown
              ticketTypeId?: unknown
            }
            const resultado = await registrarAsistencia(env(), String(corps.email ?? ''), {
              eventId: String(corps.eventId ?? ''),
              ticketTypeId: String(corps.ticketTypeId ?? '')
            })
            return json(res, resultado)
          } catch (e) {
            const codigo = e instanceof AsistenciaError ? e.codigo : 'luma'
            return json(res, { error: codigo }, statutDe(codigo))
          }
        }
        if (url.pathname === '/webhooks/luma' && req.method === 'POST') {
          invalidateLuma()
          return json(res, { ok: true })
        }
        next()
      })
    }
  }
}
