import { describe, expect, test } from 'vitest';
import { CHAMPS_VIDES, lireFormulaire, nombrePersonnes, rsvpOuvert, valider, type ChampsRsvp } from '../../src/lib/rsvp';

const IDS = ['accueil', 'diner', 'soiree', 'brunch'];
const ok: ChampsRsvp = { ...CHAMPS_VIDES, vient: true, nom: 'Camille Martin', email: 'camille@exemple.fr', moments: ['diner'] };

describe('lireFormulaire', () => {
  test('lit, nettoie et ignore les accompagnants vides', () => {
    const fd = new FormData();
    fd.set('vient', 'oui'); fd.set('nom', '  Camille Martin '); fd.set('email', '  Camille@Exemple.FR ');
    fd.append('accompagnant', 'Léo'); fd.append('accompagnant', '  '); fd.append('accompagnant', '');
    fd.append('moment', 'diner'); fd.append('moment', 'soiree'); fd.set('message', '  Bravo ');
    expect(lireFormulaire(fd)).toEqual({
      vient: true, nom: 'Camille Martin', email: 'camille@exemple.fr', telephone: '',
      accompagnants: ['Léo'], moments: ['diner', 'soiree'], message: 'Bravo', piege: '',
    });
  });
  test('présence absente → null ; champ piège lu', () => {
    const fd = new FormData(); fd.set('ne_pas_remplir', 'http://spam');
    expect(lireFormulaire(fd)).toMatchObject({ vient: null, piege: 'http://spam' });
  });
});

describe('valider', () => {
  test('cas valide → données prêtes à enregistrer', () => {
    expect(valider({ ...ok, telephone: '06 12', message: 'Super' }, IDS, 'fr')).toEqual({
      ok: true,
      data: { langue: 'fr', vient: true, nom: 'Camille Martin', email: 'camille@exemple.fr', telephone: '06 12', accompagnants: [], moments: ['diner'], message: 'Super' },
    });
  });
  test('ne vient pas : accompagnants et moments vidés, téléphone et message vides → null', () => {
    const r = valider({ ...ok, vient: false, accompagnants: ['Léo'], moments: [] }, IDS, 'en');
    expect(r).toEqual({ ok: true, data: expect.objectContaining({ vient: false, accompagnants: [], moments: [], telephone: null, message: null, langue: 'en' }) });
  });
  test('erreurs par champ', () => {
    const r = valider({
      ...ok, vient: true, nom: 'C', email: 'pas-un-email', telephone: '1'.repeat(31),
      accompagnants: Array(11).fill('x'), moments: [], message: 'm'.repeat(1001),
    }, IDS, 'fr');
    expect(r).toEqual({ ok: false, erreurs: {
      nom: 'rsvp.err.nom', email: 'rsvp.err.email', telephone: 'rsvp.err.telephone',
      accompagnants: 'rsvp.err.accompagnants', moments: 'rsvp.err.moments', message: 'rsvp.err.message',
    } });
  });
  test('présence manquante, moment inconnu, accompagnant trop long', () => {
    expect(valider({ ...ok, vient: null }, IDS, 'fr')).toEqual({ ok: false, erreurs: { vient: 'rsvp.err.vient' } });
    expect(valider({ ...ok, moments: ['piscine'] }, IDS, 'fr')).toEqual({ ok: false, erreurs: { moments: 'rsvp.err.moments' } });
    expect(valider({ ...ok, accompagnants: ['x'.repeat(101)] }, IDS, 'fr')).toEqual({ ok: false, erreurs: { accompagnants: 'rsvp.err.accompagnants' } });
  });
  test('e-mail de plus de 254 caractères refusé', () => {
    expect(valider({ ...ok, email: 'a'.repeat(250) + '@x.fr' }, IDS, 'fr')).toEqual({ ok: false, erreurs: { email: 'rsvp.err.email' } });
  });
});

describe('rsvpOuvert (fuseau de l’événement)', () => {
  const ev = { date_debut: '2027-06-14T16:00:00+02:00', date_limite_rsvp: '2027-05-01', lieu_court: { fr: 'x' } };
  test('ouvert jusqu’à 23:59 heure locale du jour limite', () => {
    expect(rsvpOuvert(ev, new Date('2027-05-01T21:59:00Z'))).toBe(true);  // 23:59 à Paris
    expect(rsvpOuvert(ev, new Date('2027-05-01T22:00:00Z'))).toBe(false); // 00:00 le 2 mai à Paris
  });
});

test('nombrePersonnes', () => {
  expect(nombrePersonnes({ vient: true, accompagnants: ['a', 'b'] })).toBe(3);
  expect(nombrePersonnes({ vient: false, accompagnants: ['a'] })).toBe(0);
});
