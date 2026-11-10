<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, triggerRef, watch } from 'vue'
import { t } from '@/i18n'
import { BotEngine, type BotFrame } from '@/bot/engine'
import { EXPRESSION_BY_ID, EXPRESSIONS, type ExpressionId } from '@/bot/expressions'
import { DEMI_VIEWBOX, RAYON } from '@/bot/repere'
import { COLOR_BY_ID, COLORS, SHAPES, type ColorId } from '@/bot/skins'
import { OVERLAY_BASE } from '@/meetup/overlay'

/**
 * Bots derriere l'overlay. La forme et les yeux sont poses une fois.
 * Le clic principal change CE bot : forme, couleur, yeux. Le clic
 * secondaire ouvre le menu. Seule la hauteur avance ; l'abscisse reste fixe.
 */
const props = withDefaults(
  defineProps<{
    velocidad?: number
    formas?: number
    colores?: number
    ojos?: number
    tamano?: number
    cantidad?: number
  }>(),
  {
    velocidad: OVERLAY_BASE.velocidad,
    formas: OVERLAY_BASE.formas,
    colores: OVERLAY_BASE.colores,
    ojos: OVERLAY_BASE.ojos,
    tamano: OVERLAY_BASE.tamano,
    cantidad: OVERLAY_BASE.cantidad
  }
)

const VB = DEMI_VIEWBOX
const PAPIER = '#f6f6f6'

/** Les huit couleurs deja en scene, puis le reste du catalogue. */
const ORDEN_COLOR: ColorId[] = [
  'bleu',
  'ambre',
  'vert',
  'violet',
  'rose',
  'orange',
  'turquoise',
  'encre',
  'brun',
  'rouge',
  'gris',
  'creme'
]
/** Les huit regards deja en scene, puis le reste du catalogue. */
const ORDEN_OJO: ExpressionId[] = [
  'neutre',
  'heureux',
  'curieux',
  'attentif',
  'timide',
  'blase',
  'somnolent',
  'fier',
  'surpris',
  'excite',
  'hilare',
  'colere',
  'triste',
  'effraye',
  'mefiant',
  'confus'
]

function tirage(i: number, k: number) {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return x - Math.floor(x)
}

function borne(n: number, max: number) {
  return Math.max(1, Math.min(max, Math.round(n)))
}

interface Grain {
  engine: BotEngine
  encre: string
  forme: number
  regard: number
  phase: number
  x0: number
  duree: number
  y0: number
  rot0: number
  base: number
}

interface Pose {
  x: number
  y: number
  rot: number
}

function fabriquer(): Grain[] {
  const n = borne(props.cantidad, 24)
  const formes = SHAPES.slice(0, borne(props.formas, SHAPES.length))
  const couleurs = ORDEN_COLOR.slice(0, borne(props.colores, COLORS.length))
  const regards = ORDEN_OJO.slice(0, borne(props.ojos, EXPRESSIONS.length))
  return Array.from({ length: n }, (_, i) => {
    const phase = tirage(i, 1) * 40
    const forme = formes[i % formes.length]!
    const regard = regards[i % regards.length]!
    const couleur = couleurs[i % couleurs.length]!
    return {
      engine: new BotEngine(
        RAYON,
        'idle',
        forme.radii,
        EXPRESSION_BY_ID.get(regard) ?? null
      ),
      encre: COLOR_BY_ID.get(couleur)?.hex ?? '#0a0a0c',
      forme: i % formes.length,
      regard: i % regards.length,
      phase,
      x0: 4 + tirage(i, 2) * 84,
      duree: 16 + tirage(i, 6) * 22,
      y0: tirage(i, 7),
      rot0: -18 + tirage(i, 11) * 36,
      base: 64 + Math.round(tirage(i, 12) * 62)
    }
  })
}

const grains = shallowRef<Grain[]>(fabriquer())

function place(g: Grain, t: number, fixe: boolean): Pose {
  if (fixe) return { x: g.x0, y: 8 + g.y0 * 72, rot: g.rot0 }
  const vitesse = Math.max(0.2, props.velocidad)
  const cycle = (t + g.phase) / (g.duree / vitesse)
  const u = cycle - Math.floor(cycle)
  return { x: g.x0, y: 112 - u * 140, rot: g.rot0 }
}

const reduit = ref(false)
const frames = shallowRef<BotFrame[]>(grains.value.map((g) => g.engine.sample(g.phase)))
const poses = shallowRef<Pose[]>(grains.value.map((g) => place(g, 0, false)))

