/**
 * QR code d'un numéro de membre : unique, puisque le numéro l'est. Le texte du QR est « ORVIA:MEMBRE:OV-M-XXXX-XXXX »
 * (ou OV-E-… pour un compte enfant) ; n'importe quel téléphone le lit, et l'appli saura le reconnaître.
 */
const PREFIX = 'ORVIA:MEMBRE:';

export function memberQrText(memberNumber: string): string {
  return `${PREFIX}${memberNumber.trim().toUpperCase()}`;
}

/** Le numéro de membre contenu dans un QR Orvia, ou null si le texte n'en est pas un. */
export function parseMemberQr(text: string): string | null {
  const t = text.trim();
  if (!t.toUpperCase().startsWith(PREFIX)) return null;
  const id = t.slice(PREFIX.length).trim().toUpperCase();
  return /^OV-(M-|E-)?[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(id) ? id : null;
}
