import { PDFDocument } from 'pdf-lib';
import { expect, test } from 'vitest';
import { photoJpeg, polices } from '../../src/lib/pdf/ressources';

test('polices : trois TTF valides', () => {
  const p = polices();
  for (const f of [p.titre, p.texte, p.texteGras]) expect([...f.slice(0, 4)]).toEqual([0, 1, 0, 0]);
});

test('photoJpeg : JPEG de 1 200 px au plus, intégrable par pdf-lib ; null si absente', async () => {
  const jpg = await photoJpeg('photos/hero.jpg');
  expect(jpg).not.toBeNull();
  expect([...jpg!.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  const doc = await PDFDocument.create();
  expect((await doc.embedJpg(jpg!)).width).toBeLessThanOrEqual(1200);
  expect(await photoJpeg('photos/absente.jpg')).toBeNull();
});

test('photoJpeg est mise en cache', async () => {
  const a = await photoJpeg('photos/hero.jpg');
  expect(await photoJpeg('photos/hero.jpg')).toBe(a);
});
