import { AsistenciaError, type CodigoAsistencia } from '../../src/meetup/asistencia'
import { registrarAsistencia } from '../../server/luma'

type Req = { method?: string; body?: unknown }
type Res = { status: (n: number) => { json: (o: unknown) => void } }

function statutDe(codigo: CodigoAsistencia) {
  if (codigo === 'correo') return 400
  if (codigo === 'config') return 503
  if (codigo === 'omitido') return 409
  if (codigo === 'ausente') return 404
  if (codigo === 'espera') return 504
  return 502
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'luma' })
    return
  }
  const body = typeof req.body === 'string' ? (JSON.parse(req.body || '{}') as { email?: unknown }) : (req.body as { email?: unknown } | undefined)
  try {
    const resultado = await registrarAsistencia(
      {
        apiKey: process.env.LUMA_API_KEY || '',
        eventId: process.env.LUMA_EVENT_ID || ''
      },
      String(body?.email ?? '')
    )
    res.status(200).json(resultado)
  } catch (e) {
    const codigo = e instanceof AsistenciaError ? e.codigo : 'luma'
    res.status(statutDe(codigo)).json({ error: codigo })
  }
}
