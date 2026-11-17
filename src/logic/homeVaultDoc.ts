/**
 * Fiches du coffre maison : texte de chaque lingotin ou pièce (lu par n'importe quel lecteur de QR code) et inventaire
 * imprimable. Ce sont des fiches d'inventaire : seuls le numéro gravé et le certificat de l'affinerie prouvent
 * l'authenticité d'un lingotin.
 */
import { BAR_PHOTOS } from './barPhotos.ts';
import { formatEur } from './format.ts';
import { controlledOn } from './barControl.ts';
import { homeVaultTotal, placeLabel, productOf, specLine } from './physical.ts';
import { qrSvg } from './qr.ts';
import { docHead, esc, STYLE_A } from './statement.ts';
import type { Account, HomeBar, Prices } from './types.ts';

const d = (iso: string) => new Date(iso).toLocaleDateString('fr-FR');

export const exemptYear = (b: HomeBar) => new Date(b.acquiredTo).getFullYear() + 22;

/** Texte encodé dans le QR code d'un lingotin ou d'une pièce. */
export function barQrText(b: HomeBar, ownerName?: string): string {
  const p = productOf(b.product);
  const grams = b.grams.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
  return [
    'ORVIA · Coffre maison',
    `${p.label} · ${grams} g d’or fin`,
    ...(specLine(p.spec) ? [specLine(p.spec)!] : []),
    ...(b.ref ? [`Réf. interne Orvia : ${b.ref}`] : []),
    `Lieu de garde : ${placeLabel(b)}`,
    ...(b.ownerChildId ? [`Propriété de ${ownerName ?? 'un enfant'} (don du ${d(b.giftedAt ?? b.orderedAt)})`] : []),
    b.serial ? `${p.coin ? 'Millésime' : 'N° de série'} : ${b.serial}` : 'N° de série : à noter à réception',
    `Retiré du coffre Orvia le ${d(b.orderedAt)}${b.receivedAt ? ` · reçu le ${d(b.receivedAt)}` : ''}`,
    `Or acheté du ${d(b.acquiredFrom)} au ${d(b.acquiredTo)}`,
    `Prix de revient : ${formatEur(b.cost)}`,
    `Exonéré de plus-value en ${exemptYear(b)}`,
    ...(controlledOn(b)
      ? [
          `Contrôlé par Orvia le ${d(controlledOn(b)!)}${b.weightRef ? ` · poids de référence ${b.weightRef.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} g` : ''}`,
        ]
      : []),
    ...(p.spec?.veriscan ? ['Authenticité : à vérifier avec PAMP VERISCAN.'] : []),
    'Fiche d’inventaire, pas un certificat d’authenticité.',
  ].join('\n');
}

/** Inventaire du coffre maison en HTML imprimable (PDF) : un QR code par lingotin ou pièce. */
export function homeVaultHtml(account: Account, prices: Prices, now = new Date()): string {
  const bars = account.homeVault ?? [];
  const total = homeVaultTotal(account, prices);
  const ownerOf = (b: HomeBar) => account.children.find((c) => c.id === b.ownerChildId)?.name ?? 'un enfant';
  const rows = bars
    .map((b) => {
      const p = productOf(b.product);
      return `<tr>
        <td style="width:110px">${qrSvg(barQrText(b, b.ownerChildId ? ownerOf(b) : undefined), 100)}</td>
        <td style="width:70px">${BAR_PHOTOS[b.product] ? `<img src="${BAR_PHOTOS[b.product]}" width="64" height="64" alt="${esc(p.label)}" style="border-radius:6px"/>` : ''}</td>
        <td><b>${esc(p.label)}</b><br/>${b.grams.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} g d’or fin<br/>
          ${specLine(p.spec) ? `<span class="muted">${esc(specLine(p.spec)!)}${p.spec?.veriscan ? ' · VERISCAN' : ''}</span><br/>` : ''}
          ${p.coin ? 'Millésime' : 'N° de série'} : <b>${esc(b.serial ?? 'à noter à réception')}</b>${b.ref ? `<br/><span class="muted">Réf. interne Orvia : ${esc(b.ref)}</span>` : ''}${b.ownerChildId ? `<br/><b>Propriété de ${esc(ownerOf(b))}</b> <span class="muted">(don du ${d(b.giftedAt ?? b.orderedAt)})</span>` : ''}<br/><span class="muted">Lieu : ${esc(placeLabel(b))}</span></td>
        <td>Retiré le ${d(b.orderedAt)}${b.receivedAt ? `<br/>reçu le ${d(b.receivedAt)}` : '<br/><span class="muted">en livraison</span>'}${controlledOn(b) ? `<br/><b>✓ contrôlé le ${d(controlledOn(b)!)}</b>` : ''}</td>
        <td>Acheté du ${d(b.acquiredFrom)}<br/>au ${d(b.acquiredTo)}<br/>exonéré en ${exemptYear(b)}</td>
        <td class="num">${formatEur(b.cost)}</td>
        <td class="num">${formatEur(b.grams * prices.gold)}</td>
      </tr>`;
    })
    .join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>Inventaire du coffre maison</title><style>${STYLE_A}
  td { vertical-align: middle; }</style></head><body>
  ${docHead(account)}
  <h1>Inventaire du coffre maison</h1>
  <p class="sub">Lingotins et pièces d’or retirés du coffre Orvia · ${total.count} objet${total.count > 1 ? 's' : ''}, ${total.grams.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} g d’or fin, ≈ ${formatEur(total.value)} au cours du ${d(now.toISOString())}</p>
  <table><thead><tr><th>QR code</th><th>Photo du modèle</th><th>Objet</th><th>Retrait</th><th>Or d’origine</th><th class="num">Prix de revient</th><th class="num">Valeur de l’or</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="7" class="muted">Aucun lingotin ni pièce chez vous.</td></tr>'}</tbody></table>
  <div class="foot">La photo montre le modèle du format, pas votre exemplaire : le numéro visible dessus n’est pas le vôtre. Fiche d’inventaire éditée par l’application Orvia, à garder avec vos papiers (succession, assurance habitation, revente). Chaque QR code reprend la fiche de l’objet et se lit avec n’importe quel téléphone. Ce document n’est pas un certificat d’authenticité : seuls le numéro gravé et le certificat de l’affinerie le sont ; les lingots PAMP se vérifient aussi par numérisation avec la technologie VERISCAN de l’affinerie. Prix de revient et dates d’achat d’origine : à présenter pour l’impôt en cas de revente.</div>
  </body></html>`;
}
