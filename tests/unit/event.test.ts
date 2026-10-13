import { describe, expect, test } from 'vitest';
import { parseEvent, t, EventConfigError } from '../../src/lib/event';

const PHOTOS = ['photos/hero.jpg', 'photos/a.jpg'];
const base = `
site:
  titre: { fr: "Coco a 40 ans", en: "Coco turns 40" }
  url_publique: "https://exemple.fr"
  contact: { nom: "Julie", email: "julie@exemple.fr" }
evenement:
  date_debut: "2027-06-14T16:00:00+02:00"
  date_limite_rsvp: "2027-05-01"
  lieu_court: "Bordeaux"
accueil:
  accroche: { fr: "On fait la fête !" }
  photo_principale: photos/hero.jpg
histoire:
  intro: "Il était une fois"
lieux:
  - { id: domaine, nom: "Domaine", adresse: "12 allée", lat: 44.83, lng: -0.58 }
moments:
  - { id: diner, heure: "19:00", titre: { fr: "Dîner", en: "Dinner" }, lieu: domaine }
rsvp:
  titre: { fr: "Tu viens ?", en: "Are you coming?" }
  message_merci: "Merci !"
email:
  expediteur_nom: "Coco"
  objet: "Ton invitation"
`;

function problemsOf(yaml: string, photos = PHOTOS): string[] {
  try { parseEvent(yaml, photos); return []; }
  catch (e) { if (e instanceof EventConfigError) return e.problems; throw e; }
}

describe('parseEvent', () => {
  test('accepte une configuration minimale et normalise les textes', () => {
    const ev = parseEvent(base, PHOTOS);
    expect(ev.evenement.lieu_court).toEqual({ fr: 'Bordeaux' });
    expect(ev.galerie).toEqual([]);
    expect(ev.infos.hebergements).toEqual([]);
    expect(ev.infos.faq).toEqual([]);
    expect(ev.histoire.chapitres).toEqual([]);
  });

  test('galerie et chapitres absents donnent des listes vides', () => {
    const ev = parseEvent(base, PHOTOS);
    expect(ev.galerie).toHaveLength(0);
    expect(ev.histoire.chapitres).toHaveLength(0);
  });

  test('signale un lieu de moment inconnu avec son chemin', () => {
    const p = problemsOf(base.replace('lieu: domaine }', 'lieu: salle }'));
    expect(p).toContain('moments[0].lieu : le lieu « salle » n’existe pas dans « lieux »');
  });

  test('signale une photo absente du dossier', () => {
    const p = problemsOf(base.replace('photos/hero.jpg', 'photos/absente.jpg'));
    expect(p).toContain('accueil.photo_principale : fichier introuvable evenement/photos/absente.jpg');
  });

  test('signale un identifiant de moment en double', () => {
    const yaml = base.replace(
      'moments:\n',
      'moments:\n  - { id: diner, heure: "20:00", titre: "Bis", lieu: domaine }\n',
    );
    expect(problemsOf(yaml)).toContain('moments[1].id : identifiant « diner » utilisé plusieurs fois');
  });

  test('refuse une date limite postérieure à l’événement', () => {
    const p = problemsOf(base.replace('2027-05-01', '2027-07-01'));
    expect(p).toContain('evenement.date_limite_rsvp : doit précéder evenement.date_debut');
  });

  test('signale un champ obligatoire manquant', () => {
    const p = problemsOf(base.replace(/rsvp:\n(.*\n){2}/, ''));
    expect(p.some((x) => x.startsWith('rsvp :'))).toBe(true);
  });

  test('accepte une date limite la veille d’un début juste après minuit', () => {
    const yaml = base
      .replace('2027-06-14T16:00:00+02:00', '2027-06-14T00:30:00+02:00')
      .replace('2027-05-01', '2027-06-13');
    expect(() => parseEvent(yaml, PHOTOS)).not.toThrow();
  });

  test('refuse une date limite le jour même', () => {
    const p = problemsOf(base.replace('2027-05-01', '2027-06-14'));
    expect(p).toContain('evenement.date_limite_rsvp : doit précéder evenement.date_debut');
  });

  test('signale un identifiant de lieu en double', () => {
    const yaml = base.replace(
      'lieux:\n',
      'lieux:\n  - { id: domaine, nom: "Autre", adresse: "1 rue", lat: 44.0, lng: -0.5 }\n',
    );
    expect(problemsOf(yaml)).toContain('lieux[1].id : identifiant « domaine » utilisé plusieurs fois');
  });

  test('signale un YAML mal formé', () => {
    expect(problemsOf('site: [')[0]).toMatch(/^YAML invalide/);
  });

  test('infos absentes : listes vides et rubriques indéfinies', () => {
    const ev = parseEvent(base, PHOTOS);
    expect(ev.infos).toEqual({ hebergements: [], faq: [] });
  });

  test('infos partielles : seule la tenue', () => {
    const ev = parseEvent(base + '\ninfos:\n  tenue: { texte: "Chic" }\n', PHOTOS);
    expect(ev.infos.tenue).toEqual({ texte: { fr: 'Chic' }, couleurs: [] });
    expect(ev.infos.cadeaux).toBeUndefined();
  });
});

describe('t', () => {
  test('retourne la langue demandée', () => {
    expect(t({ fr: 'Dîner', en: 'Dinner' }, 'en')).toBe('Dinner');
  });
  test('retombe sur le français si la traduction manque ou est vide', () => {
    expect(t({ fr: 'Dîner' }, 'en')).toBe('Dîner');
    expect(t({ fr: 'Dîner', en: '' }, 'en')).toBe('Dîner');
  });
  test('retourne une chaîne vide pour un texte absent', () => {
    expect(t(undefined, 'fr')).toBe('');
  });
});
