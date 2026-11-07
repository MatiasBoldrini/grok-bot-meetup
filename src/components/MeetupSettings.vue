<script setup lang="ts">
import ClaimQr from '@/components/ClaimQr.vue'
import { LANGUES, langue, t } from '@/i18n'
import type { MeetupConfig } from '@/meetup/config'
import type { OverlayReglage } from '@/meetup/overlay'

const REPO = 'https://github.com/MatiasBoldrini/grok-bot-meetup'

type ClaveNumero = 'escala' | 'altura' | 'textoY' | 'velocidad'

const config = defineModel<MeetupConfig>({ required: true })
const overlay = defineModel<OverlayReglage>('overlay', { required: true })

defineProps<{ inicio: boolean; claim: boolean }>()

const CURSEURS = [
  ['escala', 'wall.scale', 1, 4, 0.05],
  ['altura', 'wall.height', -12, 24, 0.5],
  ['textoY', 'wall.textHeight', -10, 8, 0.25],
  ['velocidad', 'wall.speed', 0.3, 3, 0.1]
] as const

function setCurseur(key: ClaveNumero, value: string) {
  const n = Number(value)
  if (!Number.isFinite(n)) return
  overlay.value = { ...overlay.value, [key]: n }
}

function basculerFirma() {
  overlay.value = { ...overlay.value, firmaVisible: !overlay.value.firmaVisible }
}

function basculerMirada() {
  overlay.value = { ...overlay.value, mirada: !overlay.value.mirada }
}

function formatCurseur(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')
}

function setField(key: 'place' | 'claimUrl' | 'claimTitle', value: string) {
  config.value = { ...config.value, [key]: value }
}

function setMorph(value: string) {
  const n = Number(value)
  config.value = { ...config.value, morphSeconds: Number.isFinite(n) ? n : 10 }
}

/**
 * Clavier du radiogroup : les fleches deplacent le choix, Tab n'entre qu'une
 * fois. Sans ca le role promet un contrat que les boutons n'ont pas.
 */
function auClavier(event: KeyboardEvent, index: number) {
  const pas = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
  if (!pas) return
  event.preventDefault()
  const cible = LANGUES[(index + pas + LANGUES.length) % LANGUES.length]!
  langue.value = cible.id
  const boutons = (event.currentTarget as HTMLElement).parentElement?.children
  const suivant = boutons?.[LANGUES.indexOf(cible)]
  if (suivant instanceof HTMLElement) suivant.focus()
}
</script>

<template>
  <div class="fiche" :aria-label="t('wall.title')">
    <div class="picker" role="radiogroup" :aria-label="t('wall.language')">
      <button
        v-for="(l, i) in LANGUES"
        :key="l.id"
        type="button"
        role="radio"
        :aria-checked="l.id === langue"
        :aria-label="l.nom"
        :lang="l.tag"
        :tabindex="l.id === langue ? 0 : -1"
        @keydown="auClavier($event, i)"
        @click="langue = l.id"
      >
        <span aria-hidden="true">{{ l.emoji }}</span>
        {{ l.nom }}
      </button>
    </div>

    <template v-if="inicio">
        <label v-for="c in CURSEURS" :key="c[0]" class="regle">
          <span>
            {{ t(c[1]) }}
            <b>{{ formatCurseur(overlay[c[0]]) }}</b>
          </span>
          <input
            type="range"
            :min="c[2]"
            :max="c[3]"
            :step="c[4]"
            :value="overlay[c[0]]"
            @input="setCurseur(c[0], ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="firma-oculto mirada">
          <input type="checkbox" :checked="overlay.mirada" @change="basculerMirada" />
          <span>{{ t('wall.glance') }}</span>
        </label>
        <section class="firma">
          <p class="firma-titre">{{ t('wall.presentedBlock') }}</p>
          <label class="firma-oculto">
            <input type="checkbox" :checked="!overlay.firmaVisible" @change="basculerFirma" />
            <span>{{ t('wall.hidden') }}</span>
          </label>
        </section>
    </template>

    <template v-else-if="claim">
      <label class="champ">
        <span>{{ t('wall.claimTitle') }}</span>
        <input
          :value="config.claimTitle"
          type="text"
          autocomplete="off"
          spellcheck="false"
          :placeholder="t('meetup.cityClaim')"
          @input="setField('claimTitle', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="champ">
        <span>{{ t('wall.claimUrl') }}</span>
        <input
          :value="config.claimUrl"
          type="url"
          autocomplete="off"
          spellcheck="false"
          @input="setField('claimUrl', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <div class="qr">
        <ClaimQr v-if="config.claimUrl" :url="config.claimUrl" />
        <p v-else>{{ t('wall.qrEmpty') }}</p>
      </div>
    </template>

    <template v-else>
      <label class="champ">
        <span>{{ t('wall.place') }}</span>
        <input
          :value="config.place"
          type="text"
          autocomplete="off"
          spellcheck="false"
          @input="setField('place', ($event.target as HTMLInputElement).value)"
        />
      </label>

      <label class="champ champ--morph">
        <span>{{ t('wall.morph') }}</span>
        <span class="morph">
          <input
            :value="config.morphSeconds"
            type="number"
            min="1"
            max="120"
            step="1"
            inputmode="numeric"
            @input="setMorph(($event.target as HTMLInputElement).value)"
          />
          <span>{{ t('wall.morphUnit') }}</span>
        </span>
      </label>

      <label class="champ">
        <span>{{ t('wall.claimUrl') }}</span>
        <input
          :value="config.claimUrl"
          type="url"
          autocomplete="off"
          spellcheck="false"
          @input="setField('claimUrl', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <div class="qr">
        <ClaimQr v-if="config.claimUrl" :url="config.claimUrl" />
        <p v-else>{{ t('wall.qrEmpty') }}</p>
      </div>

      <a
        class="repo"
        :href="REPO"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="t('wall.repoAria')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M8 .5a7.5 7.5 0 0 0-2.37 14.62c.37.07.5-.16.5-.36v-1.3c-2.09.46-2.53-.99-2.53-.99-.34-.87-.83-1.1-.83-1.1-.68-.47.05-.46.05-.46.75.06 1.15.78 1.15.78.67 1.15 1.76.82 2.19.63.07-.49.26-.83.48-1.02-1.67-.19-3.42-.83-3.42-3.72 0-.82.29-1.5.78-2.02-.08-.19-.34-.96.07-1.99 0 0 .63-.2 2.06.77a7.1 7.1 0 0 1 3.75 0c1.43-.97 2.06-.77 2.06-.77.41 1.03.15 1.8.07 1.99.49.52.78 1.2.78 2.02 0 2.9-1.76 3.53-3.44 3.71.27.23.51.69.51 1.39v2.06c0 .2.13.44.51.36A7.5 7.5 0 0 0 8 .5z"
            fill="currentColor"
          />
        </svg>
        {{ t('wall.repo') }}
      </a>
    </template>
  </div>
