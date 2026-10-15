import { t, type EventConfig, type Lang } from './event';
import { formatHeure } from './i18n';

export function momentLabel(m: EventConfig['moments'][number], lang: Lang): string {
  const jour = t(m.jour, lang);
  return `${jour ? jour + ' ' : ''}${formatHeure(m.heure, lang)} · ${t(m.titre, lang)}`;
}
