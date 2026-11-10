import { AsistenciaError, type CodigoAsistencia } from '../../src/meetup/asistencia.ts'
import { registrarAsistencia } from '../../server/luma.ts'

function statutDe(codigo: CodigoAsistencia) {
  if (codigo === 'correo') return 400
  if (codigo === 'config') return 503
  if (codigo === 'omitido') return 409
  if (codigo === 'ausente') return 404
  if (codigo === 'espera') return 504
  return 502
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'POST') return Response.json({ error: 'luma' }, { status: 405 })
    let email = ''
    try {
      const body = (await request.json()) as { email?: unknown }
      email = String(body?.email ?? '')
    } catch {
      email = ''
    }
    try {
      const resultado = await registrarAsistencia(
        {
          apiKey: process.env.LUMA_API_KEY || '',
          eventId: process.env.LUMA_EVENT_ID || ''
        },
        email
      )
      return Response.json(resultado)
    } catch (e) {
      const codigo = e instanceof AsistenciaError ? e.codigo : 'luma'
      return Response.json({ error: codigo }, { status: statutDe(codigo) })
    }
  }
}