</template>

<style scoped>
.fiche {
  width: min(16.5rem, calc(100vw - 2.4rem));
  max-height: calc(100dvh - 5.2rem);
  overflow: auto;
  padding: 1.05rem 1.15rem 1rem;
  background: #fff;
  border-radius: 0.95rem;
  color: inherit;
  font: inherit;
}

.picker {
  display: flex;
  gap: 1.15rem;
}

.picker button {
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: 0.92rem;
  letter-spacing: -0.01em;
  color: #8a8a8a;
  cursor: pointer;
}

.picker button[aria-checked='true'] {
  color: #111;
  text-decoration: underline;
  text-underline-offset: 0.22em;
  text-decoration-thickness: 1px;
}

.picker button:hover {
  color: #111;
}

.champ {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-top: 1.05rem;
  font-size: 0.78rem;
  letter-spacing: -0.01em;
  color: #8a8a8a;
}

.champ input {
  width: 100%;
  margin: 0;
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

.champ input:focus {
  outline: none;
  border-bottom-color: #111;
}

.morph {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.champ--morph input {
  width: 3.2rem;
}

.champ--morph input::-webkit-outer-spin-button,
.champ--morph input::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}

.champ--morph input[type='number'] {
  appearance: textfield;
}

.qr {
  margin-top: 0.85rem;
  width: 4.6rem;
}

.qr p {
  margin: 0;
  max-width: 11rem;
  font-size: 0.78rem;
  line-height: 1.35;
  color: #8a8a8a;
}

.overlay--solo {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}

.bloque {
  margin-top: 1.1rem;
  padding-top: 0.85rem;
  border-top: 1px solid #ececec;
}

.color {
  width: 2.4rem;
  height: 1.6rem;
  margin-top: 0.25rem;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

.overlay {
  margin-top: 1.15rem;
  padding-top: 0.9rem;
  border-top: 1px solid #ececec;
}

.overlay-titre {
  margin: 0 0 0.55rem;
  font-size: 0.78rem;
  letter-spacing: -0.01em;
  color: #8a8a8a;
}

.firma {
  margin-top: 1.15rem;
  padding-top: 1rem;
  border-top: 1px solid #ececec;
}

.firma-oculto {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.92rem;
  cursor: pointer;
}

.mirada {
  margin-top: 1.05rem;
}

.firma-titre {
  margin: 0 0 0.55rem;
  font-size: 0.78rem;
  letter-spacing: -0.01em;
  color: #8a8a8a;
}

.segmento {
  display: flex;
  gap: 0.2rem;
  padding: 0.18rem;
  border-radius: 999px;
  background: #f0f0f0;
}

.segmento label {
  position: relative;
  flex: 1;
  margin: 0;
}

.segmento input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.segmento span {
  display: block;
  padding: 0.32rem 0.2rem;
  border-radius: 999px;
  font-size: 0.82rem;
  text-align: center;
  color: #8a8a8a;
}

.segmento input:checked + span {
  background: #fff;
  color: #111;
}

.segmento input:focus-visible + span {
  outline: 1px solid #111;
  outline-offset: 1px;
}

.regle {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin-top: 0.75rem;
  font-size: 0.78rem;
  letter-spacing: -0.01em;
  color: #8a8a8a;
}

.regle b {
  color: #111;
  font-weight: 550;
}

.regle input[type='range'] {
  width: 100%;
  margin: 0;
  accent-color: #111;
}

.repo {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 1.15rem;
  font-size: 0.88rem;
  letter-spacing: -0.01em;
  color: #8a8a8a;
  text-decoration: underline;
  text-underline-offset: 0.22em;
  text-decoration-thickness: 1px;
}

.repo svg {
  flex-shrink: 0;
}

.repo:hover {
  color: #111;
}
</style>
