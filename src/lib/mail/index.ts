import { creerApi } from './api';
import { creerOutbox } from './outbox';
import type { Expediteur } from './types';

export function getExpediteur(nomExpediteur: string): Expediteur {
  if ((process.env.MAIL_MODE || 'outbox') !== 'api') return creerOutbox(process.env.OUTBOX_DIR || '.data/outbox');
  const fournisseur = process.env.MAIL_PROVIDER === 'resend' ? 'resend' : 'brevo';
  const cle = process.env.MAIL_API_KEY;
  const email = process.env.MAIL_FROM;
  if (!cle || !email) throw new Error('MAIL_MODE=api exige MAIL_API_KEY et MAIL_FROM');
  return creerApi({ fournisseur, cle, de: { email, nom: nomExpediteur } });
}
