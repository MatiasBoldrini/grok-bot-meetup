import type { Look } from '@/bot/engine'
import type { ExpressionId } from '@/bot/expressions'
import { clamp, createRng, easings } from '@/bot/math'

/**
 * Ou le bot regarde quand il suit le curseur. Pur, comme `src/ui/timeline.ts` :
 * la position du pointeur entre en coordonnees deja normalisees, donc la regle
 * se teste sans DOM — et elle a besoin de l'etre, parce que deux signes s'y
 * trompent facilement.
 */

/**
 * Angles en degres d'orientation de tete. CHOISIS, pas releves : la video de
 * reference ne montre aucun suivi de curseur. Assez amples pour se distinguer de
 * la derive au repos (±7deg de lacet, ±5,5 de tangage), assez retenus pour
 * qu'aucun oeil ne parte derriere le limbe de la sphere.
 */
export const YAW_MAX = 16
export const PITCH_MAX = 13

/**
 * Hauteur a laquelle le regard se tient, curseur au centre. CHOISIE : legerement
 * au-dessus de l'equateur, ce qui donne un bot attentif plutot qu'absent.
 *
 * C'est une valeur ABSOLUE, et c'est tout le point : en relatif, la hauteur des
 * yeux suivait celle de chaque expression, et comme « neutre » regarde a
 * +28,6deg quand les humeurs sont entre -9 et +9, les yeux tombaient d'un coup
 * au premier changement d'humeur.
 */
export const PITCH = 10

/**
 * Tangage quand le bot lit un champ. `ny = 1` ne donne que `PITCH - PITCH_MAX`,
 * a peine sous l'equateur, et le caret tombe souvent pres du centre : on pose
 * donc le regard plus bas, pour que la lecture se voie. Pas jusqu'au limbe :
 * a -55 les yeux etaient a 0,79 rayon. Ici ils restent dans le bas du visage,
 * vers la ligne du champ. Le lacet suit les lettres. CHOISI, pas releve.
 */
export const PITCH_LECTURE = -22

/**
 * Amplitude du lacet quand on lit un champ, et rattrapage plus court. Pour la
 * souris, 16deg sur une demi-fenetre suffisent ; pour des lettres, le caret ne
 * parcourt que la largeur du champ, et a 16deg l'avance de la frappe se voyait
 * a peine. Ici le champ ENTIER vaut tout le debattement, et les yeux le
 * rattrapent en 0,12 s au lieu de 0,24 : ils doivent arriver avec la lettre.
 * CHOISIS, pas releves. Le test de visibilite en lecture couvre le bord.
 */
export const YAW_LECTURE = 34
export const LOOK_LECTURE = 0.12

/**
 * Direction ou la tete se pose dans la vue des reglages : le bot cesse de regarder en haut a
 * droite (sa pose de repos) pour regarder a GAUCHE, du cote du panneau.
 *
 * Ce n'est pas un miroir de l'image : les yeux font vraiment le tour de la
 * sphere, donc ils gardent leur inclinaison en `\\` et leur compression de
 * profondeur. Retourner l'image les aurait couches en `//`.
 */
export const TURN = 26

/**
 * Tour complet parcouru EN CHEMIN : les yeux ne glissent pas en travers du
 * visage, ils font le tour de la boule avant d'arriver.
 *
 * C'est gratuit parce que les yeux vivent sur une sphere : passe 90deg de lacet
 * ils franchissent le limbe, le moteur les retire de l'image, puis ils
 * reapparaissent de l'autre cote. Le tourbillon n'est donc pas un effet pose
 * par-dessus, c'est la meme projection orthographique poussee d'un tour.
 *
 * Et surtout : il ATTERRIT JUSTE par construction, `-360deg` etant le meme angle
 * que `0`. C'est ce qui le distingue d'une pose de regard ecrite dans un etat,
 * qui laisse les yeux la ou sa courbe se termine.
 */
export const SPIN = 360

