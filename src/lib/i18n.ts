import type { Lang } from './event';
export type { Lang } from './event';

export const LANGS = ['fr', 'en'] as const satisfies readonly Lang[];

export function isLang(x: unknown): x is Lang {
  return typeof x === 'string' && (LANGS as readonly string[]).includes(x);
}

export function detectLang(cookie: string | undefined, acceptLanguage: string | null): Lang {
  if (isLang(cookie)) return cookie;
  const prefs = (acceptLanguage ?? '')
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { lang: tag.trim().toLowerCase().split('-')[0], q: q ? Number(q.slice(2)) : 1, index };
    })
    .filter((p) => p.lang && !Number.isNaN(p.q))
    .sort((a, b) => b.q - a.q || a.index - b.index);
  const found = prefs.find((p) => isLang(p.lang));
  return found ? (found.lang as Lang) : 'fr';
}

export function switchPath(pathname: string, to: Lang): string {
  const rest = pathname.replace(/^\/(fr|en)(?=\/|$)/, '');
  const clean = rest === '' || rest === '/' ? '/' : rest;
  return `/${to}${clean}`;
}

const DICT = {
  'nav.accueil': { fr: 'Accueil', en: 'Home' },
  'nav.histoire': { fr: 'Notre histoire', en: 'Our story' },
  'nav.programme': { fr: 'Programme & lieux', en: 'Schedule & venues' },
  'nav.infos': { fr: 'Infos pratiques', en: 'Practical info' },
  'nav.rsvp': { fr: "RSVP & Livre d'or", en: 'RSVP & Guestbook' },
  'nav.menu': { fr: 'Menu', en: 'Menu' },
  'nav.langue': { fr: 'Changer de langue', en: 'Change language' },
  'accueil.cta': { fr: 'Je viens ! →', en: "I'm coming! →" },
  'accueil.histoire_lien': { fr: "Lire toute l'histoire →", en: 'Read the whole story →' },
  'accueil.programme': { fr: 'Le programme', en: 'The schedule' },
  'accueil.carte': { fr: 'Voir la carte des lieux', en: 'See the venue map' },
  'accueil.souvenirs': { fr: 'Quelques souvenirs', en: 'A few memories' },
  'accueil.confirmer': { fr: 'Je confirme ma présence', en: 'Confirm my attendance' },
  'accueil.avant': { fr: 'Merci de confirmer avant le', en: 'Please reply before' },
  'compte.jours': { fr: 'jours', en: 'days' },
  'compte.heures': { fr: 'heures', en: 'hours' },
  'compte.minutes': { fr: 'minutes', en: 'minutes' },
  'compte.secondes': { fr: 'secondes', en: 'seconds' },
  'compte.passe': { fr: "C'est le grand jour !", en: "It's the big day!" },
  'histoire.titre': { fr: 'Notre histoire', en: 'Our story' },
  'histoire.galerie': { fr: 'La galerie', en: 'The gallery' },
  'histoire.galerie_aide': { fr: "Clique sur une photo pour l'agrandir", en: 'Click a photo to enlarge it' },
  'galerie.photo': { fr: 'Photo', en: 'Photo' },
  'galerie.fermer': { fr: 'Fermer', en: 'Close' },
  'galerie.precedente': { fr: 'Photo précédente', en: 'Previous photo' },
  'galerie.suivante': { fr: 'Photo suivante', en: 'Next photo' },
  'programme.titre': { fr: 'Programme & lieux', en: 'Schedule & venues' },
  'programme.itineraire': { fr: 'Itinéraire Google Maps', en: 'Google Maps directions' },
  'programme.waze': { fr: 'Waze', en: 'Waze' },
  'programme.legende_lieux': { fr: 'Lieux de la fête', en: 'Party venues' },
  'programme.legende_hebergements': { fr: 'Hébergements conseillés', en: 'Suggested stays' },
  'programme.dormir': { fr: 'Tu viens de loin ? Hôtels et gîtes conseillés sont dans les Infos pratiques.', en: 'Coming from afar? Suggested hotels are in Practical info.' },
  'programme.dormir_lien': { fr: 'Voir les hébergements →', en: 'See places to stay →' },
  'programme.voir_carte': { fr: 'Voir sur la carte', en: 'Show on map' },
  'infos.titre': { fr: 'Infos pratiques', en: 'Practical info' },
  'infos.sous_titre': { fr: "Tout ce qu'il faut savoir pour profiter à fond", en: 'Everything you need to know' },
  'infos.dormir': { fr: 'Où dormir', en: 'Where to stay' },
  'infos.reserver': { fr: 'Réserver', en: 'Book' },
  'infos.tenue': { fr: 'Tenue', en: 'Dress code' },
  'infos.cadeaux': { fr: 'Cadeaux', en: 'Gifts' },
  'infos.cagnotte': { fr: 'Participer à la cagnotte', en: 'Contribute to the fund' },
  'infos.acces': { fr: 'Accès & parking', en: 'Getting there & parking' },
  'infos.contact': { fr: 'Contact', en: 'Contact' },
  'infos.faq': { fr: 'Questions fréquentes', en: 'FAQ' },
  'infos.ecrire': { fr: 'Écrire un e-mail', en: 'Send an email' },
  'pied.question': { fr: 'Une question ?', en: 'Any question?' },
  'erreur.config': { fr: 'Le contenu de l’événement contient des erreurs', en: 'The event content contains errors' },
  'rsvp.err.vient': { fr: 'Indique si tu viens ou non.', en: 'Tell us whether you are coming.' },
  'rsvp.err.nom': { fr: 'Indique ton prénom et ton nom (2 à 100 caractères).', en: 'Enter your first and last name (2–100 characters).' },
  'rsvp.err.email': { fr: 'Adresse e-mail invalide.', en: 'Invalid email address.' },
  'rsvp.err.telephone': { fr: 'Numéro trop long (30 caractères au plus).', en: 'Phone number too long (30 characters max).' },
  'rsvp.err.accompagnants': { fr: '10 accompagnants au plus, 100 caractères chacun.', en: 'Up to 10 plus-ones, 100 characters each.' },
  'rsvp.err.moments': { fr: 'Choisis au moins un moment.', en: 'Choose at least one moment.' },
  'rsvp.err.message': { fr: 'Message trop long (1 000 caractères au plus).', en: 'Message too long (1,000 characters max).' },
  'rsvp.je_viens': { fr: '🎉 Je viens !', en: "🎉 I'm coming!" },
  'rsvp.je_ne_viens_pas': { fr: '😢 Je ne pourrai pas', en: "😢 I can't make it" },
  'rsvp.presence': { fr: 'Ta réponse', en: 'Your reply' },
  'rsvp.nom': { fr: 'Prénom & nom', en: 'First & last name' },
  'rsvp.email': { fr: 'E-mail', en: 'Email' },
  'rsvp.email_aide': { fr: 'pour recevoir ton invitation', en: 'to receive your invitation' },
  'rsvp.telephone': { fr: 'Téléphone', en: 'Phone' },
  'rsvp.facultatif': { fr: '(facultatif)', en: '(optional)' },
  'rsvp.accompagnants': { fr: 'Accompagnants', en: 'Plus-ones' },
  'rsvp.accompagnant': { fr: 'Accompagnant', en: 'Plus-one' },
  'rsvp.ajouter': { fr: '+ Ajouter un accompagnant', en: '+ Add a plus-one' },
  'rsvp.retirer': { fr: 'Retirer', en: 'Remove' },
  'rsvp.moments': { fr: 'À quels moments seras-tu là ?', en: 'Which moments will you join?' },
  'rsvp.message': { fr: 'Un petit mot ?', en: 'A few words?' },
  'rsvp.message_aide': { fr: "(affiché dans le livre d'or)", en: '(shown in the guestbook)' },
  'rsvp.envoyer': { fr: 'Envoyer ma réponse', en: 'Send my reply' },
  'rsvp.enregistrer': { fr: 'Enregistrer les modifications', en: 'Save changes' },
  'rsvp.note': { fr: 'Tu pourras modifier ta réponse grâce au lien reçu par e-mail.', en: 'You can change your reply with the link in your email.' },
  'rsvp.erreurs': { fr: 'Merci de corriger les champs signalés.', en: 'Please fix the highlighted fields.' },
  'rsvp.merci': { fr: 'Merci', en: 'Thank you' },
  'rsvp.note_pour': { fr: "C'est noté pour", en: "We've got you down for" },
  'rsvp.personne': { fr: 'personne', en: 'person' },
  'rsvp.personnes': { fr: 'personnes', en: 'people' },
  'rsvp.email_parti': { fr: 'Ton invitation (PDF) vient de partir à', en: 'Your invitation (PDF) has just been sent to' },
  'rsvp.regrets': { fr: 'Dommage ! Merci de nous avoir prévenus.', en: 'What a shame! Thanks for letting us know.' },
  'rsvp.indesirables': { fr: 'Pense à vérifier tes courriers indésirables.', en: 'Remember to check your spam folder.' },
  'rsvp.email_plus_tard': { fr: "Réponse enregistrée : l'e-mail arrivera un peu plus tard.", en: 'Reply saved: the email will arrive a little later.' },
  'rsvp.doublon_sans_lien': { fr: 'Tu as déjà répondu avec cette adresse. Utilise le lien reçu par e-mail pour modifier ta réponse.', en: 'You have already replied with this address. Use the link in your email to change your reply.' },
  'rsvp.doublon': { fr: "Tu as déjà répondu avec cette adresse : on vient de t'envoyer le lien pour modifier ta réponse.", en: 'You have already replied with this address: we just sent you the link to change your reply.' },
  'rsvp.ferme': { fr: 'Les réponses sont closes. Merci !', en: 'Replies are now closed. Thank you!' },
  'rsvp.limite': { fr: "Trop d'envois en peu de temps. Réessaie dans quelques minutes.", en: 'Too many attempts. Please try again in a few minutes.' },
  'modif.titre': { fr: 'Modifier ma réponse', en: 'Change my reply' },
  'modif.introuvable': { fr: "Ce lien de modification n'est pas valide.", en: 'This edit link is not valid.' },
  'modif.ok': { fr: 'Réponse mise à jour ! Un e-mail récapitulatif vient de partir.', en: 'Reply updated! A summary email is on its way.' },
  'modif.repondre': { fr: 'Répondre au formulaire', en: 'Go to the reply form' },
  'rsvp.retour': { fr: "← Revenir à l'accueil", en: '← Back to home' },
  'livre.titre': { fr: "Le livre d'or", en: 'The guestbook' },
  'livre.vide': { fr: 'Sois le premier à laisser un mot !', en: 'Be the first to leave a message!' },
} as const satisfies Record<string, Record<Lang, string>>;

export type UiKey = keyof typeof DICT;

export function ui(lang: Lang, key: UiKey): string {
  return DICT[key][lang];
}

export function formatDate(iso: string, lang: Lang): string {
  const offset = iso.match(/([+-]\d{2}):?(\d{2})$/);
  const date = new Date(iso);
  // Affiche la date telle qu'elle est vécue sur place, quel que soit le fuseau du serveur.
  const minutes = offset ? (offset[1].startsWith('-') ? -1 : 1) * (Math.abs(Number(offset[1])) * 60 + Number(offset[2])) : 0;
  const local = new Date(date.getTime() + minutes * 60_000);
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(local);
}

export function formatHeure(hhmm: string, lang: Lang): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (lang === 'fr') return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
}
