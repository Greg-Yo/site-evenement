import { readFileSync, readdirSync } from 'node:fs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { openDb, type Db } from '../../src/lib/db';
import { parseEvent } from '../../src/lib/event';
import type { Expediteur, Message } from '../../src/lib/mail/types';
import { CHAMPS_VIDES, type ChampsRsvp } from '../../src/lib/rsvp';
import { limiteDepuisEnv, modifier, nomFichierInvitation, soumettre, type Deps } from '../../src/lib/rsvp-service';

const ev = parseEvent(readFileSync('evenement/evenement.yaml', 'utf8'), readdirSync('evenement/photos').map((f) => `photos/${f}`));
const champs: ChampsRsvp = { ...CHAMPS_VIDES, vient: true, nom: 'Camille Martin', email: 'camille@exemple.fr', moments: ['diner'], message: 'Bravo' };
const AVANT = new Date('2027-01-10T10:00:00Z');
const APRES = new Date('2027-05-02T10:00:00Z');

let db: Db;
let envoyes: Message[];
let deps: Deps;
beforeEach(async () => {
  db = await openDb(':memory:');
  envoyes = [];
  const expediteur: Expediteur = { envoyer: async (m) => { envoyes.push(m); } };
  deps = { db, expediteur, ev, maintenant: () => AVANT, urlBase: 'https://site.fr', invitationPdf: async () => new Uint8Array([37, 80, 68, 70]), limite: 5 };
});

describe('soumettre', () => {
  test('vient : enregistre, envoie confirmation + PDF, marque l’e-mail envoyé', async () => {
    const r = await soumettre(champs, 'fr', '1.1.1.1', deps);
    expect(r.type).toBe('ok');
    if (r.type !== 'ok') return;
    expect(r.emailEnvoye).toBe(true);
    expect(envoyes).toHaveLength(1);
    expect(envoyes[0].a).toBe('camille@exemple.fr');
    expect(envoyes[0].piecesJointes).toEqual([{ nom: 'Invitation-Camille-Martin.pdf', contenu: new Uint8Array([37, 80, 68, 70]), type: 'application/pdf' }]);
    expect(envoyes[0].html).toContain(`https://site.fr/fr/rsvp/modifier?jeton=${r.reponse.jeton}`);
    expect((await db.parEmail('camille@exemple.fr'))?.emailEnvoye).toBe(true);
  });

  test('ne vient pas : e-mail de regrets sans PDF', async () => {
    await soumettre({ ...champs, vient: false, moments: [] }, 'fr', '1.1.1.1', deps);
    expect(envoyes[0].piecesJointes ?? []).toEqual([]);
  });

  test('doublon (casse et espaces différents) : rien n’est modifié, le lien est renvoyé', async () => {
    await soumettre(champs, 'fr', '1.1.1.1', deps);
    const r = await soumettre({ ...champs, email: '  Camille@Exemple.FR ', nom: 'Autre Nom', vient: false, moments: [] }, 'fr', '1.1.1.1', deps);
    expect(r).toEqual({ type: 'doublon', lienEnvoye: true });
    expect((await db.parEmail('CAMILLE@EXEMPLE.FR'))?.nom).toBe('Camille Martin');
    expect(envoyes).toHaveLength(2);
    expect(envoyes[1].sujet).toContain('modifier');
  });

  test('deux doublons en moins de 10 minutes : un seul e-mail de lien', async () => {
    await soumettre(champs, 'fr', '1.1.1.1', deps);
    const a = await soumettre(champs, 'fr', '1.1.1.1', deps);
    const b = await soumettre(champs, 'fr', '1.1.1.1', deps);
    expect(a).toEqual({ type: 'doublon', lienEnvoye: true });
    expect(b).toEqual({ type: 'doublon', lienEnvoye: false });
    expect(envoyes).toHaveLength(2);
  });

  test('échec d’envoi du lien : lienEnvoye est false', async () => {
    await soumettre(champs, 'fr', '1.1.1.1', deps);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const cassee: Deps = { ...deps, expediteur: { envoyer: async () => { throw new Error('panne'); } } };
    expect(await soumettre(champs, 'fr', '1.1.1.1', cassee)).toEqual({ type: 'doublon', lienEnvoye: false });
    vi.restoreAllMocks();
  });

  test('après la date limite : fermé, rien d’enregistré', async () => {
    expect(await soumettre(champs, 'fr', '1.1.1.1', { ...deps, maintenant: () => APRES })).toEqual({ type: 'ferme' });
    expect(await db.parEmail('camille@exemple.fr')).toBeNull();
  });

  test('champ piège rempli : ignoré en silence', async () => {
    expect(await soumettre({ ...champs, piege: 'http://spam' }, 'fr', '1.1.1.1', deps)).toEqual({ type: 'ignore' });
    expect(envoyes).toHaveLength(0);
  });

  test('invalide : erreurs, rien d’enregistré', async () => {
    const r = await soumettre({ ...champs, email: 'x' }, 'fr', '1.1.1.1', deps);
    expect(r).toEqual({ type: 'invalide', erreurs: { email: 'rsvp.err.email' } });
  });

  test('limite par IP', async () => {
    for (let i = 0; i < 5; i++) await soumettre({ ...champs, email: `p${i}@exemple.fr` }, 'fr', '9.9.9.9', deps);
    expect(await soumettre({ ...champs, email: 'p6@exemple.fr' }, 'fr', '9.9.9.9', deps)).toEqual({ type: 'limite' });
  });

  test('échec d’envoi : réponse enregistrée, emailEnvoye = false', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await soumettre(champs, 'fr', '1.1.1.1', { ...deps, expediteur: { envoyer: async () => { throw new Error('panne'); } } });
    expect(r).toMatchObject({ type: 'ok', emailEnvoye: false });
    expect((await db.parEmail('camille@exemple.fr'))?.emailEnvoye).toBe(false);
    err.mockRestore();
  });
});

describe('modifier', () => {
  test('met à jour et renvoie une confirmation ; l’e-mail ne change pas', async () => {
    const r = await soumettre(champs, 'fr', '1.1.1.1', deps);
    if (r.type !== 'ok') throw new Error();
    const m = await modifier(r.reponse.jeton, { ...champs, email: 'pirate@exemple.fr', accompagnants: ['Léo'] }, 'fr', deps);
    expect(m).toMatchObject({ type: 'ok', reponse: { email: 'camille@exemple.fr', accompagnants: ['Léo'] } });
    expect(envoyes).toHaveLength(2);
  });
  test('jeton inconnu', async () => {
    expect(await modifier('inconnu', champs, 'fr', deps)).toEqual({ type: 'introuvable' });
  });
  test('après la date limite : fermé', async () => {
    const r = await soumettre(champs, 'fr', '1.1.1.1', deps);
    if (r.type !== 'ok') throw new Error();
    expect(await modifier(r.reponse.jeton, champs, 'fr', { ...deps, maintenant: () => APRES })).toEqual({ type: 'ferme' });
  });
});

test('nomFichierInvitation', () => {
  expect(nomFichierInvitation('Camille Martin')).toBe('Invitation-Camille-Martin.pdf');
  expect(nomFichierInvitation('Zoë / <Léa>')).toBe('Invitation-Zoe-Lea.pdf');
});

describe('limiteDepuisEnv', () => {
  test.each([[undefined, 5], ['10', 10], ['cinq', 5], ['0', 5], ['-3', 5], ['2.5', 5]])('%s -> %s', (v, attendu) => {
    expect(limiteDepuisEnv(v)).toBe(attendu);
  });
});
