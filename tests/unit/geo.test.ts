import { expect, test } from 'vitest';
import { googleMapsUrl, wazeUrl } from '../../src/lib/geo';

test('liens d’itinéraire', () => {
  expect(googleMapsUrl(44.8378, -0.58)).toBe('https://www.google.com/maps/dir/?api=1&destination=44.8378%2C-0.58');
  expect(wazeUrl(44.8378, -0.58)).toBe('https://waze.com/ul?ll=44.8378%2C-0.58&navigate=yes');
});
