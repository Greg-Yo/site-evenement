import type { Reponse } from '../db';
import { findLieu, t, type EventConfig, type Lang } from '../event';
import { formatDate } from '../i18n';
import { momentLabel } from '../moments';
import { couleursTheme } from '../theme';

export type Liens = { programme: string; modifier: string };
type Contenu = { sujet: string; html: string; texte: string };

export function echapper(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const TXT = {
  fr: {
    confirme: "C'est confirmé !", bonjour: (n: string) => `À très vite, ${n} !`,
    merci: 'Merci pour ta réponse ! Voici ton invitation personnelle en pièce jointe.',
    personnes: (n: number) => (n > 1 ? `${n} personnes` : '1 personne'),
    programme: 'Voir le programme et la carte', modifier: 'Modifier ma réponse',
    regretsTitre: 'Dommage !', regrets: "Merci de nous avoir prévenus. Si tes plans changent, tu peux modifier ta réponse à tout moment.",
    sujetRegrets: (s: string) => `${s} : réponse bien reçue`,
    lienTitre: 'Ton lien de modification',
    lien: 'Tu as déjà répondu avec cette adresse. Pour changer ta réponse, utilise ce lien :',
    sujetLien: (s: string) => `${s} : modifier ta réponse`,
  },
  en: {
    confirme: "It's confirmed!", bonjour: (n: string) => `See you soon, ${n}!`,
    merci: 'Thanks for your reply! Your personal invitation is attached.',
    personnes: (n: number) => (n > 1 ? `${n} people` : '1 person'),
    programme: 'See the schedule and map', modifier: 'Change my reply',
    regretsTitre: 'What a shame!', regrets: 'Thanks for letting us know. If your plans change, you can update your reply at any time.',
    sujetRegrets: (s: string) => `${s}: reply received`,
    lienTitre: 'Your edit link',
    lien: 'You have already replied with this address. To change your reply, use this link:',
    sujetLien: (s: string) => `${s}: change your reply`,
  },
} satisfies Record<Lang, unknown>;

// Fond foncé dérivé : le texte blanc des boutons et du bandeau doit atteindre 4,5:1 (le #ec5e27 n'atteint que 3,3:1).
function couleurs(ev: EventConfig) {
  const c = couleursTheme(ev.theme);
  return { principale: c.principaleFonce, fond: c.fond, texte: c.texte };
}

function bouton(href: string, libelle: string, c: ReturnType<typeof couleurs>, plein: boolean): string {
  const style = plein
    ? `background:${c.principale};color:#ffffff;`
    : `background:#ffffff;color:${c.texte};border:2px solid ${c.texte};`;
  return `<a href="${echapper(href)}" style="${style}display:inline-block;padding:12px 18px;border-radius:10px;font-weight:bold;text-decoration:none;margin:4px 6px 4px 0">${echapper(libelle)}</a>`;
}

function gabarit(ev: EventConfig, lang: Lang, titre: string, corps: string): string {
  const c = couleurs(ev);
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${echapper(t(ev.site.titre, lang))}</title></head><body style="margin:0;background:#f4efe8;font-family:Arial,Helvetica,sans-serif;color:${c.texte}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe8;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:${c.fond};border-radius:16px;overflow:hidden">
<tr><td style="background:${c.principale};color:#ffffff;text-align:center;padding:24px 16px">
<div style="font-size:14px;font-weight:bold">${echapper(t(ev.site.titre, lang))}</div>
<div style="font-size:30px;font-weight:bold;margin-top:6px">${titre}</div></td></tr>
<tr><td style="padding:24px 28px;font-size:16px;line-height:1.6">${corps}</td></tr>
</table></td></tr></table></body></html>`;
}

function personnes(r: Reponse): string[] {
  return [r.nom, ...r.accompagnants];
}

function lignesMoments(ev: EventConfig, r: Reponse): { label: string; lieu: string }[] {
  return ev.moments.filter((m) => r.moments.includes(m.id)).map((m) => {
    const l = findLieu(ev, m.lieu);
    return { label: momentLabel(m, r.langue), lieu: `${l.nom}, ${l.adresse}` };
  });
}

export function emailConfirmation(ev: EventConfig, r: Reponse, liens: Liens): Contenu {
  const T = TXT[r.langue];
  const c = couleurs(ev);
  const prenom = r.nom.split(' ')[0];
  const date = formatDate(ev.evenement.date_debut, r.langue);
  const moments = lignesMoments(ev, r);
  const corps = `<p style="margin:0 0 12px">${echapper(T.merci)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px"><tr><td style="padding:14px 18px;font-size:15px">
<b>${echapper(date)}</b><br>${echapper(T.personnes(personnes(r).length))} : ${personnes(r).map(echapper).join(', ')}<br>
${moments.map((m) => `<b>${echapper(m.label)}</b> : ${echapper(m.lieu)}`).join('<br>')}
</td></tr></table>
<p style="margin:18px 0 0">${bouton(liens.programme, T.programme, c, true)}${bouton(liens.modifier, T.modifier, c, false)}</p>`;
  const texte = [
    T.bonjour(prenom), '', T.merci, '', date, `${T.personnes(personnes(r).length)} : ${personnes(r).join(', ')}`,
    ...moments.map((m) => `- ${m.label} : ${m.lieu}`), '', `${T.programme} : ${liens.programme}`, `${T.modifier} : ${liens.modifier}`,
  ].join('\n');
  return { sujet: t(ev.email.objet, r.langue), html: gabarit(ev, r.langue, echapper(T.bonjour(prenom)), corps), texte };
}

export function emailRegrets(ev: EventConfig, r: Reponse, liens: Liens): Contenu {
  const T = TXT[r.langue];
  const c = couleurs(ev);
  const corps = `<p style="margin:0 0 12px">${echapper(T.regrets)}</p><p style="margin:18px 0 0">${bouton(liens.modifier, T.modifier, c, true)}</p>`;
  return {
    sujet: T.sujetRegrets(t(ev.site.titre, r.langue)),
    html: gabarit(ev, r.langue, echapper(T.regretsTitre), corps),
    texte: [T.regretsTitre, '', T.regrets, '', `${T.modifier} : ${liens.modifier}`].join('\n'),
  };
}

export function emailLienModification(ev: EventConfig, r: Reponse, liens: Liens): Contenu {
  const T = TXT[r.langue];
  const c = couleurs(ev);
  const corps = `<p style="margin:0 0 12px">${echapper(T.lien)}</p><p style="margin:18px 0 0">${bouton(liens.modifier, T.modifier, c, true)}</p>`;
  return {
    sujet: T.sujetLien(t(ev.site.titre, r.langue)),
    html: gabarit(ev, r.langue, echapper(T.lienTitre), corps),
    texte: [T.lienTitre, '', T.lien, liens.modifier].join('\n'),
  };
}