watch(
  () => [props.cantidad, props.formas, props.colores, props.ojos],
  () => {
    grains.value = fabriquer()
    frames.value = grains.value.map((g) => g.engine.sample(clock + g.phase))
    poses.value = grains.value.map((g) => place(g, clock, reduit.value))
    triggerRef(frames)
    triggerRef(poses)
  }
)

let raf = 0
let last = 0
let clock = 0
let media: MediaQueryList | null = null

function auMedia() {
  reduit.value = media?.matches ?? false
}

function tick(ms: number) {
  raf = requestAnimationFrame(tick)
  const dt = last ? Math.min((ms - last) / 1000, 0.064) : 0
  last = ms
  clock += dt
  const fixe = reduit.value
  frames.value = grains.value.map((g) => g.engine.sample(clock + g.phase))
  poses.value = grains.value.map((g) => place(g, clock, fixe))
  triggerRef(frames)
  triggerRef(poses)
}

onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  auMedia()
  media.addEventListener('change', auMedia)
  raf = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  media?.removeEventListener('change', auMedia)
})

const emit = defineEmits<{
  choisir: [i: number, x: number, y: number]
}>()

function autreIndex(n: number, actuel: number) {
  if (n <= 1) return actuel
  let next = actuel
  while (next === actuel) next = Math.floor(Math.random() * n)
  return next
}

/** Ce bot-la, pas le grand : une autre forme, une autre couleur, d'autres yeux. */
function varier(i: number) {
  const g = grains.value[i]
  if (!g) return
  const formes = SHAPES.slice(0, borne(props.formas, SHAPES.length))
  const couleurs = ORDEN_COLOR.slice(0, borne(props.colores, COLORS.length))
  const regards = ORDEN_OJO.slice(0, borne(props.ojos, EXPRESSIONS.length))
  const now = clock + g.phase
  g.forme = autreIndex(formes.length, g.forme)
  g.regard = autreIndex(regards.length, g.regard)
  const actuel = couleurs.findIndex((id) => COLOR_BY_ID.get(id)?.hex === g.encre)
  const teinte = actuel < 0 ? Math.floor(Math.random() * couleurs.length) : autreIndex(couleurs.length, actuel)
  g.engine.setShape(formes[g.forme]!.radii, now)
  g.engine.setExpression(EXPRESSION_BY_ID.get(regards[g.regard]!) ?? null, now)
  g.encre = COLOR_BY_ID.get(couleurs[teinte]!)?.hex ?? g.encre
  triggerRef(grains)
}

function choisir(i: number, e: Event) {
  if (e instanceof MouseEvent && (e.clientX !== 0 || e.clientY !== 0)) {
    emit('choisir', i, e.clientX, e.clientY)
    return
  }
  const el = e.currentTarget
  if (!(el instanceof HTMLElement)) return
  const r = el.getBoundingClientRect()
  emit('choisir', i, r.left + r.width / 2, r.top + r.height / 2)
}
</script>

<template>
  <div class="champ">
    <div
      v-for="(grain, i) in grains"
      :key="i"
      class="grain"
      role="button"
      tabindex="0"
      :aria-label="t('wall.thisBot')"
      :style="{
        width: `${grain.base * tamano}px`,
        height: `${grain.base * tamano}px`,
        transform: `translate(${poses[i]!.x}vw, ${poses[i]!.y}vh) rotate(${poses[i]!.rot}deg)`
      }"
      @click.stop="varier(i)"
      @keydown.enter.prevent="varier(i)"
      @contextmenu.prevent.stop="choisir(i, $event)"
    >
      <svg
        :viewBox="`${-VB} ${-VB} ${VB * 2} ${VB * 2}`"
      >
        <defs>
          <mask
            :id="`mini-${i}`"
            maskUnits="userSpaceOnUse"
            :x="-VB"
            :y="-VB"
            :width="VB * 2"
            :height="VB * 2"
          >
            <path :d="frames[i]!.bodyPath" fill="#fff" />
            <path
              v-for="(eye, e) in frames[i]!.eyes"
              :key="e"
              :d="eye.d"
              :transform="eye.matrix"
              :opacity="eye.alpha"
              fill="#000"
            />
          </mask>
        </defs>
        <g :opacity="frames[i]!.bodyAlpha">
          <path :d="frames[i]!.bodyPath" :fill="PAPIER" />
          <g :mask="`url(#mini-${i})`">
            <rect :x="-VB" :y="-VB" :width="VB * 2" :height="VB * 2" :fill="grain.encre" />
          </g>
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.champ {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.grain {
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0.82;
  pointer-events: auto;
  cursor: pointer;
}

.grain svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}
</style>
