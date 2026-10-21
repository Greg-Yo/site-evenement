import { describe, expect, test } from 'vitest';
import { filtrer, lireFiltres, statistiques } from '../../src/lib/admin/reponses';
import { rep } from './fabriques';

const liste = [
  rep({ nom: 'Émilie Durand', email: 'emilie@x.fr', vient: true, accompagnants: ['Léo'], moments: ['accueil', 'diner'] }),
  rep({ nom: 'Paul Leroy', email: 'paul@x.fr', vient: false }),
  rep({ nom: 'Thomas', email: 'thomas@x.fr', vient: true, moments: ['diner'] }),
];

describe('admin : réponses', () => {
  test('statistiques', () => {
    expect(statistiques(liste, ['accueil', 'diner', 'soiree'])).toEqual({
      reponses: 3, foyers: 2, personnes: 3, refus: 1, parMoment: { accueil: 2, diner: 3, soiree: 0 },
    });
  });
  test('lireFiltres : valeurs inconnues remplacées par défaut', () => {
    expect(lireFiltres(new URLSearchParams('q=%20Emi%20&presence=peut-etre&moment=piscine'), ['diner']))
      .toEqual({ q: 'Emi', presence: 'tous', moment: '' });
    expect(lireFiltres(new URLSearchParams('presence=non&moment=diner'), ['diner'])).toEqual({ q: '', presence: 'non', moment: 'diner' });
  });
  test('filtrer : recherche sans casse ni accents, présence, moment', () => {
    expect(filtrer(liste, { q: 'EMILIE', presence: 'tous', moment: '' }).map((r) => r.nom)).toEqual(['Émilie Durand']);
    expect(filtrer(liste, { q: 'paul@', presence: 'tous', moment: '' })).toHaveLength(1);
    expect(filtrer(liste, { q: '', presence: 'non', moment: '' }).map((r) => r.nom)).toEqual(['Paul Leroy']);
    expect(filtrer(liste, { q: '', presence: 'tous', moment: 'accueil' }).map((r) => r.nom)).toEqual(['Émilie Durand']);
  });
});
