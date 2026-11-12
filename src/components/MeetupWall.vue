<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import BloubBot from '@/components/BloubBot.vue'
import BotTile from '@/components/BotTile.vue'
import ChampBots from '@/components/ChampBots.vue'
import MeetupSettings from '@/components/MeetupSettings.vue'
import { EXPRESSIONS, type ExpressionId } from '@/bot/expressions'
import { COLORS, SHAPES, type ColorId, type ShapeId } from '@/bot/skins'
import type { StateId } from '@/bot/states'
import { langue, t } from '@/i18n'
import { useModalDialog } from '@/ui/useModalDialog'
import { applyMeta, clampMorphSeconds, readConfig, welcome, writeConfig, type MeetupConfig } from '@/meetup/config'
import { aunNoEmpieza, enlaceLuma } from '@/meetup/asistencia'
import { overlayBase, type OverlayReglage } from '@/meetup/overlay'
import { aligner, publicar, seccionDe } from '@/meetup/rutas'

/**
 * Meetup wall: banner on the left, oversized ball on the right. A check-in
 * (Luma via `/wall/state`, or Space in demo) opens a chat bubble. Copy lives
 * in this browser (`bloub:meetup`), so each ambassador configures their own event.
 */

type Invite = { key: string; name: string; at: number }

const DEMO = [
  'Lucía Fernández',
  'Aiko Tanaka',
  'James Okonkwo',
  'Priya Sharma',
  'Elena Popescu',
  'Noah Berger',
  'Sofía Herrera',
  'Mateo Álvarez'
]

const PAPER = '#f6f6f6'
/** Le depot de ce mur, pas celui d'origine. */
const REPO = 'https://github.com/MatiasBoldrini/grok-bot-meetup'
const mur = ref<MeetupConfig>(readConfig())
const overlay = ref<OverlayReglage>(overlayBase())
/** Page Luma de l'evenement branche sur le mur. Vide tant que l'API ne l'a pas dit. */
const evento = ref<{ name: string; url: string; startAt: string } | null>(null)
/** Le canje est trop tot : on montre les speakers au lieu d'inscrire. */
const esperaEvento = ref(false)
/** Affiche de speakers, ouverte depuis le lien sous le bouton. */
const speakers = ref(false)
const boiteSpeakers = useTemplateRef<HTMLDialogElement>('boiteSpeakers')
useModalDialog(speakers, boiteSpeakers)
watch(
  [mur, langue],
  ([c]) => {
    writeConfig(c)
    applyMeta({
      title: t('meetup.title'),
      tabTitle: t('meetup.tabTitle'),
      description: t('meetup.description')
    })
  },
  { deep: true, immediate: true }
)
/**
 * Idle long : le lecteur ne reboucle pas sur swirl. La fete de check-in pose
 * `swirl` a la main (anneaux colorees, meme corps).
 */
const cycle = [{ state: 'idle' as StateId, duration: 60 }]
const FORMES = SHAPES.map((s) => s.id)
const TEINTES = COLORS.filter((c) => c.id !== 'creme').map((c) => c.id)
const VISAGES = EXPRESSIONS.map((e) => e.id)

const feed = ref<Invite[]>([])
const vus = new Set<string>()
let pret = false
const bulle = ref<{ nom: string; phase: 'points' | 'texte' } | null>(null)
/** « olee », des que la souris bouge apres un courriel valide. */
const olee = ref(false)
/** « 😂😂😂 », une fois le bouton revenu a sa place. */
const risa = ref(false)
const state = ref<StateId>('idle')
const block = ref(0)
const playing = ref(true)
const shape = ref<ShapeId>('cercle')
const color = ref<ColorId>('encre')
/** Un teint choisi au menu reste. Le clic principal le relance. */
let teintFixe = false
const coloresAbiertos = ref(false)
const lugarColores = ref<{ x: number; y: number } | null>(null)
const teintActuel = computed(() => COLORS.find((c) => c.id === color.value)?.hex ?? '#0a0a0c')
const expression = ref<ExpressionId>('neutre')
const ouverte = seccionDe(location.pathname)
const claim = ref(ouverte === 'canjear')
/**
 * L'ouverture est la page. `/` y arrive ; le claim est l'autre temps.
 * Pas un reglage stocke : un temps de la seance, pas une donnee du lieu.
 */
const inicio = ref(!claim.value)
const edition = ref(new URLSearchParams(location.search).has('setup'))
const btnClaim = ref<HTMLButtonElement | null>(null)
const btnPase = ref<HTMLButtonElement | null>(null)
const pied = ref<HTMLElement | null>(null)

/** Menu de l'element touche. Absent du DOM tant qu'on n'a pas clique. */
type Pastille =
  | { tipo: 'principal'; x: number; y: number }
  | { tipo: 'mini'; i: number; x: number; y: number }
  | { tipo: 'firma'; x: number; y: number }
  | { tipo: 'titulo'; x: number; y: number }
const pastille = ref<Pastille | null>(null)
/** Brouillon du titre : le champ peut se vider sans que la phrase traduite y revienne. */
const brouillonTitre = ref('')
const inputCorreo = ref<HTMLInputElement | null>(null)
const correo = ref('')
/**
 * Caret du courrier, en coordonnees client — le meme repere que la souris.
 * L'objet est mute sur place : le moteur le relit a chaque image, un ref
 * neuf a chaque frappe redessinerait le mur pour rien.
 */
const pointCaret: { x: number; y: number; nx: number } = { x: 0, y: 0, nx: -1 }
const caretActif = ref(false)
let caretRaf = 0
let miroirCaret: HTMLSpanElement | null = null

function indexCaret(input: HTMLInputElement) {
  // Un `type=email` rend `selectionStart` nul : le caret n'y est pas lisible.
  const debut = input.selectionStart
  if (debut == null) return input.value.length
  const fin = input.selectionEnd ?? debut
  return input.selectionDirection === 'backward' ? debut : fin
}

/** Largeur du texte avant le caret, avec la meme police que le champ. */
function largeurCaret(input: HTMLInputElement, index: number) {
  if (!miroirCaret) {
    miroirCaret = document.createElement('span')
    miroirCaret.style.cssText =
      'position:fixed;left:0;top:0;visibility:hidden;white-space:pre;pointer-events:none'
    document.body.appendChild(miroirCaret)
  }
  const style = getComputedStyle(input)
  miroirCaret.style.font = style.font
  miroirCaret.style.letterSpacing = style.letterSpacing
  miroirCaret.textContent = input.value.slice(0, index)
  return miroirCaret.getBoundingClientRect().width
}

function poserCaret() {
  const input = inputCorreo.value
  if (!input) return
  const style = getComputedStyle(input)
  const rect = input.getBoundingClientRect()
  const pad = parseFloat(style.paddingLeft) || 0
  const bord = parseFloat(style.borderLeftWidth) || 0
  pointCaret.x = rect.left + bord + pad + largeurCaret(input, indexCaret(input)) - input.scrollLeft
  pointCaret.y = rect.top + rect.height / 2
  /*
   * Avance dans le champ, -1 a 1, sur TOUTE sa largeur. Les deux tiers
   * saturaient le lacet des le milieu d'une adresse : les yeux restaient
   * colles au bord droit, et le masque coupait celui de droite.
   */
  const course = Math.max(1, rect.width - bord * 2 - pad * 2)
  const avance = (pointCaret.x - rect.left - bord - pad) / course
  pointCaret.nx = Math.min(1, Math.max(0, avance)) * 2 - 1
}

function boucleCaret() {
  caretRaf = requestAnimationFrame(boucleCaret)
  const input = inputCorreo.value
  if (!input || document.activeElement !== input) {
    caretActif.value = false
    cancelAnimationFrame(caretRaf)
    caretRaf = 0
    return
  }
  poserCaret()
}

function auFocusCaret() {
  poserCaret()
  caretActif.value = true
  if (!caretRaf) caretRaf = requestAnimationFrame(boucleCaret)
}

function auBlurCaret() {
  caretActif.value = false
}

const enviando = ref(false)
const errorPase = ref('')
const codigoPase = ref('')
const pase = ref<{ name: string; nuevo: string; existente: string } | null>(null)
/** Les questions de credits. La page derriere reste le bot : la liste ne s'y pose plus. */
const creditosAbiertos = computed(() => pase.value !== null)
const boiteCreditos = useTemplateRef<HTMLDialogElement>('boiteCreditos')
useModalDialog(creditosAbiertos, boiteCreditos)
const demoRestants = [...DEMO]

let syncTimer = 0
let morphTimer = 0
let bulleTimer = 0
let feteTimer = 0
let enFete = false

function sousTitre() {
  if (inicio.value) return overlay.value.titulo.trim() || t('meetup.started')
  if (claim.value) return mur.value.claimTitle.trim() || t('meetup.cityClaim')
  const ville = mur.value.place.trim()
  return ville ? t('meetup.city', { place: ville }) : t('meetup.cityBare')
}

const textePronto = computed(() => overlay.value.pronto.trim() || t('meetup.soon'))
const texteFirma = computed(() => overlay.value.firma.trim() || t('meetup.presented'))

function styleTitre() {
  if (!inicio.value) return undefined
  return {
    '--titulo-tam': `${overlay.value.tituloTam}rem`,
    color: overlay.value.tituloColor,
    transform: `translate(${overlay.value.tituloX}rem, ${overlay.value.tituloY}rem)`
  }
}

function stylePronto() {
  if (!inicio.value) return undefined
  return {
    '--pronto-tam': `${overlay.value.prontoTam}rem`,
    color: overlay.value.prontoColor,
    transform: `translate(${overlay.value.prontoX}rem, ${overlay.value.prontoY}rem)`
  }
}

const ENCRE_FIRMA = '#111111'
const BLANC_FIRMA = '#ffffff'
/** Teinte du bloc SpaceX, choisie par contraste avec le fond mesure. */
const firmaTinta = ref(ENCRE_FIRMA)

function hexDe(css: string): string | null {
  if (!css || css === 'transparent' || css === 'none') return null
  if (/^#[0-9a-f]{6}$/i.test(css)) return css.toLowerCase()
  const m = css.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/)
  if (!m) return null
  const alpha = m[4] === undefined ? 1 : Number(m[4])
  if (!(alpha >= 0.5)) return null
  const canal = (n: string) => Math.round(Number(n)).toString(16).padStart(2, '0')
  return `#${canal(m[1]!)}${canal(m[2]!)}${canal(m[3]!)}`
}