/**
 * Duree du tour. Un peu plus courte que le bloc d'entree (`swirl`) : les yeux
 * doivent etre poses a gauche avant que les anneaux ne s'effacent.
 */
export const TURN_TIME = 1.1

/**
 * Humeurs que le bot traverse pendant qu'il suit le curseur.
 *
 * Toutes ont un ROULIS NUL, et c'est le critere de selection. Le lacet et le
 * tangage sont neutralises par le suivi (ils sont absolus), mais pas le roulis —
 * il fait pencher la tete, donc il deplace les yeux verticalement, et une humeur
 * a -15deg suivie d'une a +8 les fait sauter. Ce qui reste pour distinguer les
 * humeurs, c'est la FORME des yeux : ronds, plisses, ecarquilles, aplatis. C'est
 * largement suffisant, et c'est ce qui se lit.
 *
 * Ce n'est donc pas une liste de gouts : y ajouter « curieux » (roulis -15deg)
 * ramenerait le saut.
 */
export const HUMEURS: readonly ExpressionId[] = [
  'surpris',
  'heureux',
  'hilare',
  'excite',
  'fier',
  'blase'
]

/* ------------------------------------------------ regards de l'arrivee */

/**
 * Un regard SCRIPTE : evalue a chaque image avec le temps ecoule depuis le debut
 * de l'arrivee, en secondes. Le script porte donc sa propre horloge et peut
 * enchainer plusieurs mouvements — le composant ne fait que l'evaluer et n'a
 * aucune duree a connaitre.
 *
 * REGLE, et c'est elle qui rend un script sans entretien : il doit FINIR a
 * `mix: 0`, ou la pose de l'etat commande seule. Il n'y a alors jamais rien a
 * relacher, et ce relachement — qui se verrait sous la forme d'un dernier
 * glissement des yeux, juste quand tout devrait etre pose — n'existe pas.
 *
 * Le type reste general alors qu'il n'y a qu'un script aujourd'hui : quatre ont
 * ete ecrits et compares cote a cote avant d'en garder un, et c'est cette forme
 * qui a permis de les essayer sans toucher au moteur.
 */
export type GazeScript = (t: number) => Look

/**
 * « Le tour » : la boule a l'air de tourner sur elle-meme.
 *
 * `mix` reste a ZERO du debut a la fin : aucune direction n'est imposee, seul
 * `spin` fond, ce qui fait passer les yeux DERRIERE la boule avant de les
 * ramener exactement la ou l'expression choisie les met.
 *
 * Ease-in-OUT et non l'ease-out exponentiel du reste du projet : ce n'est pas une
 * valeur qui se pose, c'est un objet qui tourne. En ease-out, les deux tiers du
 * tour etaient avales en 0,3 s — un a-coup, pas une rotation.
 *
 * Il est VIF au passage du limbe — 20 px entre deux images sur une boule de 100
 * de rayon — et ce n'est pas un defaut de reglage : pres du bord, un petit angle
 * devient un grand deplacement a l'ecran, et l'oeil disparait puis reparait de
 * l'autre cote. Ralentir n'y change rien, c'est la trajectoire qui veut ca, et
 * c'est justement ce qui fait l'effet. Ne pas chercher a l'adoucir.
 *
 * Corollaire indispensable : ce tour ne se joue que sur un CERCLE. Les yeux sont
 * recolles au contour reel (`radiusAtAngle`), donc sur une forme non circulaire
 * ils suivent le profil en tournant et sautillent. Voir `forme` dans `App.vue`.
 */
export const TOUR_TIME = 1.5

export const tourLook: GazeScript = (t) => ({
  yaw: 0,
  pitch: 0,
  mix: 0,
  spin: SPIN * (1 - easings.easeInOutCubic(clamp(t / TOUR_TIME))),
  wander: 1
})

