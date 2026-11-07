import { describe, expect, it } from 'vitest'
import { rutaDe, seccionDe } from './rutas'

describe('rutas de la scene', () => {
  it('pose l ouverture a la racine', () => {
    expect(rutaDe('comenzar')).toBe('/')
    expect(rutaDe('canjear')).toBe('/canjear-creditos')
  })

  it('relit le chemin, y compris les alias', () => {
    expect(seccionDe('/')).toBe('comenzar')
    expect(seccionDe('/comenzar')).toBe('comenzar')
    expect(seccionDe('/landing')).toBe('comenzar')
    expect(seccionDe('/landing/comenzar/')).toBe('comenzar')
    expect(seccionDe('/canjear-creditos')).toBe('canjear')
    expect(seccionDe('/canjear')).toBe('canjear')
    expect(seccionDe('/landing/canjear-creditos')).toBe('canjear')
  })
})