function luminance(hex: string) {
  const v = parseInt(hex.slice(1), 16)
  const lin = (c: number) => {
    const x = c / 255
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin((v >> 16) & 255) + 0.7152 * lin((v >> 8) & 255) + 0.0722 * lin(v & 255)
}

function contraste(a: string, b: string) {
  const hi = Math.max(luminance(a), luminance(b))
  const lo = Math.min(luminance(a), luminance(b))
  return (hi + 0.05) / (lo + 0.05)
}

function couleurDe(el: Element): string | null {
  /*
   * Le clic tombe sur `.corps`, rempli couleur papier pour boucher les yeux.
   * La couleur VUE est le rectangle d'encre masque par-dessus.
   */
  const avatar = el.closest('.avatar')
  if (avatar && el.closest('.corps')) {
    const encre = avatar.querySelector('g[mask] rect')
    const fill = encre ? hexDe(getComputedStyle(encre).fill) : null
    if (fill) return fill
  }
  if (el instanceof SVGElement) {
    const fill = hexDe(getComputedStyle(el).fill)
    if (fill) return fill
  }
  let node: Element | null = el
  while (node) {
    const fond = hexDe(getComputedStyle(node).backgroundColor)
    if (fond) return fond
    node = node.parentElement
  }
  return null
}

/** Couleur dominante sous le rectangle, puis noir ou blanc selon le contraste. */
function mesurerFirma() {
  const piece = pied.value?.querySelector('.firma-piece')
  if (!(piece instanceof HTMLElement)) return
  const r = piece.getBoundingClientRect()
  if (r.width < 2 || r.height < 2) return
  const comptes = new Map<string, number>()
  for (let iy = 0; iy < 3; iy++) {
    for (let ix = 0; ix < 3; ix++) {
      const x = r.left + (r.width * (ix + 0.5)) / 3
      const y = r.top + (r.height * (iy + 0.5)) / 3
      const dessous = document.elementsFromPoint(x, y).find((el) => !el.closest('.presente, .pastille, .reglages'))
      const hex = dessous ? couleurDe(dessous) : null
      if (!hex) continue
      comptes.set(hex, (comptes.get(hex) ?? 0) + 1)
    }
  }
  let fond = PAPER
  let n = 0
  for (const [hex, c] of comptes) {
    if (c > n) {
      fond = hex
      n = c
    }
  }
  const noir = contraste(fond, ENCRE_FIRMA)
  const blanc = contraste(fond, BLANC_FIRMA)
  const gagne = blanc > noir ? BLANC_FIRMA : ENCRE_FIRMA
  if (firmaTinta.value !== gagne) firmaTinta.value = gagne
}

let firmaRaf = 0
let firmaMesure = 0
function boucleFirma(ms: number) {
  firmaRaf = requestAnimationFrame(boucleFirma)
  if (!inicio.value || !overlay.value.firmaVisible) return
  if (ms - firmaMesure < 120) return
  firmaMesure = ms
  mesurerFirma()
}

function styleFirma() {
  const blanca = firmaTinta.value === BLANC_FIRMA
  return {
    '--firma-tam': String(overlay.value.firmaTam),
    '--firma-filtro': blanca ? 'invert(1)' : 'none',
    color: blanca ? BLANC_FIRMA : ENCRE_FIRMA,
    transform: `translate(${overlay.value.firmaX}rem, ${overlay.value.firmaY}rem)`
  }
}

function prenom(nom: string) {
  const bout = nom.trim().split(/\s+/)[0] || nom
  return bout
}

/** Premier mot du nom Luma. Un courriel ne se glisse pas dans la question. */
function preguntaCredito(nom: string) {
  const name = prenom(nom)
  if (!name || name.includes('@')) return t('meetup.creditAsk')
  return t('meetup.creditAskName', { name })
}

function autre<T>(liste: readonly T[], actuel: T): T {
  const choix = liste.filter((x) => x !== actuel)
  return (choix[Math.floor(Math.random() * choix.length)] ?? liste[0])!
}

/**
 * Figure, couleur et yeux independants — pas une sequence. Idle, pas de swirl.
 * L'ecran d'ouverture ne quitte pas le cercle : les autres silhouettes restent
 * au mur.
 */
function tirerBot() {
  if (!inicio.value) shape.value = autre(FORMES, shape.value)
  if (!(inicio.value && teintFixe)) color.value = autre(TEINTES, color.value)
  expression.value = autre(VISAGES, expression.value)
}

function choisirCouleur(id: ColorId) {
  color.value = id
  teintFixe = true
}

function relancerMorph() {
  clearInterval(morphTimer)
  morphTimer = window.setInterval(() => {
    if (!enFete) tirerBot()
  }, clampMorphSeconds(mur.value.morphSeconds) * 1000)
}

function ouvrirPastille(
  base: { tipo: 'principal' } | { tipo: 'mini'; i: number } | { tipo: 'firma' } | { tipo: 'titulo' },
  x: number,
  y: number
) {
  const largeur = base.tipo === 'principal' ? 280 : 240
  const boite =
    base.tipo === 'mini' ? 214 : base.tipo === 'firma' ? 156 : base.tipo === 'titulo' ? 196 : 540
  pastille.value = {
    ...base,
    x: Math.min(Math.max(12, x + 14), window.innerWidth - largeur),
    y: Math.min(Math.max(12, y + 14), window.innerHeight - boite)
  }
}

function remPx() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
}

/**
 * Le menu reste colle au cadre. `ouvrir` le pose ; sans cela, un deplacement
 * au clic principal ne fait que le suivre s'il est deja la.
 */
function collerFirma(ouvrir = true) {
  const piece = pied.value?.querySelector('.firma-piece')
  if (!(piece instanceof HTMLElement)) return
  const r = piece.getBoundingClientRect()
  const largeur = 240
  if (!ouvrir && pastille.value?.tipo !== 'firma') return
  const aDroite = r.right + 14
  pastille.value = {
    tipo: 'firma',
    x: aDroite + largeur > window.innerWidth ? Math.max(12, r.left - largeur - 14) : aDroite,
    y: Math.min(Math.max(12, r.top), window.innerHeight - 156)
  }
}

type Saisie = {
  el: HTMLElement
  move: (e: PointerEvent) => void
  up: () => void
}
let saisie: Saisie | null = null

function lacher() {
  if (!saisie) return
  saisie.el.removeEventListener('pointermove', saisie.move)
  saisie.el.removeEventListener('pointerup', saisie.up)
  saisie.el.removeEventListener('pointercancel', saisie.up)
  saisie = null
}

function tenir(el: HTMLElement, e: PointerEvent, move: (ev: PointerEvent) => void) {
  const up = () => lacher()
  lacher()
  saisie = { el, move, up }
  el.setPointerCapture(e.pointerId)
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
}

/** Clic principal : la signature suit le pointeur. Le menu est au clic secondaire. */
function auPointeurFirma(e: PointerEvent) {
  if (e.button !== 0) return
  const el = e.currentTarget
  if (!(el instanceof HTMLElement)) return
  e.preventDefault()
  const x0 = e.clientX
  const y0 = e.clientY
  const fx = overlay.value.firmaX
  const fy = overlay.value.firmaY
  const unite = remPx()
  let bouge = false
  tenir(el, e, (ev) => {
    const dx = ev.clientX - x0
    const dy = ev.clientY - y0
    if (!bouge && Math.hypot(dx, dy) < 4) return
    bouge = true
    overlay.value = { ...overlay.value, firmaX: fx + dx / unite, firmaY: fy + dy / unite }
    collerFirma(false)
  })
}

function auMenuFirma(e: MouseEvent) {
  e.preventDefault()
  collerFirma()
}

/** Poignee du coin : l'echelle suit la distance au centre, comme un cadre d'image. */
function auPoigneeFirma(e: PointerEvent) {
  if (e.button !== 0) return
  const el = e.currentTarget
  if (!(el instanceof HTMLElement)) return
  e.preventDefault()
  e.stopPropagation()
  const piece = pied.value?.querySelector('.firma-piece')
  const r = piece instanceof HTMLElement ? piece.getBoundingClientRect() : null
  const cx = r ? r.left + r.width / 2 : e.clientX
  const cy = r ? r.top + r.height / 2 : e.clientY
  const d0 = Math.max(12, Math.hypot(e.clientX - cx, e.clientY - cy))
  const tam0 = overlay.value.firmaTam
  tenir(el, e, (ev) => {
    const d1 = Math.hypot(ev.clientX - cx, ev.clientY - cy)
    const n = Math.min(2, Math.max(0.6, tam0 * (d1 / d0)))
    overlay.value = { ...overlay.value, firmaTam: Math.round(n * 20) / 20 }
    collerFirma()
  })
}

function fermerPopups() {
  pastille.value = null
  coloresAbiertos.value = false
  lugarColores.value = null
}

/** Clic principal : la couleur suivante, sauf si un menu est ouvert : la on le ferme. */
function auClicPrincipal() {
  if (fermeture || pastille.value || coloresAbiertos.value) {
    fermeture = false
    fermerPopups()
    return
  }
  if (enFete) return
  teintFixe = false
  tirerBot()
  relancerMorph()
}

function auClicSecondaire(e: MouseEvent) {
  e.preventDefault()
  ouvrirPastille({ tipo: 'principal' }, e.clientX, e.clientY)
}

/**
 * Clic secondaire sur « Grok Bot Meetup ». Le champ montre la phrase a l'ecran ;
 * une valeur vide retombe sur la traduction, donc ouvrir le menu ne la fige pas.
 */
function auMenuTitre(e: MouseEvent) {
  if (!inicio.value) return
  e.preventDefault()
  brouillonTitre.value = overlay.value.titulo || t('meetup.started')
  ouvrirPastille({ tipo: 'titulo' }, e.clientX, e.clientY)
  void nextTick(() => {
    const champ = document.querySelector<HTMLInputElement>('.pastille-texte')
    if (!champ) return
    champ.focus()
    champ.select()
  })
}

function poserTitre(valeur: string) {
  overlay.value = {
    ...overlay.value,
    titulo: valeur.trim() === t('meetup.started') ? '' : valeur
  }
}

function ouvrirMini(i: number, x: number, y: number) {
  ouvrirPastille({ tipo: 'mini', i }, x, y)
}

/**
 * Le pointerdown qui ferme le menu est suivi d'un clic. Sans ce drapeau, ce
 * clic changerait aussi la couleur du bot.
 */
let fermeture = false

function auDehors(e: PointerEvent) {
  const cible = e.target
  if (cible instanceof Element && cible.closest('.pastille, .teintes')) return
  // La firma se deplace au clic principal : son propre menu reste accroche.
  if (pastille.value?.tipo === 'firma' && cible instanceof Element && cible.closest('.firma-piece')) return
  if (!pastille.value) return
  pastille.value = null
  // Le clic est une tache plus tard : un setTimeout(0) partait avant lui.
  if (e.button === 0) fermeture = true
}

