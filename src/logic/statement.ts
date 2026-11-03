/**
 * Relevés de compte et avis d'opération, en HTML imprimable (transformé en PDF par src/pdf.ts).
 */
import { formatEur, formatQty, formatWeightDelta } from './format.ts';
import { METAL_LABEL } from './ledger.ts';
import {
  type Account,
  type Metal,
  METALS,
  type Prices,
  type Transaction,
  type Wallet,
  type WeightUnit,
} from './types.ts';

export type StatementPeriod = 'month' | 'lastMonth' | 'year' | 'all';

export const PERIOD_LABEL: Record<StatementPeriod, string> = {
  month: 'Ce mois-ci',
  lastMonth: 'Mois dernier',
  year: '12 derniers mois',
  all: 'Depuis l’ouverture',
};

export function periodRange(period: StatementPeriod, createdAt: string, now = new Date()): { from: Date; to: Date } {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case 'month':
      return { from: new Date(y, m, 1), to: now };
    case 'lastMonth':
      return { from: new Date(y, m - 1, 1), to: new Date(new Date(y, m, 1).getTime() - 1) };
    case 'year':
      return { from: new Date(y - 1, m, now.getDate()), to: now };
    default:
      return { from: new Date(createdAt), to: now };
  }
}

/** Ce que couvre un relevé : tout le compte, un seul métal (coffre), ou le compte d'attente. */
export type StatementScope = { kind: 'all' } | { kind: 'metal'; metal: Metal };

const inScope = (t: Transaction, scope: StatementScope) =>
  // Les mouvements du seul compte d'attente (crédit, retrait en euros) n'apparaissent pas sur les relevés de métal.
  t.kind !== 'cash_in' && t.kind !== 'cash_out' && (scope.kind === 'all' || (t.deltas[scope.metal] ?? 0) !== 0);

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const stamp = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
const day = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

function movement(t: Transaction, unit: WeightUnit): string {
  const parts = METALS.filter((m) => t.deltas[m]).map(
    (m) => `${formatWeightDelta(t.deltas[m], unit, m)} ${METAL_LABEL[m]}`,
  );
  return parts.join('<br/>') || '—';
}

