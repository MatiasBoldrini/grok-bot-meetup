import { describe, expect, it } from 'vitest'
import { EXPRESSIONS } from '@/bot/expressions'
import { COLORS, SHAPES } from '@/bot/skins'
import { STATES } from '@/bot/states'
import { formePlurielle, interpoler } from './format'
import { choisirLangue, LANGUES, tagDe } from './langues'
import en from './locales/en'
import es from './locales/es'

const DICTIONNAIRES = { en, es }

describe('choix de la langue au demarrage', () => {
  it('respecte le choix memorise, quelles que soient les preferences du navigateur', () => {
    expect(choisirLangue('en', ['es-AR', 'es'])).toBe('en')
    expect(choisirLangue('es', ['en-US'])).toBe('es')
  })

  it('ignore un choix memorise qui n est pas une langue connue', () => {
    expect(choisirLangue('de', ['en-GB'])).toBe('en')
    expect(choisirLangue('fr', ['es-AR'])).toBe('es')
    expect(choisirLangue('', ['en-GB'])).toBe('en')
    expect(choisirLangue('de', ['ja-JP'])).toBe('es')
  })

  it('suit l ordre des preferences du navigateur, pas leur simple presence', () => {
    expect(choisirLangue(null, ['es-AR', 'en-US'])).toBe('es')
    expect(choisirLangue(null, ['en-US', 'es-AR'])).toBe('en')
  })

  it('reduit une etiquette complete a sa langue', () => {
    expect(choisirLangue(null, ['es-419'])).toBe('es')
    expect(choisirLangue(null, ['en-GB-oxendict'])).toBe('en')
  })

  it('saute les langues qu on ne parle pas et les etiquettes invalides', () => {
    expect(choisirLangue(null, ['de-DE', 'ja', 'en'])).toBe('en')
    expect(choisirLangue(null, ['pas une etiquette', 'es'])).toBe('es')
  })

  it('retombe sur l espagnol quand rien ne correspond', () => {
    expect(choisirLangue(null, ['de-DE', 'ja-JP'])).toBe('es')
    expect(choisirLangue(null, [])).toBe('es')
    expect(choisirLangue(null, ['fr-FR'])).toBe('es')
  })
})

describe('completude des dictionnaires', () => {
  function feuilles(objet: object, prefixe = ''): Array<[string, string]> {
    return Object.entries(objet).flatMap(([cle, valeur]) =>
      typeof valeur === 'string'
        ? [[`${prefixe}${cle}`, valeur] as [string, string]]
        : feuilles(valeur as object, `${prefixe}${cle}.`)
    )
  }

  it('n a aucune valeur vide, dans aucune langue', () => {
    for (const [langue, dico] of Object.entries(DICTIONNAIRES)) {
      for (const [cle, valeur] of feuilles(dico)) {
        expect(valeur.trim(), `${langue}.${cle}`).not.toBe('')
      }
    }
  })

  it('traduit vraiment les libelles des catalogues, sans les recopier de l anglais', () => {
    for (const famille of ['states', 'shapes', 'colors', 'expressions'] as const) {
      for (const [cle, valeur] of feuilles(en[famille])) {
        expect(feuilles(es[famille]).find(([k]) => k === cle)![1], `es ${famille}.${cle}`).not.toBe(
          valeur
        )
      }
    }
  })

  it('traduit le chrome du mur', () => {
    expect(es.meetup.welcome).toBe('Bienvenido, {name}')
    expect(es.meetup.cityClaim).toBe('Meetup Mendoza')
    expect(en.meetup.city).toBe('Meetup {place}')
    expect(es.meetup.city).toBe('Meetup {place}')
    expect(es.meetup.claim).not.toBe(en.meetup.claim)
    expect(es.meetup.back).not.toBe(en.meetup.back)
    expect(es.meetup.started).toBe('Ya comenzamos')
    expect(es.meetup.soon).toBe('Comenzamos en breve')
    expect(es.meetup.start).not.toBe(en.meetup.start)
    expect(es.meetup.started).not.toBe(en.meetup.started)
    expect(es.meetup.soon).not.toBe(en.meetup.soon)
    expect(es.wall.edit).not.toBe(en.wall.edit)
    expect(es.wall.place).not.toBe(en.wall.place)
    expect(es.wall.morph).not.toBe(en.wall.morph)
    expect(es.wall.repo).not.toBe(en.wall.repo)
    expect(es.wall.claimUrl).not.toBe(en.wall.claimUrl)
    expect(es.wall.done).not.toBe(en.wall.done)
  })

  it('couvre les quatre catalogues du bot, entree par entree', () => {
    const cles = (famille: object) => feuilles(famille).map(([k]) => k)
    expect(cles(en.states).sort()).toEqual(STATES.map((s) => s.id).sort())
    expect(cles(en.shapes).sort()).toEqual(SHAPES.map((s) => s.id).sort())
    expect(cles(en.colors).sort()).toEqual(COLORS.map((c) => c.id).sort())
    expect(cles(en.expressions).sort()).toEqual(EXPRESSIONS.map((e) => e.id).sort())
  })
})

describe('substitution', () => {
  it('remplace toutes les occurrences d un parametre', () => {
    expect(interpoler('{a} et {a}', { a: 'x' })).toBe('x et x')
  })

  it('accepte les nombres et plusieurs parametres', () => {
    expect(interpoler('{etat}, {duree}', { etat: 'Repos', duree: 2 })).toBe('Repos, 2')
  })

  it('laisse visible un parametre sans valeur, plutot que de le vider', () => {
    expect(interpoler('Supprimer {name} ?', {})).toBe('Supprimer {name} ?')
  })
})

describe('pluriel', () => {
  it('range zero avec le pluriel en anglais et en espagnol', () => {
    const gabarit = 'un | varios'
    expect(formePlurielle(gabarit, 0, 'en')).toBe('varios')
    expect(formePlurielle(gabarit, 0, 'es')).toBe('varios')
  })

  it('distingue un de dos en las dos lenguas', () => {
    const gabarit = 'un | varios'
    for (const tag of ['en', 'es']) {
      expect(formePlurielle(gabarit, 1, tag)).toBe('un')
      expect(formePlurielle(gabarit, 2, tag)).toBe('varios')
    }
  })

  it('donne a l anglais et a l espagnol deux formes', () => {
    expect(en.dialog.removeDetail.split(' | ')).toHaveLength(2)
    expect(es.dialog.removeDetail.split(' | ')).toHaveLength(2)
  })
})

describe('catalogue des langues', () => {
  it('propose anglais et espagnol, avec un drapeau et un endonyme', () => {
    expect(LANGUES.map((l) => l.id)).toEqual(['en', 'es'])
    for (const l of LANGUES) {
      expect(l.emoji.length, l.id).toBeGreaterThan(0)
      expect(l.nom.trim(), l.id).not.toBe('')
    }
  })

  it('donne une etiquette BCP 47 que `Intl` sait lire', () => {
    for (const l of LANGUES) {
      const tag = tagDe(l.id)
      expect(new Intl.Locale(tag).language, l.id).toBe(l.id)
      expect(new Intl.NumberFormat(tag).format(2.4), l.id).toMatch(/2[.,]4/)
    }
  })
})
