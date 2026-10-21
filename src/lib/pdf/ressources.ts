import sharp from 'sharp';
import caveat from '../../assets/fonts/Caveat-Bold.ttf?inline';
import nunito from '../../assets/fonts/Nunito-Regular.ttf?inline';
import nunitoGras from '../../assets/fonts/Nunito-ExtraBold.ttf?inline';
import type { Polices } from './invitation';

const decoder = (dataUrl: string) => new Uint8Array(Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));

export function polices(): Polices {
  return { titre: decoder(caveat), texte: decoder(nunito), texteGras: decoder(nunitoGras) };
}

const photos = import.meta.glob<string>('/evenement/photos/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', { query: '?inline', import: 'default' });

/** Photo de l'événement, réduite à 1 200 px de large et convertie en JPEG (seul format accepté avec le PNG par pdf-lib). */
export async function photoJpeg(chemin: string): Promise<Uint8Array | null> {
  const cle = Object.keys(photos).find((k) => k.toLowerCase() === `/evenement/${chemin}`.toLowerCase());
  if (!cle) return null;
  const brut = decoder(await photos[cle]());
  return new Uint8Array(await sharp(brut).rotate().resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer());
}
