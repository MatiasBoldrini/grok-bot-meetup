import { readWallState } from '../../server/luma.ts'

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
    return Response.json(state)
  }
}