function auClicApresFermeture(e: MouseEvent) {
  if (!fermeture) return
  fermeture = false
  e.preventDefault()
  e.stopPropagation()
}

/**
 * Capture sur la page : le pointerdown a peut-etre deja ferme le menu, et le
 * clic du bot arriverait encore. On le coupe avant qu'il change la couleur.
 */
function auClicPage(e: MouseEvent) {
  if (!pastille.value && !coloresAbiertos.value && !fermeture) return
  const cible = e.target
  if (!(cible instanceof Element)) return
  if (cible.closest('.pastille, .teintes')) return
  if (pastille.value?.tipo === 'firma' && cible.closest('.firma-piece')) return
  fermerPopups()
  fermeture = false
  if (cible.closest('.avatar, .grain')) {
    e.preventDefault()
    e.stopPropagation()
  }
}

/** Le nuage de couleurs flotte au-dessus de la scene, pas dans la carte. */
function basculerColores(e: MouseEvent) {
  if (coloresAbiertos.value) {
    coloresAbiertos.value = false
    lugarColores.value = null
    return
  }
  const el = e.currentTarget
  if (!(el instanceof HTMLElement)) return
  const r = el.getBoundingClientRect()
  const ancho = 200
  const alto = 112
  const x = Math.min(Math.max(12, r.left + r.width / 2 - ancho / 2), window.innerWidth - ancho - 12)
  const arriba = r.top - alto - 10
  lugarColores.value = {
    x,
    y: arriba >= 12 ? arriba : Math.min(r.bottom + 10, window.innerHeight - alto - 12)
  }
  coloresAbiertos.value = true
}

function auPointeurPastille(e: PointerEvent) {
  e.stopPropagation()
  const cible = e.target
  if (cible instanceof Element && cible.closest('.muestra')) return
  coloresAbiertos.value = false
}

function mouvementReduit() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function lancerFete() {
  if (mouvementReduit()) return
  clearTimeout(feteTimer)
  enFete = true
  state.value = 'swirl'
  feteTimer = window.setTimeout(() => {
    state.value = 'idle'
    enFete = false
  }, 1300)
}

function accueillir(invite: Invite) {
  if (vus.has(invite.key)) return
  vus.add(invite.key)
  feed.value = [invite, ...feed.value].slice(0, 6)
  clearTimeout(bulleTimer)
  lancerFete()
  bulle.value = { nom: prenom(invite.name), phase: 'points' }
  bulleTimer = window.setTimeout(() => {
    if (bulle.value) bulle.value = { ...bulle.value, phase: 'texte' }
  }, 720)
}

function demoCheckIn() {
  const nom = demoRestants.shift()
  if (!nom) return
  demoRestants.push(nom)
  // Cle unique a chaque frappe : sinon le 2e tour des memes noms est ignore.
  accueillir({ key: `demo:${nom}:${Date.now()}`, name: nom, at: Date.now() })
}

async function syncMur() {
  const key = new URLSearchParams(location.search).get('key')
  const u = new URL('/wall/state', location.origin)
  if (key) u.searchParams.set('key', key)
  try {
    const r = await fetch(u, { cache: 'no-store' })
    if (!r.ok) throw new Error(String(r.status))
    const s = (await r.json()) as {
      allocations?: Array<{ key: string; name?: string; checkedInAt?: string; at?: string }>
      luma?: { event?: { name?: string; url?: string; startAt?: string } | null }
    }
    const pagina = typeof s.luma?.event?.url === 'string' ? enlaceLuma(s.luma.event.url) : ''
    const nom = typeof s.luma?.event?.name === 'string' ? s.luma.event.name.trim() : ''
    const startAt = typeof s.luma?.event?.startAt === 'string' ? s.luma.event.startAt : ''
    evento.value = pagina && nom ? { name: nom, url: pagina, startAt } : null
    const recus = (s.allocations || [])
      .map((a) => ({
        key: a.key,
        name: a.name || a.key,
        at: new Date(a.checkedInAt || a.at || Date.now()).getTime()
      }))
      .sort((a, b) => b.at - a.at)
    if (!pret) {
      for (const invite of recus) vus.add(invite.key)
      feed.value = recus.slice(0, 6)
      pret = true
      return
    }
    for (const invite of recus.slice().reverse()) accueillir(invite)
  } catch {
    /* demo locale si le mur n'est pas joignable */
  }
}

function fermerSpeakers(e: MouseEvent) {
  if (e.target === e.currentTarget) speakers.value = false
}

function fermerCreditos(e?: MouseEvent) {
  if (e && e.target !== e.currentTarget) return
  if (pase.value) otroPase()
}

function ouvrirClaim() {
  if (claim.value) return
  speakers.value = false
  inicio.value = false
  claim.value = true
  lancerFete()
  relancerMorph()
  publicar('canjear')
  void nextTick(() => {
    inputCorreo.value?.focus()
    auFocusCaret()
  })
}

function limpiarPase() {
  pase.value = null
  correo.value = ''
  errorPase.value = ''
  codigoPase.value = ''
  esperaEvento.value = false
  enviando.value = false
}

function abrirCredito(url: string) {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

function mensajePase(codigo: string) {
  if (codigo === 'correo') return t('meetup.emailInvalid')
  if (codigo === 'config') return t('meetup.emailMissing')
  if (codigo === 'omitido') return t('meetup.emailSkipped')
  if (codigo === 'ausente') return t('meetup.emailAbsent')
  if (codigo === 'espera') return t('meetup.emailWait')
  return t('meetup.emailFailed')
}

function sourisFine() {
  return window.matchMedia('(pointer: fine)').matches
}

/** Entree soumet au clavier tactile. Sur une souris, il faut cliquer le bouton. */
function auEnterCorreo(e: KeyboardEvent) {
  e.preventDefault()
  if (sourisFine()) return
  void enviarCorreo()
}

function auEnterBoton(e: KeyboardEvent) {
  if (sourisFine()) e.preventDefault()
}

async function enviarCorreo() {
  if (enviando.value) return
  const campo = inputCorreo.value
  if (campo && !campo.checkValidity()) {
    campo.reportValidity()
    return
  }
  enviando.value = true
  errorPase.value = ''
  codigoPase.value = ''
  esperaEvento.value = false
  if (aunNoEmpieza(evento.value?.startAt ?? '')) {
    esperaEvento.value = true
    enviando.value = false
    return
  }
  try {
    const r = await fetch('/wall/check-in', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: correo.value })
    })
    const j = (await r.json().catch(() => ({}))) as {
      error?: string
      name?: string
      qrUrl?: string
      nuevo?: string
      existente?: string
    }
    if (!r.ok || !j.qrUrl) {
      if (j.error === 'temprano') esperaEvento.value = true
      else {
        codigoPase.value = j.error || ''
        errorPase.value = mensajePase(j.error || '')
      }
      return
    }
    pase.value = {
      name: j.name || correo.value.trim(),
      nuevo: typeof j.nuevo === 'string' ? j.nuevo : '',
      existente: typeof j.existente === 'string' ? j.existente : ''
    }
  } catch {
    errorPase.value = t('meetup.emailFailed')
  } finally {
    enviando.value = false
  }
}

function otroPase() {
  limpiarPase()
  void nextTick(() => {
    inputCorreo.value?.focus()
    auFocusCaret()
  })
}

function fermerClaim() {
  if (!claim.value) return
  claim.value = false
  inicio.value = true
  lacherFuite()
  limpiarPase()
  relancerMorph()
  if (!enFete) state.value = 'idle'
  publicar('comenzar')
  void nextTick(() => btnClaim.value?.focus())
}

/** Le retour ne quitte que le claim : l'ouverture n'a pas d'ecran derriere. */
function fermerCouche() {
  if (claim.value) fermerClaim()
}

function fermerEdition() {
  edition.value = false
}

function auClavier(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (pastille.value) {
      pastille.value = null
      return
    }
    if (edition.value) {
      fermerEdition()
      return
    }
    fermerCouche()
    return
  }
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return
  if (e.key === ' ' && !e.repeat) {
    e.preventDefault()
    demoCheckIn()
  }
}

/**
 * Le bouton du formulaire de claim, pas celui de l'ouverture. Le curseur le
 * repousse comme un aimant de meme polarite : une force CONTINUE, pas un saut
 * par approche. Plus le pointeur est pres du bord
 * du bouton, plus la vitesse visee est forte (`FUITE_VMAX` au contact, nulle a
 * `FUITE_ALCANCE`), dans la direction opposee, sur les deux axes. La vitesse
 * est lissee puis integree a chaque image : il demarre et s'arrete en douceur,
 * et un curseur plus rapide que `FUITE_VMAX` le rattrape.
 *
 * Le chemin qu'il peut parcourir est un BUDGET (`FUITE_TOTAL`, additionne).
 * Epuise, des que la souris lache, ou coince contre un bord sans avancer,
 * il revient a sa place et n'en repart plus : le clic redevient possible.
 * Un curseur rapide brulait ce budget en une fraction de seconde : la partie
 * dure au moins `FUITE_MIN`, meme si la distance est deja faite. Un rayon autour de
 * l'origine ne suffisait pas, le curseur le faisait glisser le long du bord
 * sans fin. La fenetre le borne aussi : il ne sort jamais de l'ecran.
 *
 * Pas de transition CSS sur le transform : elle ajouterait son propre retard
 * a une vitesse deja lissee. La boucle ne tourne que tant que quelque chose
 * bouge. Le tactile n'a pas de survol et `prefers-reduced-motion` le laisse fixe.
 *
 * Il reste en place tant qu'il n'y a pas d'adresse, puis tant que la souris
 * n'a pas bouge APRES cette adresse. Sinon le visiteur voit le truc avant
 * d'avoir ecrit.
 */
const FUITE_ALCANCE = 120
const FUITE_VMAX = 560
const FUITE_SUAVIDAD = 9
const FUITE_TOTAL = 510
const FUITE_MIN = 3000
const fuite = { x: 0, y: 0 }
const fuiteVel = { x: 0, y: 0 }
let fuitePointeur: { x: number; y: number } | null = null
let fuiteRecorrido = 0
let fuiteRaf = 0
let fuiteHorloge = 0
let fuiteDesde = 0
/** Arme au premier mouvement de souris qui suit une adresse valide. */
let fuiteArmee = false
/** La fuite est finie : on le ramene, et il ne repart plus. */
let fuiteRetour = false
let fuiteTerminee = false
/** Depuis quand il est coince (bord de fenetre) sans avancer. */
let fuiteQuietoDesde = 0
const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function courrielPose() {
  return COURRIEL.test(correo.value.trim())
}