/** Soldes (métal et compte d'attente) à une date, en remontant l'historique depuis les soldes actuels. */
function balancesAt(wallet: Wallet, at: Date) {
  const holdings = { ...wallet.holdings };
  for (const t of wallet.transactions) {
    if (new Date(t.date).getTime() <= at.getTime()) continue;
    for (const m of METALS) holdings[m] -= t.deltas[m] ?? 0;
  }
  for (const m of METALS) if (Math.abs(holdings[m]) < 1e-6) holdings[m] = 0;
  return { holdings };
}

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 32px; font-size: 12px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #C9A227; padding-bottom: 14px; }
  .brand { font-size: 26px; font-weight: 800; color: #9a7a12; letter-spacing: 1px; }
  .brand small { display: block; font-size: 11px; font-weight: 500; color: #666; letter-spacing: 0; }
  h1 { font-size: 18px; margin: 20px 0 4px; }
  .muted { color: #666; }
  .box { display: flex; gap: 24px; flex-wrap: wrap; margin: 14px 0; padding: 12px 14px; background: #faf6e8; border-radius: 8px; }
  .box div b { display: block; font-size: 13px; color: #1a1a1a; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { text-align: left; font-size: 11px; color: #666; border-bottom: 1px solid #ccc; padding: 6px 4px; }
  td { border-bottom: 1px solid #eee; padding: 7px 4px; vertical-align: top; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .tot td { font-weight: 700; border-top: 2px solid #1a1a1a; }
  .foot { margin-top: 28px; font-size: 10px; color: #888; border-top: 1px solid #ddd; padding-top: 8px; }
`;

function header(account: Account, title: string, subtitle: string) {
  return `
  <div class="head">
    <div class="brand">ORVIA<small>Or, argent et platine physiques</small></div>
    <div class="muted" style="text-align:right">
      Édité le ${day(new Date())}<br/>${esc(account.holder)} · membre ${esc(account.memberId)}<br/>IBAN ${esc(account.iban)}
    </div>
  </div>
  <h1>${esc(title)}</h1>
  <div class="muted">${esc(subtitle)}</div>`;
}

function holdingsLines(holdings: Record<Metal, number>, prices: Prices, unit: WeightUnit) {
  const rows = METALS.filter((m) => holdings[m] > 1e-6).map(
    (m) =>
      `<div>${METAL_LABEL[m]}<b>${formatQty(m, holdings[m], unit).replace(/ de .*$| d’.*$/, '')}</b><span class="muted">≈ ${formatEur(holdings[m] * prices[m])}</span></div>`,
  );
  return rows.join('') || '<div>Aucun avoir</div>';
}

/** Relevé de compte (compte principal, compte enfant, coffre ou compte d'attente) sur une période. */
export function statementHtml(input: {
  account: Account;
  wallet: Wallet;
  walletName: string;
  scope: StatementScope;
  period: StatementPeriod;
  prices: Prices;
  now?: Date;
}): string {
  const { account, wallet, walletName, scope, period, prices } = input;
  const unit = account.settings.unit;
  const { from, to } = periodRange(period, wallet.createdAt, input.now);
  const txs = wallet.transactions
    .filter((t) => {
      const time = new Date(t.date).getTime();
      return time >= from.getTime() && time <= to.getTime() && inScope(t, scope);
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const opening = balancesAt(wallet, new Date(from.getTime() - 1));
  const closing = balancesAt(wallet, to);
  const scopeLabel = scope.kind === 'metal' ? ` · coffre ${METAL_LABEL[scope.metal]}` : '';
  const buyFees = txs.reduce((s, t) => s + (t.kind === 'buy' ? (t.fees ?? 0) : 0), 0);
  const otherFees = txs.reduce((s, t) => s + (t.kind !== 'buy' && t.kind !== 'fee_dormancy' ? (t.fees ?? 0) : 0), 0);
  const dormancy = txs.reduce((s, t) => s + (t.kind === 'fee_dormancy' ? t.eur : 0), 0);
  const taxes = txs.reduce((s, t) => s + (t.tax ?? 0), 0);
  const rows = txs
    .map(
      (t) => `<tr>
        <td>${stamp(t.date)}</td>
        <td>${esc(t.label)}</td>
        <td>${movement(t, unit)}</td>
        <td class="num">${formatEur(t.eur)}</td>
        <td class="num">${t.kind === 'buy' ? (t.fees ? formatEur(t.fees) : t.label.includes('historique 2021') ? '<span class="muted">hors Orvia</span>' : '0,00 €') : ''}</td>
        <td class="num">${t.kind !== 'buy' && t.fees ? formatEur(t.fees) : ''}${t.tax ? `<br/><span class="muted">impôt ${formatEur(t.tax)}</span>` : ''}</td>
      </tr>`,
    )
    .join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>Relevé ${esc(walletName)}</title><style>${STYLE}</style></head><body>
  ${header(account, `Relevé de compte · ${walletName}${scopeLabel}`, `${PERIOD_LABEL[period]} : du ${day(from)} au ${day(to)}`)}
  <div class="box"><div class="muted">Solde au ${day(from)}</div>${holdingsLines(opening.holdings, prices, unit)}</div>
  <table>
    <thead><tr><th>Date</th><th>Opération</th><th>Mouvement</th><th class="num">Montant</th><th class="num">Frais d’achat</th><th class="num">Autres frais / impôt</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6" class="muted">Aucune opération sur la période.</td></tr>'}</tbody>
    ${txs.length ? `<tfoot><tr class="tot"><td colspan="4">${txs.length} opération(s)</td><td class="num">${formatEur(buyFees)}</td><td class="num">${formatEur(otherFees)}${taxes ? `<br/>impôt ${formatEur(taxes)}` : ''}</td></tr></tfoot>` : ''}
  </table>
  <div class="box">
    <div>Frais d’achat payés<b>${formatEur(buyFees)}</b></div>
    <div>Frais de revente, virement et conversion<b>${formatEur(otherFees)}</b></div>
    ${dormancy ? `<div>Frais d’oxydation<b>${formatEur(dormancy)}</b></div>` : ''}
    <div>Impôt retenu et reversé pour vous<b>${formatEur(taxes)}</b></div>
  </div>
  <div class="box"><div class="muted">Solde au ${day(to)}<br/>(valorisé au cours du jour d’édition)</div>${holdingsLines(closing.holdings, prices, unit)}</div>
  <div class="foot">Orvia · métaux conservés en coffre-fort en port franc, propriété du titulaire, inscrits à son nom et séparés des biens d’Orvia.</div>
  </body></html>`;
}

/** Avis d'opération : le détail d'une seule opération. */
export function operationHtml(account: Account, walletName: string, t: Transaction): string {
  const unit = account.settings.unit;
  const line = (k: string, v: string) => `<tr><td class="muted">${k}</td><td class="num"><b>${v}</b></td></tr>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>Avis d’opération</title><style>${STYLE}</style></head><body>
  ${header(account, 'Avis d’opération', `${walletName} · référence ${esc(t.id)}`)}
  <table>
    ${line('Opération', esc(t.label))}
    ${line('Date', stamp(t.date))}
    ${line('Mouvement', movement(t, unit))}
    ${line('Montant', formatEur(t.eur))}
    ${t.fees ? line(t.kind === 'buy' ? 'Frais d’achat' : 'Frais', formatEur(t.fees)) : ''}
    ${t.tax ? line(`Impôt retenu (${t.taxRegime === 'gain' ? 'régime des plus-values' : 'taxe forfaitaire'})`, formatEur(t.tax)) : ''}
    ${t.loyaltyLou ? line('Louis de fidélité échangés', `${t.loyaltyLou} LOU`) : ''}
  </table>
  <div class="foot">Orvia · métaux conservés en coffre-fort en port franc, propriété du titulaire, inscrits à son nom et séparés des biens d’Orvia.</div>
  </body></html>`;
}
