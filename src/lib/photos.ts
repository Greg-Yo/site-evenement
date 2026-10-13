import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>(
  '/evenement/photos/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}',
  { eager: true },
);

export const photoKeys: string[] = Object.keys(files).map((k) => k.replace('/evenement/', ''));

export function photo(path: string): ImageMetadata {
  const key = Object.keys(files).find((k) => k.toLowerCase() === `/evenement/${path}`.toLowerCase());
  if (!key) throw new Error(`Photo introuvable : evenement/${path}`);
  return files[key].default;
}
