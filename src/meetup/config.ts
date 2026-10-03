import { interpoler } from '@/i18n/format'
import { ecris, lis } from '@/ui/stockage'

/**
 * Only what changes per venue: city, credits QR, morph interval.
 * Every other label comes from the language pack.
 */
export type MeetupConfig = {
  place: string
  claimUrl: string
  morphSeconds: number
}

export const DEFAULT_MORPH_SECONDS = 10

export const DEFAULT_CONFIG: MeetupConfig = {
  place: 'Mendoza',
  claimUrl: 'https://cursor.com/redeem/event/grok-bot-meetup-mendoza-stripe-oysmd4-9xxteg',
  morphSeconds: DEFAULT_MORPH_SECONDS
}

export function defaults(): MeetupConfig {
  return { ...DEFAULT_CONFIG }
}

/** 1–120 s ; hors de ca on retombe sur les 10 s de la base. */
export function clampMorphSeconds(value: number): number {
  if (!Number.isFinite(value) || value < 1) return DEFAULT_MORPH_SECONDS
  return Math.min(120, Math.round(value))
}

export function parseConfig(raw: string | null): MeetupConfig {
  if (!raw) return defaults()
  try {
    return mergeConfig(JSON.parse(raw) as unknown)
  } catch {
    return defaults()
  }
}

export function readConfig(): MeetupConfig {
  return parseConfig(lis('meetup'))
}

export function writeConfig(config: MeetupConfig) {
  ecris('meetup', JSON.stringify(sanitize(config)))
}

export function mergeConfig(value: unknown): MeetupConfig {
  const next = defaults()
  if (!value || typeof value !== 'object' || Array.isArray(value)) return next
  const record = value as Record<string, unknown>
  if (typeof record.place === 'string' && record.place.trim()) next.place = record.place
  if (typeof record.claimUrl === 'string' && record.claimUrl.trim()) next.claimUrl = record.claimUrl
  if (record.morphSeconds != null && record.morphSeconds !== '') {
    const n = typeof record.morphSeconds === 'number' ? record.morphSeconds : Number(record.morphSeconds)
    if (Number.isFinite(n) && n >= 1) next.morphSeconds = clampMorphSeconds(n)
  }
  return next
}

export function welcome(template: string, name: string): string {
  return interpoler(template, { name })
}

function setMeta(selecteur: string, contenu: string) {
  document.querySelector(selecteur)?.setAttribute('content', contenu)
}

export function applyMeta(copy: { title: string; tabTitle: string; description: string }) {
  document.title = copy.tabTitle
  setMeta('meta[name="description"]', copy.description)
  setMeta('meta[property="og:title"]', copy.tabTitle)
  setMeta('meta[property="og:description"]', copy.description)
  setMeta('meta[property="og:site_name"]', copy.title)
  setMeta('meta[property="og:image:alt"]', copy.tabTitle)
}

function sanitize(config: MeetupConfig): MeetupConfig {
  return {
    place: String(config.place ?? ''),
    claimUrl: String(config.claimUrl ?? ''),
    morphSeconds: clampMorphSeconds(config.morphSeconds)
  }
}