export interface Aim {
  /** ecart horizontal du pointeur au centre du bot, -1 a 1 (droite positive) */
  nx: number
  /** ecart vertical, -1 a 1, dans le sens de l'ecran (bas positif) */
  ny: number
  /** avancement de l'arrivee, 0 a 1 */
  tour: number
  /** false = aucun pointeur connu : la tete reste tournee, mais elle revit */
  pointer: boolean
  /**
   * true = on lit un champ. Le tangage se pose en bas (`PITCH_LECTURE`) et le
   * lacet suit le caret. `ny` est alors ignore.
   */
  lire?: boolean
  /**
   * Lacet ajoute, en degres, pour un regard de cote. 0 = rien. Le suivi du
   * pointeur reste la base : ceci s'y ajoute, comme un clignement s'ajoute a
   * l'oeil ouvert.
   */
  mirada?: number
}

/**
 * Cible de regard.
 *
 * `tour` mene tout : il fait monter l'emprise sur la pose (`mix`) et fondre le
 * tour parcouru (`spin`) en meme temps. A 0 la pose de l'etat commande seule ; a
 * 1 la tete est posee a gauche et suit le curseur.
 *
 * Rien ici ne compense l'expression affichee : c'est le moteur qui melange,
 * parce que lui seul connait la pose a l'instant t. Le faire ici obligerait a
 * lire le lacet d'ARRIVEE de l'expression pendant que le moteur, lui, morphe
 * encore — et les yeux sautaient a chaque changement d'humeur.
 */
export function lookTarget({ nx, ny, tour, pointer, lire, mirada = 0 }: Aim): Look {
  return {
    yaw: -TURN + nx * (lire ? YAW_LECTURE : YAW_MAX) + mirada,
    // tangage positif = regard vers le haut, alors que le y de l'ecran descend
    pitch: lire ? PITCH_LECTURE : PITCH - ny * PITCH_MAX,
    mix: tour,
    spin: SPIN * (1 - tour),
    // Sans pointeur la tete reste tournee vers le panneau, mais on lui rend sa
    // derive : sinon le bot fixe un point mort, et arriver au clavier ou au
    // tactile donnait un avatar completement immobile.
    wander: pointer ? 0 : 1
  }
}

/**
 * Amplitude d'un regard lance de lui-meme, en degres. CHOISIE, pas relevee :
 * assez large pour se lire comme un coup d'oeil, en dessous de la marge qui
 * garde les deux yeux devant le limbe quand le pointeur est deja au bord.
 */
export const MIRADA = 13

/** Duree d'un coup d'oeil : partir, tenir, revenir. Plus lent qu'un clignement. */
const MIRADA_DUR = 0.92

const MIRADA_RNG = createRng(0xc0de)
/**
 * Calendrier pre-tire, meme forme que les clignements : deterministe, sans
 * etat, et pas verrouille sur leur rythme.
 */
const MIRADAS: { t: number; cote: 1 | -1 }[] = (() => {
  const out: { t: number; cote: 1 | -1 }[] = []
  let t = 1.7
  let cote: 1 | -1 = 1
  while (t < 900) {
    out.push({ t, cote })
    cote = cote === 1 ? -1 : 1
    t += 2.6 + MIRADA_RNG() * 2.4
  }
  return out
})()

/**
 * Lacet d'un coup d'oeil au temps `t`, en degres. 0 presque tout le temps :
 * le bot regarde d'un cote, tient, et revient. Les cotes alternent.
 */
export function miradaYaw(t: number): number {
  for (let i = 0; i < MIRADAS.length; i++) {
    const g = MIRADAS[i]!
    if (t < g.t) break
    const k = (t - g.t) / MIRADA_DUR
    if (k < 0 || k > 1) continue
    let a: number
    if (k < 0.34) a = easings.easeOutCubic(k / 0.34)
    else if (k < 0.56) a = 1
    else a = 1 - easings.easeOutCubic((k - 0.56) / 0.44)
    return g.cote * MIRADA * a
  }
  return 0
}
