/**
 * Signature Web (`{ fetch }`). L'import de Luma est dynamique pour que
 * l'echec de chargement revienne dans le JSON au lieu de tuer l'invocation.
 */
export default {
  async fetch(request: Request) {
    try {
      const { readWallState } = await import('../../server/luma.js')
      const url = new URL(request.url)
      const state = await readWallState(
        {
          apiKey: process.env.LUMA_API_KEY || '',
          eventId: process.env.LUMA_EVENT_ID || ''
        },
        url.searchParams.get('event') || ''
      )
      return Response.json(state.luma)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return Response.json({ ok: false, error: message }, { status: 500 })
    }
  }
}
