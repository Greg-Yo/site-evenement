import { describe, expect, test } from 'vitest';
import { abreviations, filtrer, idDepuisParam, lireFiltres, messageFlash, statistiques } from '../../src/lib/admin/reponses';
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
  test('abreviations : uniques, allongées si besoin', () => {
    const m = [{ id: 'a', titre: 'Accueil' }, { id: 'd', titre: 'Dîner' }, { id: 's', titre: 'Soirée' }, { id: 'b', titre: 'Brunch' }];
    expect(abreviations(m, 1)).toEqual({ a: 'A', d: 'D', s: 'S', b: 'B' });
    expect(abreviations(m, 3)).toEqual({ a: 'Acc', d: 'Dîn', s: 'Soi', b: 'Bru' });
    expect(abreviations([{ id: 'x', titre: 'Soirée' }, { id: 'y', titre: 'Soupe' }], 1)).toEqual({ x: 'Soi', y: 'Sou' });
    expect(abreviations([{ id: 'x', titre: 'Dîner' }, { id: 'y', titre: 'Dîner' }], 1)).toEqual({ x: 'Dîner 1', y: 'Dîner 2' });
  });
  test('idDepuisParam', () => {
    expect(idDepuisParam('12')).toBe(12);
    for (const v of [undefined, '', '0', '-3', '1.5', '12abc', '1e3']) expect(idDepuisParam(v)).toBeNull();
  });
  test('messageFlash', () => {
    expect(messageFlash('renvoye')).toEqual({ texte: 'E-mail renvoyé.', type: 'ok' });
    expect(messageFlash('introuvable')).toEqual({ texte: "Cette réponse n'existe plus.", type: 'erreur' });
    expect(messageFlash('<script>')).toBeNull();
    expect(messageFlash(null)).toBeNull();
  });
});
