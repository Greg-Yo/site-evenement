import type { Expediteur, Message } from './types';

type De = { email: string; nom: string };
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');

export function payloadBrevo(m: Message, de: De) {
  return {
    sender: { name: de.nom, email: de.email }, to: [{ email: m.a }], subject: m.sujet,
    htmlContent: m.html, textContent: m.texte,
    ...(m.piecesJointes?.length ? { attachment: m.piecesJointes.map((p) => ({ name: p.nom, content: b64(p.contenu) })) } : {}),
  };
}

export function payloadResend(m: Message, de: De) {
  return {
    from: `"${de.nom.replace(/["\\]/g, '')}" <${de.email}>`, to: [m.a], subject: m.sujet, html: m.html, text: m.texte,
    ...(m.piecesJointes?.length ? { attachments: m.piecesJointes.map((p) => ({ filename: p.nom, content: b64(p.contenu) })) } : {}),
  };
}

export function creerApi(o: { fournisseur: 'brevo' | 'resend'; cle: string; de: De; fetch?: typeof fetch; delaiMs?: number }): Expediteur {
  const f = o.fetch ?? fetch;
  return {
    async envoyer(m: Message) {
      const brevo = o.fournisseur === 'brevo';
      const res = await f(brevo ? 'https://api.brevo.com/v3/smtp/email' : 'https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(brevo ? { 'api-key': o.cle } : { authorization: `Bearer ${o.cle}` }) },
        body: JSON.stringify(brevo ? payloadBrevo(m, o.de) : payloadResend(m, o.de)),
        signal: AbortSignal.timeout(o.delaiMs ?? 10_000),
      });
      if (!res.ok) {
        // Le corps peut contenir l'adresse du destinataire : on ne garde que le statut et un code court.
        let code = '';
        try {
          const corps = (await res.json()) as { code?: unknown; name?: unknown };
          const c = brevo ? corps.code : corps.name;
          if (typeof c === 'string' && c.length <= 60) code = ` (${c})`;
        } catch { /* corps absent ou illisible */ }
        throw new Error(`Envoi d'e-mail refusé par ${o.fournisseur} : HTTP ${res.status}${code}`);
      }
    },
  };
}
