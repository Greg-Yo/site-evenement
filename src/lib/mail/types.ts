export type PieceJointe = { nom: string; contenu: Uint8Array; type: string };
export type Message = { a: string; sujet: string; html: string; texte: string; piecesJointes?: PieceJointe[] };
export interface Expediteur { envoyer(m: Message): Promise<void> }
