import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { Reponse } from '../../src/lib/db';
import { parseEvent } from '../../src/lib/event';
import { echapper, emailConfirmation, emailLienModification, emailRegrets } from '../../src/lib/mail/templates';

const ev = parseEvent(readFileSync('evenement/evenement.yaml', 'utf8'), readdirSync('evenement/photos').map((f) => `photos/${f}`));
const r: Reponse = {
  id: 1, jeton: 'JETON', langue: 'fr', vient: true, nom: 'Camille <script>alert(1)</script>', email: 'camille@exemple.fr',
  telephone: null, accompagnants: ['Léo & Co'], moments: ['accueil', 'soiree'], message: null,
  messageMasque: false, emailEnvoye: false, creeLe: '', modifieLe: '',
};
const liens = { programme: 'https://site.fr/fr/programme', modifier: 'https://site.fr/fr/rsvp/modifier?jeton=JETON' };

test('echapper', () => expect(echapper(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;'));

describe('confirmation', () => {
  const m = emailConfirmation(ev, r, liens);
  test('objet issu du YAML dans la langue de l’invité', () => expect(m.sujet).toBe('🎉 Ton invitation pour les 40 ans de Coco'));
  test('récapitulatif : personnes, moments choisis avec lieu, date, liens', () => {
    expect(m.html).toContain('Camille &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('Léo &amp; Co');
    expect(m.html).toContain('16 h · Accueil');
    expect(m.html).toContain('22 h · Soirée');
    expect(m.html).toContain('La Guinguette');
    expect(m.html).not.toContain('19 h · Dîner');
    expect(m.html).toContain('lundi 14 juin 2027');
    expect(m.html).toContain(liens.programme);
    expect(m.html).toContain(liens.modifier);
    expect(m.texte).toContain('2 personnes');
    expect(m.texte).toContain(liens.modifier);
  });
  test('en-tête HTML : charset et langue', () => {
    expect(m.html).toContain('<meta charset="utf-8">');
    expect(m.html).toContain('lang="fr"');
    expect(emailConfirmation(ev, { ...r, langue: 'en' }, liens).html).toContain('lang="en"');
  });
  test('version anglaise', () => {
    const en = emailConfirmation(ev, { ...r, langue: 'en' }, liens);
    expect(en.sujet).toBe("🎉 Your invitation to Coco's 40th");
    expect(en.html).toContain('4 pm · Welcome');
    expect(en.texte).toContain('2 people');
  });
});

test('regrets : pas de moments, lien de modification', () => {
  const m = emailRegrets(ev, { ...r, vient: false, moments: [], accompagnants: [] }, liens);
  expect(m.html).not.toContain('Accueil');
  expect(m.html).toContain(liens.modifier);
  expect(m.sujet).toContain('Coco a 40 ans');
});

test('lien de modification', () => {
  const m = emailLienModification(ev, r, liens);
  expect(m.html).toContain(liens.modifier);
  expect(m.texte).toContain(liens.modifier);
});
