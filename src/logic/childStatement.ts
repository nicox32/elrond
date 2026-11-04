/**
 * Relevé d'épargne d'un compte enfant, en HTML imprimable (PDF) : tout depuis l'ouverture, avec la valeur au cours
 * du jour, le récapitulatif des versements par année, les règles de protection et la fiscalité. Document de suivi
 * honnête : il récapitule ce qui est enregistré dans l'appli, sans se présenter comme un certificat de dépôt.
 */
import { formatEur, formatPercent } from './format.ts';
import { accountValue, majorityDate, METAL_LABEL } from './ledger.ts';
import { LOGO_PNG_BASE64 } from './logoData.ts';
import { holdingLots } from './tax.ts';
import { type Account, type ChildAccount, type Metal, METALS, type Prices } from './types.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const day = (d: Date | string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const grams = (g: number) =>
  `${g.toLocaleString('fr-FR', { minimumFractionDigits: g >= 100 ? 1 : 3, maximumFractionDigits: g >= 100 ? 1 : 3 })} g`;

/** Versements reçus par l'enfant (dons, versements du parent). */
const isDeposit = (kind: string) => kind === 'family_in';

export function childStatementHtml(account: Account, child: ChildAccount, prices: Prices, now = new Date()): string {
  const value = accountValue(child, prices);
  const lots = holdingLots(child);
  const paid = METALS.reduce((s, m) => s + lots[m].reduce((x, l) => x + l.cost, 0), 0);
  const gain = value.total - paid;
  const deposits = child.transactions.filter((t) => isDeposit(t.kind));
  const totalIn = deposits.reduce((s, t) => s + t.eur, 0);
  const fees = child.transactions.reduce((s, t) => s + (t.fees ?? 0), 0);
  const first = [...child.transactions].sort((a, b) => a.date.localeCompare(b.date))[0];
  const opened = first && first.date < child.createdAt ? first.date : child.createdAt;
  const majority = child.birthDate ? majorityDate(child.birthDate) : null;

  // Récapitulatif par année : nombre de versements, euros versés, grammes reçus.
  // Un don partagé entre plusieurs métaux compte pour un seul versement (même jour).
  const depositDays = new Set(deposits.map((t) => t.date.slice(0, 10)));
  const years = new Map<number, { days: Set<string>; eur: number; g: Record<Metal, number> }>();
  for (const t of deposits) {
    const y = new Date(t.date).getFullYear();
    const row = years.get(y) ?? { days: new Set<string>(), eur: 0, g: { gold: 0, silver: 0, platinum: 0 } };
    row.days.add(t.date.slice(0, 10));
    row.eur += t.eur;
    for (const m of METALS) row.g[m] += Math.max(0, t.deltas[m] ?? 0);
    years.set(y, row);
  }
  const used = METALS.filter((m) => child.holdings[m] > 1e-6 || [...years.values()].some((r) => r.g[m] > 0));
  const yearRows = [...years.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(
      ([y, r]) =>
        `<tr><td>${y}</td><td class="n">${r.days.size}</td><td class="n">${formatEur(r.eur)}</td>${used.map((m) => `<td class="n">${grams(r.g[m])}</td>`).join('')}</tr>`,
    )
    .join('');
  const recent = child.transactions
    .slice(0, 12)
    .map(
      (t) =>
        `<tr><td>${new Date(t.date).toLocaleDateString('fr-FR')}</td><td>${esc(t.label)}</td><td class="n">${METALS.filter(
          (m) => t.deltas[m],
        )
          .map((m) => `${t.deltas[m] > 0 ? '+' : '−'}${grams(Math.abs(t.deltas[m]))} ${METAL_LABEL[m]}`)
          .join('<br/>')}</td><td class="n">${formatEur(t.eur)}</td></tr>`,
    )
    .join('');
  const co = child.coParent?.name;

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>Relevé d’épargne de ${esc(child.name)}</title><style>
  @page { size: A4; margin: 14mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1d1f24; font-size: 11px; line-height: 1.45; margin: 0; }
  .head { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #b8902c; padding-bottom: 12px; }
  .head img { width: 62px; height: 62px; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: 1px; }
  .brand small { display: block; font-size: 10px; font-weight: 500; color: #6b7080; letter-spacing: 0; }
  .meta { margin-left: auto; text-align: right; color: #6b7080; font-size: 10px; }
  h1 { font-size: 19px; margin: 18px 0 2px; }
  .sub { color: #6b7080; margin: 0 0 12px; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #8a6a1c; margin: 18px 0 6px; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .kpi { background: #faf6ec; border: 1px solid #e6dcc3; border-radius: 8px; padding: 10px 12px; }
  .kpi .k { font-size: 9.5px; color: #7a7f8c; text-transform: uppercase; letter-spacing: .5px; }
  .kpi .v { font-size: 17px; font-weight: 800; margin-top: 2px; }
  .kpi .s { font-size: 10px; color: #6b7080; }
  .up { color: #1b7a43; } .down { color: #b3261e; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; background: #1d1f24; color: #f3e7c4; font-weight: 600; font-size: 9.5px; padding: 6px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #ece7da; vertical-align: top; }
  .n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  tr.tot td { font-weight: 800; border-top: 1.5px solid #1d1f24; border-bottom: none; }
  ul { margin: 0; padding-left: 16px; } li { margin: 3px 0; }
  .note { background: #faf6ec; border-left: 3px solid #b8902c; padding: 8px 12px; }
  .foot { margin-top: 18px; padding-top: 8px; border-top: 1px solid #ddd; color: #8a8f9c; font-size: 9px; }
  .avoid { break-inside: avoid; }
  </style></head><body>
  <div class="head">
    <img src="data:image/png;base64,${LOGO_PNG_BASE64}" alt="Orvia"/>
    <div class="brand">ORVIA<small>Épargne en or, argent et platine</small></div>
    <div class="meta">Édité le ${day(now)}<br/>Responsable du compte : ${esc(account.holder)}<br/>Membre ${esc(account.memberId)}</div>
  </div>

  <h1>Relevé d’épargne de ${esc(child.name)}</h1>
  <p class="sub">Compte ouvert le ${day(opened)}${child.birthDate ? ` · né(e) le ${day(child.birthDate)}` : ''}${majority ? ` · majorité le ${day(majority)}` : ''}</p>

  <div class="kpis">
    <div class="kpi"><div class="k">Valeur du compte</div><div class="v">${formatEur(value.total)}</div><div class="s">au cours du ${day(now)}</div></div>
    <div class="kpi"><div class="k">Total versé</div><div class="v">${formatEur(totalIn || paid)}</div><div class="s">${depositDays.size} versement${depositDays.size > 1 ? 's' : ''}, frais d’achat compris (${formatEur(fees)})</div></div>
    <div class="kpi"><div class="k">Plus-value latente</div><div class="v ${gain >= 0 ? 'up' : 'down'}">${gain >= 0 ? '+' : '−'}${formatEur(Math.abs(gain))}</div><div class="s">${paid > 0 ? formatPercent((gain / paid) * 100) : '—'} depuis l’ouverture</div></div>
  </div>

  <h2>Coffres de ${esc(child.name)}</h2>
  <table>
    <tr><th>Métal</th><th class="n">Quantité</th><th class="n">Cours du jour</th><th class="n">Valeur</th></tr>
    ${METALS.filter((m) => child.holdings[m] > 1e-6)
      .map(
        (m) =>
          `<tr><td>${METAL_LABEL[m]}</td><td class="n">${grams(child.holdings[m])}</td><td class="n">${formatEur(prices[m])} / g</td><td class="n">${formatEur(value.byMetal[m])}</td></tr>`,
      )
      .join('')}
    <tr class="tot"><td colspan="3">Total</td><td class="n">${formatEur(value.total)}</td></tr>
  </table>

  ${
    yearRows
      ? `<h2>Versements par année</h2>
  <table class="avoid">
    <tr><th>Année</th><th class="n">Versements</th><th class="n">Montant</th>${used.map((m) => `<th class="n">${METAL_LABEL[m]} reçu</th>`).join('')}</tr>
    ${yearRows}
    <tr class="tot"><td>Total</td><td class="n">${depositDays.size}</td><td class="n">${formatEur(totalIn)}</td>${used.map((m) => `<td class="n">${grams([...years.values()].reduce((s, r) => s + r.g[m], 0))}</td>`).join('')}</tr>
  </table>`
      : ''
  }

  <div class="avoid">
  <h2>Protection de l’enfant</h2>
  <ul>
    <li>L’argent versé appartient à ${esc(child.name)} : il ne peut pas être repris librement.</li>
    <li>${child.authority === 'sole' ? 'Un retrait n’est possible que dans l’intérêt de l’enfant, avec un motif.' : `Tout retrait doit être validé par les deux parents (${esc(account.holder)}${co ? ` et ${esc(co)}` : ''}), avec un motif, et seulement dans l’intérêt de l’enfant.`}</li>
    <li>${majority ? `Le compte sera transféré à ${esc(child.name)} le ${day(majority)}, à ses 18 ans.` : `Le compte sera transféré à ${esc(child.name)} à ses 18 ans.`}</li>
  </ul>
  </div>

  <div class="avoid">
  <h2>Fiscalité</h2>
  <div class="note">Chaque parent peut donner jusqu’à 100 000 € à son enfant tous les 15 ans sans droits de donation : les versements de ce relevé (${formatEur(totalIn)}) en sont très loin. Si ${esc(child.name)} revend un jour du métal, l’impôt sur la vente des métaux s’applique au moment de la vente (le régime le moins cher est choisi), et il disparaît après 22 ans de détention.</div>
  </div>

  ${
    recent
      ? `<div class="avoid"><h2>Derniers mouvements</h2>
  <table><tr><th>Date</th><th>Opération</th><th class="n">Mouvement</th><th class="n">Montant</th></tr>${recent}</table></div>`
      : ''
  }

  <div class="foot">Relevé de suivi édité par l’application Orvia. Il récapitule les versements et les quantités enregistrés dans l’application, valorisés au cours du jour d’édition. Il ne constitue ni un certificat de dépôt, ni une preuve de détention de métaux.</div>
  </body></html>`;
}
