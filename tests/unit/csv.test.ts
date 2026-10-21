import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { celluleCsv, exporterCsv } from '../../src/lib/csv';
import { parseEvent } from '../../src/lib/event';
import { rep } from './fabriques';

const ev = parseEvent(readFileSync('evenement/evenement.yaml', 'utf8'), readdirSync('evenement/photos').map((f) => `photos/${f}`));

describe('celluleCsv', () => {
  test('guillemets, séparateur, retours à la ligne, formules', () => {
    expect(celluleCsv('Camille')).toBe('Camille');
    expect(celluleCsv('a;b')).toBe('"a;b"');
    expect(celluleCsv('dit "bonjour"')).toBe('"dit ""bonjour"""');
    expect(celluleCsv('ligne1\nligne2')).toBe('"ligne1\nligne2"');
    expect(celluleCsv('=SOMME(A1)')).toBe("'=SOMME(A1)");
    expect(celluleCsv('+33 6 12')).toBe("'+33 6 12");
    expect(celluleCsv('@cmd')).toBe("'@cmd");
    expect(celluleCsv('-1;2')).toBe(`"'-1;2"`);
  });
});

describe('exporterCsv', () => {
  test('BOM, en-tête, une ligne par réponse triée par nom, CRLF', () => {
    const csv = exporterCsv([
      rep({ nom: 'Thomas Durand', email: 't@x.fr', vient: true, accompagnants: ['Léo', 'Zoé'], moments: ['diner'], langue: 'en', telephone: null,
            message: 'Hâte !', creeLe: '2027-01-15T10:05:00.000Z' }),
      rep({ nom: 'Anne Roy', email: 'a@x.fr', vient: false, creeLe: '2027-01-14T08:00:00.000Z' }),
    ], ev);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const lignes = csv.slice(1).split('\r\n');
    expect(lignes[0]).toBe('Nom;E-mail;Téléphone;Langue;Présence;Personnes;Accompagnants;Accueil;Dîner;Soirée;Brunch;Message;Date');
    expect(lignes[1]).toBe('Anne Roy;a@x.fr;;fr;non;0;;non;non;non;non;;14/01/2027 10:00');
    expect(lignes[2]).toBe('Thomas Durand;t@x.fr;;en;oui;3;Léo, Zoé;non;oui;non;non;Hâte !;15/01/2027 12:05');
    expect(lignes[3]).toBe('');
  });
});
