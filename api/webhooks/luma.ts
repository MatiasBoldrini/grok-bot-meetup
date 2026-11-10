import { invalidateLuma } from '../../server/luma.ts'

export default {
  async fetch() {
    invalidateLuma()
    return Response.json({ ok: true })
  }
}
