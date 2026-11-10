import { readWallState } from '../../server/luma.ts'

/**
 * Signature Web (`{ fetch }`). `(req, res)` cassait l'invocation sur Vercel,
 * et sans `/wall/health` le mur n'a ni l'icone ni la bulle.
 */
export default {
  async fetch(request: Request) {
    const url = new URL(request.url)
    const state = await readWallState(
      {
        apiKey: process.env.LUMA_API_KEY || '',
        eventId: process.env.LUMA_EVENT_ID || ''
      },
      url.searchParams.get('event') || ''
    )
    return Response.json(state.luma)
  }
}