function lacherFuite() {
  fuiteArmee = false
  fuiteRetour = false
  fuiteTerminee = false
  fuiteQuietoDesde = 0
  olee.value = false
  risa.value = false
  fuite.x = fuite.y = fuiteVel.x = fuiteVel.y = 0
  fuiteRecorrido = 0
  fuiteDesde = 0
  fuitePointeur = null
  poserFuite(btnPase.value)
}

function poserFuite(el: HTMLElement | null) {
  if (!el) return
  el.style.transform =
    Math.abs(fuite.x) > 0.2 || Math.abs(fuite.y) > 0.2
      ? `translate(${fuite.x.toFixed(2)}px, ${fuite.y.toFixed(2)}px)`
      : ''
}

function fuiteCalme() {
  return (
    !claim.value ||
    !btnPase.value ||
    !fuiteArmee ||
    !window.matchMedia('(pointer: fine)').matches ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function boucleFuite(ms: number) {
  fuiteRaf = 0
  const el = btnPase.value
  const dt = fuiteHorloge ? Math.min((ms - fuiteHorloge) / 1000, 0.05) : 0
  fuiteHorloge = ms
  if (!el) return
  if (fuiteCalme()) {
    fuite.x = fuite.y = fuiteVel.x = fuiteVel.y = 0
    fuiteRecorrido = 0
    fuiteDesde = 0
    fuiteRetour = false
    fuiteTerminee = false
    fuiteQuietoDesde = 0
    poserFuite(el)
    fuiteHorloge = 0
    return
  }
  if (!fuiteDesde) fuiteDesde = ms
  const joven = ms - fuiteDesde < FUITE_MIN

  // Le budget est fini : retour lisse vers la place d'origine, sans la souris.
  if (fuiteRetour) {
    const rapproche = dt > 0 ? 1 - Math.exp(-dt * 7) : 0
    fuite.x *= 1 - rapproche
    fuite.y *= 1 - rapproche
    if (Math.hypot(fuite.x, fuite.y) < 0.6) {
      fuite.x = fuite.y = 0
      fuiteRetour = false
      fuiteTerminee = true
      risa.value = true
      poserFuite(el)
      fuiteHorloge = 0
      return
    }
    poserFuite(el)
    fuiteRaf = requestAnimationFrame(boucleFuite)
    return
  }

  // le rectangle est celui que l'on VOIT, c'est lui que le pointeur approche
  const r = el.getBoundingClientRect()
  let cibleX = 0
  let cibleY = 0
  const p = fuitePointeur
  if (p && (joven || fuiteRecorrido < FUITE_TOTAL)) {
    const horsX = p.x < r.left ? r.left - p.x : p.x > r.right ? p.x - r.right : 0
    const horsY = p.y < r.top ? r.top - p.y : p.y > r.bottom ? p.y - r.bottom : 0
    const dist = Math.hypot(horsX, horsY)
    if (dist < FUITE_ALCANCE) {
      let dx = r.left + r.width / 2 - p.x
      let dy = r.top + r.height / 2 - p.y
      let d = Math.hypot(dx, dy)
      if (d < 1) {
        // pile au centre : une direction quelconque vaut mieux que NaN
        dx = 0
        dy = 1
        d = 1
      }
      const k = (1 - dist / FUITE_ALCANCE) ** 2
      cibleX = (dx / d) * FUITE_VMAX * k
      cibleY = (dy / d) * FUITE_VMAX * k
    }
  }

  // lissage independant du debit d'images
  const a = 1 - Math.exp(-dt * FUITE_SUAVIDAD)
  fuiteVel.x += (cibleX - fuiteVel.x) * a
  fuiteVel.y += (cibleY - fuiteVel.y) * a

  const homeX = r.left - fuite.x
  const homeY = r.top - fuite.y
  const marge = 10
  let x = fuite.x + fuiteVel.x * dt
  let y = fuite.y + fuiteVel.y * dt
  const minX = marge - homeX
  const maxX = window.innerWidth - marge - r.width - homeX
  const minY = marge - homeY
  const maxY = window.innerHeight - marge - r.height - homeY
  // contre un bord de fenetre, la vitesse s'eteint de ce cote
  if (x < minX || x > maxX) fuiteVel.x = 0
  if (y < minY || y > maxY) fuiteVel.y = 0
  x = Math.min(maxX, Math.max(minX, x))
  y = Math.min(maxY, Math.max(minY, y))

  // le dernier morceau est raccourci pour tomber pile sur le budget
  let fait = Math.hypot(x - fuite.x, y - fuite.y)
  const resto = FUITE_TOTAL - fuiteRecorrido
  if (!joven && resto <= 0) {
    fait = 0
    fuiteVel.x = fuiteVel.y = 0
    fuiteRetour = true
  } else if (!joven && fait > resto) {
    const f = resto / fait
    x = fuite.x + (x - fuite.x) * f
    y = fuite.y + (y - fuite.y) * f
    fait = resto
  }
  fuiteRecorrido += fait
  if (!joven && fuiteRecorrido >= FUITE_TOTAL - 0.01) {
    fuiteVel.x = fuiteVel.y = 0
    fuiteRetour = true
  }
  // La souris a lache : la fuite est finie, on rentre. Pas avant le minimum.
  const pose = Math.hypot(fuite.x, fuite.y) > 1 || Math.hypot(x, y) > 1
  const arrete = Math.hypot(fuiteVel.x, fuiteVel.y) < 12
  if (!joven && !fuiteRetour && pose && arrete && Math.hypot(cibleX, cibleY) < 1) {
    fuiteRetour = true
  }
  // Coince contre un bord, il n'avance plus : au bout d'un instant, meme effet.
  const clavado = !joven && pose && arrete && fait < 0.35
  if (clavado) {
    if (!fuiteQuietoDesde) fuiteQuietoDesde = ms
    else if (ms - fuiteQuietoDesde > 480) fuiteRetour = true
  } else if (fait >= 0.35) {
    fuiteQuietoDesde = 0
  }
  fuite.x = x
  fuite.y = y
  poserFuite(el)

  const enMarche =
    joven ||
    fuiteRetour ||
    Math.hypot(fuiteVel.x, fuiteVel.y) > 1.5 ||
    Math.hypot(cibleX, cibleY) > 1.5
  if (enMarche) fuiteRaf = requestAnimationFrame(boucleFuite)
  else fuiteHorloge = 0
}

function auFuiteClaim(e: PointerEvent) {
  if (e.pointerType === 'touch') {
    fuitePointeur = null
    return
  }
  if (fuiteTerminee) return
  fuitePointeur = { x: e.clientX, y: e.clientY }
  if (!fuiteArmee) {
    if (!courrielPose()) return
    fuiteArmee = true
  }
  olee.value = true
  if (!fuiteRaf && fuiteRecorrido < FUITE_TOTAL) fuiteRaf = requestAnimationFrame(boucleFuite)
}

/** Le pointeur quitte la page : plus rien ne repousse, il n'y a pas d'evenement de plus. */
function auFuiteFin() {
  fuitePointeur = null
}

function auPopState() {
  const s = seccionDe(location.pathname)
  claim.value = s === 'canjear'
  inicio.value = !claim.value
  if (!claim.value) lacherFuite()
}

onMounted(() => {
  aligner(claim.value ? 'canjear' : 'comenzar')
  tirerBot()
  void syncMur()
  syncTimer = window.setInterval(() => void syncMur(), 2000)
  relancerMorph()
  firmaRaf = requestAnimationFrame(boucleFirma)
  window.addEventListener('keydown', auClavier)
  window.addEventListener('popstate', auPopState)
  window.addEventListener('click', auClicApresFermeture, true)
  window.addEventListener('pointermove', auFuiteClaim)
  document.documentElement.addEventListener('pointerleave', auFuiteFin)
})

watch(() => mur.value.morphSeconds, () => relancerMorph())

watch(pastille, (p, avant) => {
  if (p?.tipo !== 'principal') {
    coloresAbiertos.value = false
    lugarColores.value = null
  }
  if (!!p === !!avant) return
  if (p) window.addEventListener('pointerdown', auDehors, true)
  else window.removeEventListener('pointerdown', auDehors, true)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(firmaRaf)
  cancelAnimationFrame(caretRaf)
  cancelAnimationFrame(fuiteRaf)
  miroirCaret?.remove()
  clearInterval(syncTimer)
  clearInterval(morphTimer)
  clearTimeout(bulleTimer)
  clearTimeout(feteTimer)
  window.removeEventListener('keydown', auClavier)
  window.removeEventListener('popstate', auPopState)
  window.removeEventListener('pointerdown', auDehors, true)
  window.removeEventListener('click', auClicApresFermeture, true)
  window.removeEventListener('pointermove', auFuiteClaim)
  document.documentElement.removeEventListener('pointerleave', auFuiteFin)
  lacher()
})

</script>

<template>
  <div
    class="mur"
    :class="[claim && 'mur--claim', inicio && 'mur--inicio']"
    @click.capture="auClicPage"
    :style="
      inicio || claim
        ? { '--bot-escala': overlay.escala, '--bot-alto': overlay.altura, '--texto-alto': overlay.textoY }
        : undefined
    "
  >
    <h1 class="sr-only">{{ t('meetup.title') }}</h1>

    <ChampBots
      v-if="inicio"
      @choisir="ouvrirMini"
      :velocidad="overlay.velocidad"
      :formas="overlay.formas"
      :colores="overlay.colores"
      :ojos="overlay.ojos"
      :tamano="overlay.tamano"
      :cantidad="overlay.cantidad"
    />

    <!-- Monte en permanence : une transition ne joue pas au premier style, et
         demonter le bouton a la fermeture lui interdirait de s'effacer. -->
    <a
      v-show="!claim"
      class="repo-lien"
      :href="REPO"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="t('wall.repoAria')"
    >
      <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M8 .5a7.5 7.5 0 0 0-2.37 14.62c.37.07.5-.16.5-.36v-1.3c-2.09.46-2.53-.99-2.53-.99-.34-.87-.83-1.1-.83-1.1-.68-.47.05-.46.05-.46.75.06 1.15.78 1.15.78.67 1.15 1.76.82 2.19.63.07-.49.26-.83.48-1.02-1.67-.19-3.42-.83-3.42-3.72 0-.82.29-1.5.78-2.02-.08-.19-.34-.96.07-1.99 0 0 .63-.2 2.06.77a7.1 7.1 0 0 1 3.75 0c1.43-.97 2.06-.77 2.06-.77.41 1.03.15 1.8.07 1.99.49.52.78 1.2.78 2.02 0 2.9-1.76 3.53-3.44 3.71.27.23.51.69.51 1.39v2.06c0 .2.13.44.51.36A7.5 7.5 0 0 0 8 .5z"
          fill="currentColor"
        />
      </svg>
      Repo
    </a>

    <button
      type="button"
      class="retour"
      :inert="!claim || undefined"
      @click="fermerCouche"
    >
      {{ t('meetup.back') }}
    </button>

    <button type="button" class="editer" :aria-expanded="edition" @click="edition = !edition">
      {{ edition ? t('wall.done') : t('wall.edit') }}
    </button>

    <div v-if="edition" class="reglages">
      <MeetupSettings v-model="mur" v-model:overlay="overlay" :inicio="inicio" :claim="claim" />
    </div>

    <div class="haut">
      <div class="duo">
        <div class="ancre">
          <section class="copie">
            <p class="marque" :aria-hidden="inicio ? true : undefined">
              <img src="/brand/grok-bot-wordmark.png" :alt="t('meetup.title')" />
            </p>
            <p
              class="lieu"
              :class="[inicio && 'lieu--reveal', inicio && pastille?.tipo === 'titulo' && 'lieu--on']"
              :style="styleTitre()"
              @contextmenu="auMenuTitre"
            >{{ sousTitre() }}<a
              v-if="inicio && evento"
              class="evento"
              :href="evento.url"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="t('meetup.eventAria', { name: evento.name })"
              @contextmenu.stop
            >
              <!--
                Solar `square-arrow-right-up-linear`, recopié tel quel.
                La page Luma, a droite du titre, sans repeter son nom.
              -->
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5">
                  <path stroke-linejoin="round" d="M9 15L15 9M15 13.5V9H10.5" />
                  <path d="M12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22Z" />
                </g>
              </svg>
            </a></p>
            <p class="pronto" :style="stylePronto()" :aria-hidden="inicio ? undefined : true">{{ textePronto }}</p>
            <button
              ref="btnClaim"
              type="button"
              class="claim"
              :aria-expanded="claim"
              :inert="claim || undefined"
              @click="ouvrirClaim"
            >
              {{ t('meetup.claim') }}
            </button>
            <button
              v-if="inicio"
              type="button"
              class="speakers"
              @click="speakers = true"
            >{{ t('meetup.speakers') }}</button>
          </section>
        </div>

        <aside class="qr" :inert="!claim || undefined">
          <form
            v-if="!pase"
            class="pase"
            @submit.prevent="enviarCorreo"
          >
            <div class="pase-caja">
              <label class="pase-etiqueta" for="correo-pase">{{ t('meetup.emailLabel') }}</label>
              <!--
                Solar `letter-linear`, recopié tel quel. La piste grise
                (`emailHint`) dit quel courriel ecrire ; le libelle reste pour
                le lecteur d'ecran.
              -->
              <svg class="pase-marca" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5">
                  <path d="M10 20H14C17.7712 20 19.6569 20 20.8284 18.8284C22 17.6569 22 15.7712 22 12C22 8.22876 22 6.34315 20.8284 5.17157C19.6569 4 17.7712 4 14 4H10C6.22876 4 4.34315 4 3.17157 5.17157C2 6.34315 2 8.22876 2 12C2 15.7712 2 17.6569 3.17157 18.8284C4.34315 20 6.22876 20 10 20Z" />
                  <path d="M6 8L8.1589 9.79908C9.99553 11.3296 10.9139 12.0949 12 12.0949C13.0861 12.0949 14.0045 11.3296 15.8411 9.79908L18 8" />
                </g>
              </svg>
              <input
                id="correo-pase"
                ref="inputCorreo"
                v-model="correo"
                type="text"
                autocomplete="email"
                inputmode="email"
                pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
                spellcheck="false"
                required
                :placeholder="t('meetup.emailHint')"
                :disabled="enviando"
                @focus="auFocusCaret"
                @blur="auBlurCaret"
                @keydown.enter="auEnterCorreo"
              />
            </div>
            <button
              ref="btnPase"
              type="submit"
              class="pase-accion"
              :disabled="enviando"
              @keydown.enter="auEnterBoton"
            >
              {{ t('meetup.claim') }}
            </button>
            <p v-if="enviando" class="pase-estado">{{ t('meetup.emailSending') }}</p>
            <p v-if="esperaEvento" class="pase-error" role="status">
              {{ t('meetup.emailEarly') }}<button type="button" class="pase-speakers" @click="speakers = true">{{ t('meetup.speakers') }}</button>{{ t('meetup.emailEarlyAfter') }}
            </p>
            <p v-else-if="codigoPase === 'ausente'" class="pase-error" role="alert">
              {{ t('meetup.emailAbsent') }}<a
                v-if="evento"
                class="pase-speakers"
                :href="evento.url"
                target="_blank"
                rel="noopener noreferrer"
              >Luma</a><template v-else>Luma</template>{{ t('meetup.emailAbsentAfter') }}
            </p>
            <p v-else-if="errorPase" class="pase-error" role="alert">{{ errorPase }}</p>
          </form>
        </aside>

      <div class="scene">
        <div
          v-if="claim && (evento || olee || risa)"
          class="bulle bulle--olee bulle--ouverte"
          role="status"
        >
          <p v-if="risa" class="bulle-texte">{{ t('meetup.risa') }}</p>
          <p v-else-if="olee" class="bulle-texte">{{ t('meetup.olee') }}</p>
          <p v-else-if="evento" class="bulle-texte">
            {{ t('meetup.emailBubble') }}
            <a
              class="bulle-luma"
              :href="evento.url"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="t('meetup.eventAria', { name: evento.name })"
            >luma</a>
          </p>
        </div>
        <div
          v-if="bulle && !claim && !inicio"
          class="bulle"
          :class="bulle.phase === 'points' && 'bulle--points'"
        >
          <span v-if="bulle.phase === 'points'" class="points" aria-hidden="true">
            <i /><i /><i />
          </span>
          <p v-else class="bulle-texte">{{ welcome(t('meetup.welcome'), bulle.nom) }}</p>
        </div>

        <div
          class="avatar"
          :class="(inicio || claim) && 'avatar--abajo'"
          @click="auClicPrincipal"
          @contextmenu.prevent="auClicSecondaire"
        >
          <BloubBot
            v-model:state="state"
            v-model:block="block"
            v-model:playing="playing"
            :cycle="cycle"
            :size="720"
            :shape="shape"
            :color="color"
            :expression="expression"
            :paper="PAPER"
            follow
            :glance="overlay.mirada"
            :aim-at="caretActif ? pointCaret : null"
          />
        </div>
      </div>
      </div>
    </div>

    <footer
      v-show="overlay.firmaVisible"
      ref="pied"
      class="presente"
      :style="styleFirma()"
    >
      <div
        class="firma-piece"
        :class="pastille?.tipo === 'firma' && 'firma-piece--on'"
        @pointerdown="auPointeurFirma"
        @contextmenu.prevent="auMenuFirma"
      >
        <p class="presente-label">{{ texteFirma }}</p>
        <img class="spacex" src="/brand/spacex-wordmark.png" alt="SpaceX" draggable="false" />
        <span
          v-if="pastille?.tipo === 'firma'"
          class="poignee"
          @pointerdown.stop="auPoigneeFirma"
        />
      </div>
    </footer>

    <div
      v-if="pastille"
      class="pastille"
      :class="pastille.tipo === 'principal' && 'pastille--grande'"
      :style="{ left: `${pastille.x}px`, top: `${pastille.y}px` }"
      @pointerdown="auPointeurPastille"
    >
      <p class="pastilla-titre">
        {{
          pastille.tipo === 'principal'
            ? t('wall.mainBot')
            : pastille.tipo === 'firma'
              ? t('wall.presentedBlock')
              : pastille.tipo === 'titulo'
                ? t('wall.titleText')
                : t('wall.fieldBots')
        }}
      </p>
      <template v-if="pastille.tipo === 'principal'">
        <div v-if="inicio" class="formas">
          <BotTile
            v-for="s in SHAPES"
            :key="s.id"
            :label="t(`shapes.${s.id}`)"
            :selected="s.id === shape"
            :shape="s.id"
            :color="color"
            :expression="expression"
            :frozen-at="1"
            :size="48"
            @click="shape = s.id"
          />
          <button
            type="button"
            class="muestra"
            :aria-label="t('panel.color')"
            :aria-expanded="coloresAbiertos"
            @click="basculerColores"
          >
            <!--
              48 px : la meme boite que la vignette. Le disque et le crayon
              tiennent dedans, donc « Color » tombe sur la meme ligne que les
              noms de forme.
            -->
            <span class="muestra-marco">
              <span class="muestra-disco" :style="{ background: teintActuel }" />
              <svg class="muestra-lapiz" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                />
              </svg>
            </span>
            <span class="muestra-nombre">{{ t('panel.color') }}</span>
          </button>
        </div>
        <label>
          {{ t('wall.scale') }}
          <input v-model.number="overlay.escala" type="range" min="1" max="4" step="0.05" />
        </label>
        <label>
          {{ t('wall.height') }}
          <input v-model.number="overlay.altura" type="range" min="-12" max="24" step="0.5" />
        </label>
      </template>
      <template v-else-if="pastille.tipo === 'titulo'">
        <input
          class="pastille-texte"
          type="text"
          v-model="brouillonTitre"
          spellcheck="false"
          autocomplete="off"
          @input="poserTitre(brouillonTitre)"
        />
        <label>
          {{ t('wall.textSize') }}
          <input v-model.number="overlay.tituloTam" type="range" min="2" max="8" step="0.05" />
        </label>
      </template>
      <template v-else-if="pastille.tipo === 'firma'">
        <label>
          {{ t('wall.textSize') }}
          <input v-model.number="overlay.firmaTam" type="range" min="0.6" max="2" step="0.05" />
        </label>
      </template>
      <template v-else>
        <label>
          {{ t('wall.textSize') }}
          <input v-model.number="overlay.tamano" type="range" min="0.45" max="2.2" step="0.05" />
        </label>
        <label>
          {{ t('wall.pace') }}
          <input v-model.number="overlay.velocidad" type="range" min="0.3" max="3" step="0.1" />
        </label>
        <label>
          {{ t('wall.availableBots') }}
          <input v-model.number="overlay.cantidad" type="range" min="1" max="24" step="1" />
        </label>
      </template>
    </div>

    <div
      v-if="coloresAbiertos && lugarColores"
      class="teintes teintes--flotante"
      :style="{ left: `${lugarColores.x}px`, top: `${lugarColores.y}px` }"
      @pointerdown.stop
    >
      <button
        v-for="c in COLORS"
        :key="c.id"
        type="button"
        :aria-label="t(`colors.${c.id}`)"
        :aria-pressed="c.id === color"
        @click="choisirCouleur(c.id)"
      >
        <span :style="{ background: c.hex }" />
      </button>
    </div>

    <dialog
      ref="boiteCreditos"
      class="dialogue creditos-boite"
      :aria-label="pase ? preguntaCredito(pase.name) : t('meetup.creditAsk')"
      @close="fermerCreditos()"
      @cancel.prevent="fermerCreditos()"
      @click="fermerCreditos"
    >
      <template v-if="pase">
      <p class="pase-pregunta">{{ preguntaCredito(pase.name) }}</p>
      <p class="pase-nota creditos-duda">{{ t('meetup.creditUnsure') }}</p>
      <div class="creditos-par">
        <button type="button" class="pase-via pase-via--cuadro" :disabled="!pase.nuevo" @click="abrirCredito(pase.nuevo)">
          {{ t('meetup.creditNew') }}
        </button>
        <button type="button" class="pase-via pase-via--cuadro pase-via--linea" :disabled="!pase.existente" @click="abrirCredito(pase.existente)">
          {{ t('meetup.creditOld') }}
        </button>
      </div>
      </template>
    </dialog>

    <dialog
      ref="boiteSpeakers"
      class="dialogue speakers-boite"
      :aria-label="t('meetup.speakers')"
      @close="speakers = false"
      @cancel.prevent="speakers = false"
      @click="fermerSpeakers"
    >
      <img src="/brand/speakers.webp" width="1024" height="576" :alt="t('meetup.speakersAlt')" />
    </dialog>
  </div>
</template>

<style scoped>
@font-face {
  font-family: 'Universal Sans Display';
  src: url('/brand/UniversalSans-Display-400.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Universal Sans Display';
  src: url('/brand/UniversalSans-Display-550.woff2') format('woff2');
  font-weight: 550;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Universal Sans Text';
  src: url('/brand/UniversalSans-Text-400.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Universal Sans Text';
  src: url('/brand/UniversalSans-Text-550.woff2') format('woff2');
  font-weight: 550;
  font-style: normal;
  font-display: swap;
}

.mur {
  --mur-paper: #f6f6f6;
  --mur-ink: #111111;
  --bascule: 1s cubic-bezier(0.22, 1, 0.36, 1);
  position: relative;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--mur-paper);
  color: var(--mur-ink);
  overflow: hidden;
  font-family: 'Universal Sans Text', ui-sans-serif, system-ui, sans-serif;
}

.repo-lien {
  position: absolute;
  top: 1.6rem;
  left: 1.75rem;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: #8a8a8a;
  font-family: 'Universal Sans Text', sans-serif;
  font-size: 0.95rem;
  font-weight: 400;
  letter-spacing: -0.01em;
  text-decoration: none;
}

.repo-lien svg {
  flex-shrink: 0;
}

.repo-lien:hover {
  color: var(--mur-ink);
}

.retour {
  position: absolute;
  top: 1.6rem;
  left: 1.75rem;
  z-index: 3;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font-family: 'Universal Sans Text', sans-serif;
  font-size: 0.95rem;
  font-weight: 400;
  letter-spacing: -0.01em;
  color: #8a8a8a;
  text-decoration: underline;
  text-underline-offset: 0.22em;
  text-decoration-thickness: 1px;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease-out;
}

.mur--claim .retour {
  opacity: 1;
  pointer-events: auto;
  transition: opacity 0.35s ease-out 0.25s;
}

.retour:hover {
  color: var(--mur-ink);
}

.editer {
  position: absolute;
  top: 1.6rem;
  right: 1.75rem;
  z-index: 4;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font-family: 'Universal Sans Text', sans-serif;
  font-size: 0.95rem;
  font-weight: 400;
  letter-spacing: -0.01em;
  color: #8a8a8a;
  text-decoration: underline;
  text-underline-offset: 0.22em;
  text-decoration-thickness: 1px;
  cursor: pointer;
}

.editer:hover {
  color: var(--mur-ink);
}

.reglages {
  position: absolute;
  top: 3.6rem;
  right: 1.75rem;
  z-index: 4;
}

/*
 * Le champ est derriere .haut. Sans ca, le clic sur un petit bot tombe sur
 * la couche du texte et n'atteint jamais le grain.
 */
.mur--inicio .haut {
  z-index: 1;
  pointer-events: none;
}

.mur--inicio .copie,
.mur--inicio .qr {
  pointer-events: auto;
}

.haut {
  --copie-w: 20rem;
  --qr-w: min(58vh, 34vw);
  --duo-gap: clamp(1.5rem, 4vw, 4rem);
  --avatar-w: min(68vh, 46rem, 48vw);
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 5vw 0.5rem;
}

.duo {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--duo-gap);
  min-width: 0;
}

.ancre {
  flex: 0 0 auto;
  width: var(--copie-w);
  align-self: center;
  overflow: visible;
}

.copie {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: var(--copie-w);
  transform: translate(0, 0);
  transition:
    transform var(--bascule),
    width var(--bascule);
}

.mur--claim .copie {
  align-items: center;
  width: min(100%, 22rem);
  margin-inline: auto;
  /* Meme calage que le titre de l'ouverture : en haut, au centre de la boule. */
  transform: translate(calc((var(--avatar-w) + var(--duo-gap)) / 2), calc(3rem - 28vh - var(--texto-alto, 0) * 1rem));
}

.qr {
  position: absolute;
  left: 0;
  top: 50%;
  z-index: 1;
  width: var(--qr-w);
  opacity: 0;
  transform: translate(22vw, -30%) scale(0.4);
  transform-origin: center center;
  pointer-events: none;
  transition:
    transform var(--bascule),
    opacity 0.35s ease-out;
}

.mur--claim .qr {
  left: 50%;
  width: min(100%, 22rem);
  opacity: 1;
  /* Juste sous le titre, qui est monte de 28vh. Le mobile remet le flux plus bas. */
  transform: translate(-50%, calc(3rem - 28vh + 4.25rem - var(--texto-alto, 0) * 1rem));
  pointer-events: auto;
}

.qr-img {
  display: block;
  width: 100%;
  height: auto;
}

.mur--claim .qr {
  display: flex;
  align-items: center;
  justify-content: center;
}

.pase {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.75rem;
  width: min(100%, 22rem);
}

.pase-caja {
  display: flex;
  align-items: center;
  min-height: 3.25rem;
  padding: 0 1.15rem;
  background: #f2f2f4;
  border: 1px solid #b0b2b8;
  border-radius: 999px;
}

.pase-caja:focus-within {
  background: #fff;
  border-color: #9b9da4;
}

.pase-etiqueta {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.pase-caja input {
  width: 100%;
  min-width: 0;
  margin: 0;
  border: 0;
  background: transparent;
  color: #111;
  font: inherit;
  /*
   * iOS agrandit toute la page au focus si la police calculee passe sous
   * 16 px. `max` garde le corps actuel et empeche de descendre en dessous.
   * `appearance` retire le champ natif, qui se dessinait plus gros.
   */
  font-size: max(16px, 1.05rem);
  appearance: none;
  touch-action: manipulation;
  letter-spacing: -0.01em;
}

.pase-caja input:focus {
  outline: none;
}

.pase-caja input::placeholder {
  color: #8a8a8a;
}

.pase-marca {
  flex: none;
  margin-right: 0.65rem;
  color: #8a8a8a;
}

.pase-accion {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 3.25rem;
  margin: 0;
  padding: 0 1.15rem;
  border: 0;
  border-radius: 999px;
  background: #111;
  color: #fff;
  font: inherit;
  font-size: 1rem;
  letter-spacing: -0.01em;
  cursor: pointer;
}

.pase-accion:hover {
  background: #2a2a2a;
}

.pase-accion:disabled {
  cursor: default;
}

.pase-estado {
  margin: 0.65rem 0 0;
  font-size: 0.82rem;
  color: #8a8a8a;
}

.pase-pregunta {
  margin: 1rem 0 0;
  text-align: center;
  font-size: 1rem;
  line-height: 1.35;
  letter-spacing: -0.02em;
}

.pase-vias {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  margin-top: 0.85rem;
  gap: 0.45rem;
}

.pase-via {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 3.25rem;
  margin: 0;
  padding: 0 1.15rem;
  border: 0;
  border-radius: 999px;
  background: #111;
  color: #fff;
  font: inherit;
  font-size: 1rem;
  letter-spacing: -0.01em;
  text-decoration: none;
  cursor: pointer;
}

.pase-via:hover {
  background: #2a2a2a;
}

.pase-via:disabled {
  cursor: default;
  opacity: 0.45;
}

.pase-via--linea {
  background: #fff;
  color: #111;
  border: 1px solid #d6d6d6;
}

.pase-via--linea:hover {
  background: #f3f3f3;
}

.creditos-par {
  display: flex;
  align-items: stretch;
  align-self: stretch;
  gap: 0;
  margin: 0.95rem -1rem 0;
  border-top: 1px solid rgb(60 60 67 / 0.16);
}

.creditos-boite .pase-via--cuadro {
  box-sizing: border-box;
  flex: 1 1 0;
  width: auto;
  height: 2.75rem;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #111;
  font-size: 1.05rem;
  font-weight: 400;
  letter-spacing: -0.01em;
}

.creditos-boite .pase-via--cuadro:first-child {
  font-weight: 550;
}

.creditos-boite .pase-via--cuadro:hover,
.creditos-boite .pase-via--linea:hover {
  background: rgb(0 0 0 / 0.04);
}

.creditos-boite .pase-via--linea {
  background: transparent;
  border: 0;
  border-left: 1px solid rgb(60 60 67 / 0.16);
}

.pase-nota {
  margin: 0;
  text-align: center;
  font-size: 0.78rem;
  line-height: 1.35;
  color: #8a8a8a;
}

.pase-atras {
  align-self: center;
  margin-top: 0.35rem;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: 0.95rem;
  letter-spacing: -0.01em;
  color: #111;
  text-decoration: underline;
  text-underline-offset: 0.22em;
  cursor: pointer;
}

.pase-error {
  margin: 0.65rem 0 0;
  font-size: 0.82rem;
  line-height: 1.35;
  color: #8a1c1c;
}

.pase-speakers {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 0.14em;
  cursor: pointer;
}

.creditos-boite {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: min(17.5rem, calc(100vw - 2.5rem));
  max-height: calc(100dvh - 2rem);
  /* `translate` et non `transform` : l'ouverture du dialogue remet transform a none. */
  top: 50%;
  left: 50%;
  right: auto;
  bottom: auto;
  height: fit-content;
  margin: 0;
  translate: -50% -50%;
  padding: 1.15rem 1rem 0;
  overflow: hidden;
  border: 0;
  border-radius: 0.9rem;
  background: #fff;
  color: #111;
  box-shadow: 0 16px 50px rgb(0 0 0 / 0.16);
}

.creditos-boite .pase-pregunta {
  margin: 0;
  padding: 0 0.25rem;
  font-weight: 550;
  font-size: 1.02rem;
  letter-spacing: -0.022em;
}

.creditos-duda {
  margin: 0.28rem 0 0;
  padding: 0 0.35rem;
  font-size: 0.82rem;
  color: #8e8e93;
}

.pase-nombre,
.pase-quien {
  margin: 0.75rem 0 0;
  text-align: center;
  font-size: 0.95rem;
}

.pase-quien {
  margin-top: 0.2rem;
  color: #8a8a8a;
}

.marque {
  margin: 0;
  width: 100%;
  max-height: 8rem;
  overflow: hidden;
  transition:
    opacity 0.35s ease-out,
    max-height var(--bascule),
    margin var(--bascule);
}

.mur--inicio .marque {
  max-height: 0;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}

.marque img {
  display: block;
  width: 100%;
  height: auto;
}

/* Le png porte le bot a gauche (23 % de la largeur). On ne garde que le mot. */
.mur--claim .marque {
  width: 77%;
  margin-inline: auto;
  overflow: hidden;
}

.mur--claim .marque img {
  width: calc(100% / 0.77);
  max-width: none;
  margin-left: calc(100% * -0.23 / 0.77);
}

.lieu {
  margin: 0.7rem 0 0;
  font-family: 'Universal Sans Display', 'Universal Sans Text', sans-serif;
  font-size: clamp(1.35rem, 2.4vw, 2rem);
  font-weight: 400;
  letter-spacing: -0.03em;
  line-height: 1.05;
  text-align: left;
  white-space: nowrap;
}

.mur--claim .lieu,
.mur--inicio .lieu {
  width: 100%;
  text-align: center;
}

/*
 * Jusqu'a 100rem, la taille reglee. Le titre, la ligne d'attente et le
 * bouton ne grandissent qu'au-dela, et au plus de 1,25 : a 64rem deja
 * 1,8 rendait le mot gigantesque. Sous 64rem la media query remplace
 * ces tailles.
 */
.mur--inicio {
  --escena: clamp(1, 100vw / 100rem, 1.25);
}

.mur--inicio .lieu {
  /* La colonne reste a 20rem, mais le mot a 76 px ne tient pas dedans : le
     clip du reveal coupait alors la fin. La boite suit le texte, centree
     sur la meme colonne. Sous 64rem la media query plafonne --titulo-tam. */
  width: max-content;
  max-width: none;
  overflow: visible;
  font-size: calc(var(--titulo-tam, 4.75rem) * var(--escena, 1));
}

.mur--inicio .lieu--reveal {
  animation: lieu-reveal 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.mur--inicio .lieu--on {
  outline: 1.5px solid #2f6fed;
  outline-offset: 6px;
}

@keyframes lieu-reveal {
  from {
    clip-path: inset(100% 0 0 0);
  }
  to {
    clip-path: inset(0 0 0 0);
  }
}

.pronto {
  margin: 0;
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transform: translateY(0.75rem);
  font-family: 'Universal Sans Display', 'Universal Sans Text', sans-serif;
  font-size: clamp(1.45rem, 2.8vw, 2.25rem);
  font-weight: 400;
  letter-spacing: -0.03em;
  line-height: 1.05;
  text-align: center;
  white-space: nowrap;
  transition:
    max-height var(--bascule),
    margin var(--bascule),
    opacity 0.45s ease-out 0.12s,
    transform var(--bascule);
}

.mur--inicio .pronto {
  margin-top: 0.9rem;
  max-height: calc(4.5rem * var(--escena, 1));
  overflow: visible;
  opacity: 1;
  transform: translateY(0);
  font-size: calc(var(--pronto-tam, 2.25rem) * var(--escena, 1));
}

/* Page Luma, a droite du titre. Le carre suit la taille de la ligne. */
.evento {
  display: inline-flex;
  margin-left: 0.22em;
  vertical-align: 0.06em;
  color: inherit;
  text-decoration: none;
}

.evento svg {
  width: 0.38em;
  height: 0.38em;
}

.evento:hover {
  color: var(--ink);
}

.claim {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 1.15rem 0 0;
  padding: calc(0.42rem * var(--escena, 1)) calc(1.05rem * var(--escena, 1));
  border: 0;
  border-radius: 999px;
  background: #111;
  font-family: 'Universal Sans Text', sans-serif;
  font-size: calc(0.92rem * var(--escena, 1));
  font-weight: 400;
  letter-spacing: -0.01em;
  color: #fff;
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.35s ease-out, background 0.2s ease-out;
}

.claim:hover {
  background: #2a2a2a;
}

.speakers {
  margin: 0.85rem 0 0;
  padding: 0;
  border: 0;
  background: none;
  color: #8a8a8a;
  font-family: 'Universal Sans Text', sans-serif;
  font-size: 0.95rem;
  font-weight: 400;
  letter-spacing: -0.01em;
  line-height: 1.2;
  text-decoration: underline;
  text-underline-offset: 0.16em;
  cursor: pointer;
}

.speakers:hover {
  color: #5e5e5e;
}

.speakers-boite {
  margin: auto;
  width: min(56rem, calc(100vw - 2rem));
  max-width: calc(100vw - 2rem);
  padding: 0;
  border: 0;
  background: transparent;
  overflow: visible;
}

.speakers-boite img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 0.75rem;
}

.mur--claim .claim {
  opacity: 0;
  pointer-events: none;
  margin-top: 0;
  height: 0;
  overflow: hidden;
}

.mur--inicio .presente {
  position: relative;
  z-index: 5;
  pointer-events: auto;
}

.presente {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  padding: 0.4rem 1.5rem 2.2rem;
  font-size: calc(0.95rem * var(--firma-tam, 1));
  transition: opacity 0.35s ease-out;
}

.firma-piece {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.55rem;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.firma-piece--on {
  outline: 1.5px solid #2f6fed;
  outline-offset: 8px;
}

.firma-piece:active {
  cursor: grabbing;
}

.poignee {
  position: absolute;
  right: -14px;
  bottom: -14px;
  width: 11px;
  height: 11px;
  box-sizing: border-box;
  background: #fff;
  border: 1.5px solid #2f6fed;
  cursor: nwse-resize;
  touch-action: none;
}

.presente-label {
  margin: 0;
  font-family: 'Universal Sans Text', sans-serif;
  font-size: 1em;
  font-weight: 400;
  letter-spacing: -0.01em;
  color: inherit;
}

.spacex {
  display: block;
  width: calc(11rem * var(--firma-tam, 1));
  height: auto;
  filter: var(--firma-filtro, none);
}

.formas {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.2rem;
  margin-top: 0.35rem;
}

.formas :deep(button) {
  min-width: 0;
  padding: 0.1rem;
}

.muestra {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  margin: 0;
  padding: 0.1rem;
  border: 2px solid transparent;
  border-radius: 0.75rem;
  background: none;
  color: #8a8a8a;
  font: inherit;
  cursor: pointer;
}

.muestra[aria-expanded='true'] {
  border-color: #111;
}

.muestra-marco {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  gap: 1px;
}

.muestra-disco {
  width: 1.7rem;
  height: 1.7rem;
  flex: none;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 14%);
}

.muestra-lapiz {
  width: 15px;
  height: 15px;
  flex: none;
  color: #111;
}

.muestra-nombre {
  font-size: 0.75rem;
  line-height: 1.25;
  text-align: center;
}

.teintes {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.35rem;
}

.teintes--flotante {
  position: fixed;
  z-index: 8;
  width: 12.4rem;
  padding: 0.55rem;
  background: #fff;
  border-radius: 0.85rem;
  box-shadow: 0 16px 40px rgb(0 0 0 / 20%);
}

.teintes button {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  margin: 0;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 999px;
  background: none;
  cursor: pointer;
}

.teintes button[aria-pressed='true'] {
  border-color: #111;
}

.teintes span {
  display: block;
  width: 76%;
  height: 76%;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 12%);
}

.pastille {
  position: fixed;
  z-index: 6;
  width: 14rem;
  padding: 0.8rem 0.9rem 0.95rem;
  background: #fff;
  border-radius: 0.95rem;
  box-shadow: 0 14px 36px rgb(0 0 0 / 16%);
}

.pastille--grande {
  width: 16.5rem;
}

.pastilla-titre {
  margin: 0 0 0.35rem;
  font-family: 'Universal Sans Text', sans-serif;
  font-size: 0.82rem;
  font-weight: 550;
}

.pastille label {
  display: grid;
  gap: 0.2rem;
  margin-top: 0.55rem;
  font-size: 0.75rem;
}

.pastille input[type='range'] {
  width: 100%;
  margin: 0;
  accent-color: var(--mur-ink);
}

.pastille-texte {
  width: 100%;
  margin: 0.45rem 0 0;
  padding: 0.28rem 0 0.38rem;
  border: 0;
  border-bottom: 1px solid #d6d6d6;
  border-radius: 0;
  background: transparent;
  color: #111;
  font: inherit;
  font-size: 0.95rem;
  letter-spacing: -0.01em;
}

.pastille-texte:focus {
  outline: none;
  border-bottom-color: #111;
}

.tonos {
  display: flex;
  gap: 0.35rem;
  margin-top: 0.55rem;
}

.tonos button {
  flex: 1;
  margin: 0;
  padding: 0.35rem 0.4rem;
  border: 0;
  border-radius: 999px;
  background: #f0f0f0;
  font: inherit;
  font-size: 0.75rem;
  color: inherit;
  cursor: pointer;
}

.tonos button[aria-pressed='true'] {
  background: var(--mur-ink);
  color: #fff;
}

/*
 * `display` et la largeur sont explicites : `styles.css` pose une grille
 * `.scene` a partir de 64rem pour l'editeur, et sans ca la boite du mur
 * retrecit alors que la boule, elle, garde `--avatar-w`. Le recentrage de
 * l'ouverture se calait alors a cote du milieu de la fenetre.
 */
.scene {
  position: relative;
  display: block;
  flex: 0 0 auto;
  width: var(--avatar-w);
}

/*
 * La boite du bot est bien plus grande que la silhouette. Seul le corps
 * peint recoit le clic ; le reste traverse jusqu'aux petits bots.
 */
.avatar {
  width: var(--avatar-w);
  transform: translate(0, 0) scale(1);
  transition: transform var(--bascule);
  pointer-events: none;
}

.avatar :deep(svg),
.avatar :deep(svg *) {
  pointer-events: none;
}

.avatar :deep(.corps) {
  pointer-events: visiblePainted;
  cursor: pointer;
}

/*
 * Ouverture : la boule descend et grossit vers le bas, centree, pour laisser
 * le texte en haut.
 */
.avatar--abajo {
  transform-origin: center top;
  transform: translate(calc((var(--copie-w) + var(--duo-gap)) / -2), calc(var(--bot-alto, 0) * -1vh)) scale(var(--bot-escala, 2.75));
}

.mur--inicio .copie {
  align-items: center;
  min-width: 0;
  overflow: visible;
  /* 1,75rem sous le calage d'origine. --texto-alto, comme l'altura du bot : positif monte. */
  transform: translate(calc((var(--avatar-w) + var(--duo-gap)) / 2), calc(3rem - 28vh - var(--texto-alto, 0) * 1rem));
}

.mur--inicio .ancre {
  min-width: 0;
  overflow: visible;
}

.avatar :deep(svg) {
  width: 100%;
  height: auto;
}

.bulle {
  position: absolute;
  z-index: 2;
  left: -8%;
  top: 6%;
  max-width: min(22rem, 70%);
  padding: 1.15rem 1.45rem 1.2rem;
  border-radius: 1.5rem 1.5rem 0.4rem 1.5rem;
  background: #fff;
  color: var(--mur-ink);
  border: 1px solid #ececec;
}

.bulle::after {
  content: '';
  position: absolute;
  right: -7px;
  bottom: 14px;
  width: 12px;
  height: 12px;
  background: #fff;
  border-right: 1px solid #ececec;
  border-bottom: 1px solid #ececec;
  transform: rotate(-45deg);
}

.bulle-texte {
  margin: 0;
  font-family: 'Universal Sans Display', 'Universal Sans Text', sans-serif;
  font-size: clamp(1.35rem, 2.5vw, 2rem);
  font-weight: 400;
  letter-spacing: -0.025em;
  line-height: 1.15;
}

/*
 * Meme bulle que l'accueil d'un invite : blanc, filet, coin serre du cote
 * de la queue. Ici elle est a droite du visage, donc la queue part a gauche.
 * Le lien « luma » ouvre l'evenement du serveur.
 */
.mur--claim .bulle--olee {
  position: fixed;
  top: auto;
  right: auto;
  left: calc(50% + 14vw);
  height: auto;
  bottom: 24vh;
  z-index: 6;
  width: max-content;
  max-width: min(22rem, 34vw);
  border-color: #b0b2b8;
  background: #e7e8ec;
  border-radius: 1.5rem 1.5rem 1.5rem 0.4rem;
  filter:
    drop-shadow(0 1px 1px rgb(17 17 17 / 8%))
    drop-shadow(0 10px 22px rgb(17 17 17 / 16%));
  opacity: 0;
  pointer-events: none;
  transform: scale(0.86);
  transform-origin: left center;
  transition:
    opacity 0.28s ease-out,
    transform 0.28s ease-out;
}

.mur--claim .bulle--olee .bulle-texte {
  text-wrap: pretty;
}

.bulle-luma {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 0.14em;
  pointer-events: auto;
}

.bulle-luma:hover {
  color: var(--ink);
}

.mur--claim .bulle--olee::after {
  right: auto;
  left: -7px;
  bottom: 14px;
  background: #e7e8ec;
  border: 0;
  border-left: 1px solid #b0b2b8;
  border-bottom: 1px solid #b0b2b8;
  transform: rotate(45deg);
}

.mur--claim .bulle--olee.bulle--ouverte {
  opacity: 1;
  transform: scale(1);
}

.points {
  display: flex;
  gap: 0.35rem;
  padding: 0.15rem 0.2rem;
}

.points i {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 50%;
  background: #bbb;
  animation: point 1s ease-in-out infinite;
}

.points i:nth-child(2) {
  animation-delay: 0.15s;
}

.points i:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes point {
  0%,
  80%,
  100% {
    opacity: 0.28;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-2px);
  }
}

@media (width < 64rem) {
  .editer,
  .reglages {
    right: 1.2rem;
  }

  .repo-lien,
  .retour {
    left: 1.2rem;
  }

  .haut {
    --avatar-w: min(72vw, 22rem);
    /* Du bas de l'ecran jusqu'au cercle peint (yeux a 97dvh, bord a 18,4 %). */
    --dessus-bot: calc(3dvh + 0.634 * var(--avatar-w) * var(--bot-escala, 2.75) / 2.75);
    flex-direction: column;
    justify-content: flex-start;
    padding: 3.4rem 1.4rem 0.4rem;
  }

  .copie,
  .mur--claim .copie,
  .mur--inicio .copie {
    transform: none;
    width: min(100%, 22rem);
    margin-inline: auto;
  }

  /* Le bloc descend jusqu'au bot. Positif sur --texto-alto le remonte. */
  .mur--inicio .haut {
    justify-content: flex-end;
    padding-bottom: calc(var(--dessus-bot) + 1.15rem + var(--texto-alto, 0) * 1rem);
  }

  .mur--inicio .copie {
    margin-top: 0;
  }

  .ancre {
    width: auto;
  }

  .qr,
  .mur--claim .qr {
    position: relative;
    left: auto;
    top: auto;
    width: min(100%, 18rem);
    margin-inline: auto;
    transform: none;
  }

  .qr {
    height: 0;
    opacity: 0;
  }

  .mur--claim .qr {
    height: auto;
    opacity: 1;
  }

  .duo {
    flex-direction: column;
    gap: 1.2rem;
  }

  /*
   * Le duo est le contenant positionne. Sans ca, le bot cale en absolu se
   * mesurerait au bloc de texte et non a l'ecran.
   */
  .mur--inicio .duo,
  .mur--claim .duo {
    position: static;
  }

  /*
   * Bureau : les yeux tombent a 97dvh, sur le bord bas. Dans le flux, un
   * decalage fixe les laissait plus haut des que le titre tenait sur une
   * ligne. On sort la scene du flux et on place son haut pour que les yeux,
   * a 44.8 % de la boite mise a l'echelle, retombent la. Le cercle peint
   * commence a 18.4 % : le plancher le garde sous le texte quand l'ecran
   * est trop court pour ce calage. L'altura monte toujours. L'echelle
   * reste celle du grand cercle.
   */
  .mur--inicio .scene,
  .mur--claim .scene {
    position: absolute;
    left: 50%;
    z-index: 0;
    transform: translateX(-50%);
    top: max(
      calc(97dvh - 0.448 * var(--avatar-w) * var(--bot-escala, 2.75) * 2.4 / 2.75 - var(--bot-alto, 0) * 1vh),
      calc(15rem - 0.184 * var(--avatar-w) * var(--bot-escala, 2.75) * 2.4 / 2.75)
    );
  }

  .avatar--abajo {
    transform: scale(calc(var(--bot-escala, 2.75) * 2.4 / 2.75));
  }

  /* 4.75rem (76 px) deborde a 375 px : on plafonne pour que la ligne tienne dans la colonne. */
  .mur--inicio .lieu {
    width: 100%;
    max-width: 100%;
    font-size: min(var(--titulo-tam, 4.75rem), clamp(1.85rem, 11.4vw, 2.85rem));
    line-height: 1.05;
    white-space: normal;
    text-wrap: balance;
  }

  .pronto,
  .mur--inicio .pronto {
    white-space: normal;
    font-size: min(var(--pronto-tam, 2.25rem), clamp(1.1rem, 5.8vw, 1.45rem));
  }

  /*
   * La bulle est contenue par la scene (son transform cree le bloc). On la
   * centre et on pose son milieu sur le haut du cercle peint (18,4 %), pour
   * qu'elle le recouvre a moitie.
   */
  .mur--claim .bulle--olee {
    left: 50%;
    right: auto;
    bottom: auto;
    top: calc(0.184 * var(--avatar-w) * var(--bot-escala, 2.75) * 2.4 / 2.75);
    width: min(17rem, calc(100vw - 3rem));
    max-width: min(17rem, calc(100vw - 3rem));
    transform: translate(-50%, -50%) scale(0.86);
    transform-origin: center center;
  }

  .mur--claim .bulle--olee.bulle--ouverte {
    transform: translate(-50%, -50%) scale(1);
  }

  .mur--claim .bulle--olee::after {
    left: 50%;
    right: auto;
    bottom: -7px;
    margin-left: -6px;
    border-left: 0;
    border-right: 1px solid #b0b2b8;
    border-bottom: 1px solid #b0b2b8;
    transform: rotate(45deg);
  }

  .bulle {
    left: 4%;
    top: -4%;
  }

  /* Claim : la firma ne tient pas. Titre et courriel sous « Volver », la boule sur le bot. */
  .mur--claim .presente {
    display: none;
  }

  /* Claim : titre et courriel juste au-dessus de la bulle, le bot reste au bord. */
  .mur--claim .haut {
    justify-content: flex-end;
    padding-top: 4.5rem;
    padding-bottom: calc(var(--dessus-bot) + 4.6rem);
  }

  .mur--claim .duo {
    flex: 0 0 auto;
    align-self: stretch;
    justify-content: flex-start;
    width: 100%;
    min-height: 0;
    gap: 0.85rem;
  }

  .mur--claim .qr {
    order: 2;
    width: min(100%, 22rem);
    margin-top: 0;
    padding-bottom: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .qr,
  .mur--claim .qr,
  .copie,
  .mur--claim .copie,
  .mur--inicio .copie,
  .avatar,
  .retour,
  .mur--claim .retour,
  .mur--inicio .retour,
  .pronto,
  .mur--inicio .pronto,
  .marque,
  .mur--inicio .marque,
  .presente,
  .mur--inicio .presente,
  .mur--inicio .lieu--reveal,
  .pase-etiqueta,
  .pase-accion,
  .claim {
    transition: none;
    animation: none;
  }

  .mur--inicio .lieu--reveal {
    clip-path: none;
  }
}
</style>
