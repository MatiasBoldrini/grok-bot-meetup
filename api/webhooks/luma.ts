import { invalidateLuma } from '../../server/luma.js'

export default {
  async fetch() {
    invalidateLuma()
    return Response.json({ ok: true })
  }
}
