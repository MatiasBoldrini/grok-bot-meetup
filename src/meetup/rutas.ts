/**
 * Deux temps, une page. `/` est l'ouverture (le bot en bas). Le claim a sa
 * propre adresse. Les anciens chemins restent lisibles, puis `aligner` les
 * ramene a l'adresse canonique.
 */
export type Seccion = 'comenzar' | 'canjear'

const RUTAS: Record<Seccion, string> = {
  comenzar: '/',
  canjear: '/canjear-creditos'
}

const ALIAS_CANJEAR = ['/canjear-creditos', '/landing/canjear-creditos', '/canjear']
const ALIAS_COMENZAR = ['/comenzar', '/landing', '/landing/comenzar']

export function rutaDe(seccion: Seccion): string {
  return RUTAS[seccion]
}

function cheminDe(pathname: string) {
  return decodeURI(pathname).replace(/\/+$/, '') || '/'
}

export function seccionDe(pathname: string): Seccion {
  if (ALIAS_CANJEAR.includes(cheminDe(pathname))) return 'canjear'
  return 'comenzar'
}

/** Pousse l'adresse si elle ne dit pas deja cette section. Le retour navigateur reste libre. */
export function publicar(seccion: Seccion) {
  const veut = rutaDe(seccion)
  const actuel = cheminDe(location.pathname)
  if (actuel === veut) return
  history.pushState({ seccion }, '', veut + location.search + location.hash)
}

/** `/comenzar` et `/canjear` ouvrent la meme scene, a l'adresse courte. */
export function aligner(seccion: Seccion) {
  const actuel = cheminDe(location.pathname)
  const alias = seccion === 'canjear' ? ALIAS_CANJEAR : ['/', ...ALIAS_COMENZAR]
  if (!alias.includes(actuel)) return
  const veut = rutaDe(seccion)
  if (actuel === veut) return
  history.replaceState({ seccion }, '', veut + location.search + location.hash)
}
