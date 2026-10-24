import { creerApi } from './api';
import { creerOutbox } from './outbox';
import type { Expediteur } from './types';

type Env = Record<string, string | undefined>;

/** Décrit l'erreur de configuration des e-mails, ou null si tout est en ordre. */
export function problemeConfigMail(env: Env = process.env): string | null {
  const api = env.MAIL_MODE === 'api';
  if (env.VERCEL && !api) return 'En ligne, MAIL_MODE doit valoir « api » : sinon les e-mails ne partent pas.';
  if (!api) return null;
  if (!env.MAIL_API_KEY || !env.MAIL_FROM) return 'MAIL_MODE=api exige MAIL_API_KEY et MAIL_FROM.';
  const fournisseur = env.MAIL_PROVIDER || 'brevo';
  if (fournisseur !== 'brevo' && fournisseur !== 'resend') return 'MAIL_PROVIDER doit valoir « brevo » ou « resend ».';
  return null;
}

/** Vrai quand les e-mails sont écrits dans la boîte d'envoi locale au lieu d'être envoyés. */
export function outboxActive(env: Env = process.env): boolean {
  return (env.MAIL_MODE || 'outbox') !== 'api' && !env.VERCEL;
}

export function getExpediteur(nomExpediteur: string, env: Env = process.env): Expediteur {
  const probleme = problemeConfigMail(env);
  if (probleme) throw new Error(probleme);
  if (outboxActive(env)) return creerOutbox(env.OUTBOX_DIR || '.data/outbox');
  return creerApi({
    fournisseur: env.MAIL_PROVIDER === 'resend' ? 'resend' : 'brevo',
    cle: env.MAIL_API_KEY!, de: { email: env.MAIL_FROM!, nom: nomExpediteur },
  });
}
