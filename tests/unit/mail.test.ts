import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { creerApi, payloadBrevo, payloadResend } from '../../src/lib/mail/api';
import { creerOutbox } from '../../src/lib/mail/outbox';
import type { Message } from '../../src/lib/mail/types';

const msg: Message = {
  a: 'camille@exemple.fr', sujet: 'Ton invitation', html: '<p>Bonjour</p>', texte: 'Bonjour',
  piecesJointes: [{ nom: 'Invitation-Camille.pdf', contenu: new Uint8Array([37, 80, 68, 70]), type: 'application/pdf' }],
};
const de = { email: 'fete@exemple.fr', nom: 'Coco a 40 ans' };

describe('outbox', () => {
  test('écrit un dossier par e-mail avec méta, html, texte et pièces jointes', async () => {
    const dossier = mkdtempSync(join(tmpdir(), 'outbox-'));
    const ob = creerOutbox(dossier, () => new Date('2027-01-10T10:11:12.345Z'));
    await ob.envoyer(msg);
    await ob.envoyer({ ...msg, piecesJointes: [] });
    const dirs = readdirSync(dossier).sort();
    expect(dirs).toEqual(['20270110-101112-345-1', '20270110-101112-345-2']);
    const d = join(dossier, dirs[0]);
    expect(JSON.parse(readFileSync(join(d, 'meta.json'), 'utf8'))).toEqual({
      a: 'camille@exemple.fr', sujet: 'Ton invitation', date: '2027-01-10T10:11:12.345Z', piecesJointes: ['Invitation-Camille.pdf'],
    });
    expect(readFileSync(join(d, 'message.html'), 'utf8')).toBe('<p>Bonjour</p>');
    expect(readFileSync(join(d, 'message.txt'), 'utf8')).toBe('Bonjour');
    expect([...readFileSync(join(d, 'Invitation-Camille.pdf'))]).toEqual([37, 80, 68, 70]);
  });
});

describe('API', () => {
  test('payload Brevo', () => {
    expect(payloadBrevo(msg, de)).toEqual({
      sender: { name: 'Coco a 40 ans', email: 'fete@exemple.fr' }, to: [{ email: 'camille@exemple.fr' }],
      subject: 'Ton invitation', htmlContent: '<p>Bonjour</p>', textContent: 'Bonjour',
      attachment: [{ name: 'Invitation-Camille.pdf', content: 'JVBERg==' }],
    });
  });
  test('payload Resend', () => {
    expect(payloadResend(msg, de)).toEqual({
      from: 'Coco a 40 ans <fete@exemple.fr>', to: ['camille@exemple.fr'], subject: 'Ton invitation',
      html: '<p>Bonjour</p>', text: 'Bonjour', attachments: [{ filename: 'Invitation-Camille.pdf', content: 'JVBERg==' }],
    });
  });
  test('appelle le bon point d’accès avec la clé, et lève une erreur si la réponse n’est pas 2xx', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 201 }));
    await creerApi({ fournisseur: 'brevo', cle: 'k1', de, fetch: f }).envoyer(msg);
    expect(f).toHaveBeenCalledWith('https://api.brevo.com/v3/smtp/email', expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ 'api-key': 'k1', 'content-type': 'application/json' }),
    }));
    const g = vi.fn(async () => new Response('{}', { status: 200 }));
    await creerApi({ fournisseur: 'resend', cle: 'k2', de, fetch: g }).envoyer(msg);
    expect(g).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'Bearer k2' }),
    }));
    const h = vi.fn(async () => new Response('quota', { status: 429 }));
    await expect(creerApi({ fournisseur: 'brevo', cle: 'k', de, fetch: h }).envoyer(msg)).rejects.toThrow(/429/);
  });
});
