/**
 * Reglages de l'overlay d'arrivee. Ils ne font pas partie de la config du lieu :
 * ce sont des curseurs de scene, remis a zero par le bouton du panneau.
 */
export type OverlayReglage = {
  velocidad: number
  escala: number
  altura: number
  /** Decalage du bloc de texte, en rem. Positif = plus haut. 0 = le calage de la scene. */
  textoY: number
  formas: number
  colores: number
  ojos: number
  tamano: number
  cantidad: number
  /** Chaine vide : on affiche la traduction. */
  titulo: string
  tituloTam: number
  tituloColor: string
  tituloX: number
  tituloY: number
  pronto: string
  prontoTam: number
  prontoColor: string
  prontoX: number
  prontoY: number
  firma: string
  firmaTam: number
  firmaColor: string
  firmaX: number
  firmaY: number
  firmaVisible: boolean
  /** Coups d'oeil autonomes du bot principal. */
  mirada: boolean
}

/** Valeurs arretees au fil de la scene : boule a 2.75, au ras du haut, quatorze bots. */
export const OVERLAY_BASE: OverlayReglage = {
  velocidad: 1,
  escala: 2.75,
  altura: 0,
  textoY: 0,
  formas: 8,
  colores: 8,
  ojos: 8,
  tamano: 1,
  cantidad: 14,
  titulo: '',
  tituloTam: 4.75,
  tituloColor: '#111111',
  tituloX: 0,
  tituloY: 0,
  pronto: '',
  prontoTam: 2.25,
  prontoColor: '#111111',
  prontoX: 0,
  prontoY: 0,
  firma: '',
  firmaTam: 1,
  firmaColor: '#6b6b6b',
  firmaX: 0,
  firmaY: 0,
  firmaVisible: true,
  mirada: true
}

export function overlayBase(): OverlayReglage {
  return { ...OVERLAY_BASE }
}
