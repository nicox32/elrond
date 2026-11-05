/**
 * Relevés de compte et avis d'opération, en HTML imprimable (transformé en PDF par src/pdf.ts).
 */
import { formatEur, formatWeightDelta } from './format.ts';
import { METAL_LABEL } from './ledger.ts';
import { LOGO_PNG_BASE64 } from './logoData.ts';
import {
  type Account,
  type ChildAccount,
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

const DOT: Record<Metal, string> = { gold: '#D4AF37', silver: '#AEB4BE', platinum: '#8FB3CC' };
const grams = (g: number) =>
  `${g.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}\u00a0g`;
const perGramText = (n: number, m: Metal) =>
  `${n.toLocaleString('fr-FR', { minimumFractionDigits: m === 'silver' ? 3 : 2, maximumFractionDigits: m === 'silver' ? 3 : 2 })}\u00a0€/g`;

/** Relevé lisible (modèle A) : en-tête avec adresse, chiffres clés, opérations détaillées, soldes. */
const STYLE_A = `
  @page { size: A4; margin: 13mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1d1f24; font-size: 10.5px; line-height: 1.4; margin: 0; }
  .head { display: flex; align-items: flex-start; gap: 12px; border-bottom: 2px solid #b8902c; padding-bottom: 10px; }
  .head img { width: 52px; height: 52px; }
  .brand { font-size: 19px; font-weight: 800; letter-spacing: 1px; }
  .brand small { display: block; font-size: 9.5px; font-weight: 500; color: #6b7080; letter-spacing: 0; }
  .addr { margin-left: auto; font-size: 10.5px; line-height: 1.45; border: 1px solid #e6dcc3; border-radius: 6px; padding: 7px 12px; min-width: 190px; }
  h1 { font-size: 16px; margin: 12px 0 1px; }
  .sub { color: #6b7080; margin: 0 0 10px; }
  h2 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #8a6a1c; margin: 14px 0 5px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; background: #1d1f24; color: #f3e7c4; font-weight: 600; font-size: 9px; padding: 5px 6px; }
  td { padding: 4px 6px; border-bottom: 1px solid #ece7da; vertical-align: top; }
  td.num, th.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  tr.tot td { font-weight: 800; border-top: 1.5px solid #1d1f24; border-bottom: none; }
  .pos { color: #1b7a43; } .neg { color: #b3261e; } .muted { color: #7a7f8c; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .kpi { background: #faf6ec; border: 1px solid #e6dcc3; border-radius: 7px; padding: 7px 9px; }
  .kpi .k { font-size: 8.5px; color: #7a7f8c; text-transform: uppercase; letter-spacing: .5px; }
  .kpi .v { font-size: 14px; font-weight: 800; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }
  .foot { margin-top: 12px; padding-top: 7px; border-top: 1px solid #ddd; color: #8a8f9c; font-size: 8.5px; }
`;

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
  const now = input.now ?? new Date();
  const child = account.children.find((c) => c === wallet || c.id === (wallet as ChildAccount).id);
  const { from, to } = periodRange(period, wallet.createdAt, now);
  const txs = wallet.transactions
    .filter((t) => {
      const time = new Date(t.date).getTime();
      return time >= from.getTime() && time <= to.getTime() && inScope(t, scope);
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const opening = balancesAt(wallet, new Date(from.getTime() - 1)).holdings;
  const closing = balancesAt(wallet, to).holdings;
  const metals = scope.kind === 'metal' ? [scope.metal] : METALS;

  // Une ligne par métal déplacé : grammes signés, prix au gramme, frais d'achat, autres frais, impôt, montant.
  type Line = {
    t: Transaction;
    m: Metal;
    grams: number;
    perGram: number | null;
    buyFee: number;
    otherFee: number;
    tax: number;
  };
  const lines: Line[] = [];
  for (const t of txs) {
    const moved = metals.filter((m) => (t.deltas[m] ?? 0) !== 0);
    for (const m of moved) {
      const grams = t.deltas[m];
      const single = moved.length === 1;
      const fees = single ? (t.fees ?? 0) : 0;
      const tax = single ? (t.tax ?? 0) : 0;
      let perGram: number | null = null;
      if (single && t.kind !== 'convert' && Math.abs(grams) > 1e-9) {
        // Entrée : montant payé moins les frais ; sortie : montant reçu plus frais et impôt.
        perGram = grams > 0 ? (t.eur - fees) / grams : (t.eur + fees + tax) / -grams;
      }
      const isBuy = t.kind === 'buy' || (grams > 0 && t.kind === 'family_in' && fees > 0);
      lines.push({ t, m, grams, perGram, buyFee: isBuy ? fees : 0, otherFee: isBuy ? 0 : fees, tax });
    }
  }
  const buyFees = lines.reduce((s, l) => s + l.buyFee, 0);
  const otherFees = lines.reduce((s, l) => s + l.otherFee, 0);
  const taxes = lines.reduce((s, l) => s + l.tax, 0);
  const inflowEur = txs.filter((t) => t.kind === (child ? 'family_in' : 'buy')).reduce((s, t) => s + t.eur, 0);

  // Prix moyen payé au gramme sur la période (achats, ou dons reçus pour un enfant), frais compris.
  const avgPaid = (m: Metal) => {
    const rows = lines.filter((l) => l.m === m && l.grams > 0 && (l.t.kind === 'buy' || l.t.kind === 'family_in'));
    const g = rows.reduce((s, l) => s + l.grams, 0);
    const e = rows.reduce(
      (s, l) =>
        s + (l.t.eur * l.grams) / (Object.values(l.t.deltas).reduce((a, b) => a + Math.max(0, b), 0) || l.grams),
      0,
    );
    return g > 0 ? e / g : null;
  };

  const addr = account.settings.address;
  const addrLines = addr ? `${esc(addr.street)}<br/>${esc(addr.postcode)} ${esc(addr.city)}` : '';
  const holderName = addr?.name?.trim() || account.holder;
  const holderBlock = child
    ? `<b>${esc(child.name)}</b> (${child.transferredAt ? 'majeur' : 'mineur'})<br/>représenté par ${esc(holderName)}${addrLines ? `<br/>${addrLines}` : ''}`
    : `<b>${esc(holderName)}</b>${addrLines ? `<br/>${addrLines}` : ''}<br/><span class="muted">Membre ${esc(account.memberId)}</span>`;
  const sign = (g: number, t: Transaction) => (t.kind === 'family_out' ? '→' : g > 0 ? '+' : '−');
  const cls = (g: number, t: Transaction) => (t.kind === 'family_out' ? '' : g > 0 ? 'pos' : 'neg');
  const rows = lines
    .map(
      (l) => `<tr>
        <td>${new Date(l.t.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</td>
        <td>${esc(l.t.label)}</td>
        <td><span class="dot" style="background:${DOT[l.m]}"></span>${METAL_LABEL[l.m]}</td>
        <td class="num ${cls(l.grams, l.t)}">${sign(l.grams, l.t)} ${grams(Math.abs(l.grams))}</td>
        <td class="num">${l.perGram ? perGramText(l.perGram, l.m) : '—'}</td>
        <td class="num">${l.buyFee ? formatEur(l.buyFee) : ''}</td>
        <td class="num">${l.otherFee ? formatEur(l.otherFee) : ''}${l.tax ? `${l.otherFee ? '<br/>' : ''}<span class="muted">impôt</span> ${formatEur(l.tax)}` : ''}</td>
        <td class="num">${formatEur(l.t.eur)}</td>
      </tr>`,
    )
    .join('');
  const scopeLabel = scope.kind === 'metal' ? ` · coffre ${METAL_LABEL[scope.metal]}` : '';
  const title = child ? `Relevé du compte de ${esc(child.name)}` : `Relevé de compte · ${esc(walletName)}`;
  const kpis = child
    ? [
        ['Dons reçus', formatEur(inflowEur)],
        ['Frais d’achat', formatEur(buyFees)],
        ...METALS.filter((m) => metals.includes(m) && lines.some((l) => l.m === m && l.grams > 0))
          .slice(0, 2)
          .map((m) => [
            `${METAL_LABEL[m]} reçu`,
            grams(lines.filter((l) => l.m === m && l.grams > 0).reduce((s, l) => s + l.grams, 0)),
          ]),
      ]
    : [
        ['Investi', formatEur(inflowEur)],
        ['Frais d’achat', formatEur(buyFees)],
        ['Impôt retenu', formatEur(taxes)],
        ['Opérations', String(txs.length)],
      ];
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>${title}</title><style>${STYLE_A}</style></head><body>
  <div class="head">
    <img src="data:image/png;base64,${LOGO_PNG_BASE64}" alt="Orvia"/>
    <div class="brand">ORVIA<small>Épargne en or, argent et platine</small></div>
    <div class="addr">${holderBlock}</div>
  </div>
  <h1>${title}${scopeLabel}</h1>
  <p class="sub">${PERIOD_LABEL[period]} : du ${day(from)} au ${day(to)}${child ? ' · compte enfant (épargne jusqu’à ses 18 ans)' : ''} · édité le ${day(now)}</p>
  <div class="kpis">${kpis.map(([k, v]) => `<div class="kpi"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}</div>
  <h2>${child ? 'Mouvements' : 'Opérations'}</h2>
  <table>
    <thead><tr><th>Date</th><th>Opération</th><th>Métal</th><th class="num">Grammes</th><th class="num">Prix au gramme</th><th class="num">Frais d’achat</th><th class="num">Autres frais / impôt</th><th class="num">Montant</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="8" class="muted">Aucune opération sur la période.</td></tr>'}</tbody>
    ${lines.length ? `<tfoot><tr class="tot"><td colspan="5">${txs.length} opération${txs.length > 1 ? 's' : ''}</td><td class="num">${formatEur(buyFees)}</td><td class="num">${otherFees ? formatEur(otherFees) : ''}${taxes ? `${otherFees ? '<br/>' : ''}impôt ${formatEur(taxes)}` : ''}</td><td class="num"></td></tr></tfoot>` : ''}
  </table>
  <h2>Soldes</h2>
  <table>
    <tr><th>Métal</th><th class="num">Au ${day(from)}</th><th class="num">Variation</th><th class="num">Au ${day(to)}</th><th class="num">Prix moyen payé</th><th class="num">Valeur au cours du jour</th></tr>
    ${metals
      // Un métal à zéro du début à la fin de la période n'apporte rien au relevé.
      .filter((m) => opening[m] > 1e-9 || closing[m] > 1e-9 || lines.some((l) => l.m === m))
      .map((m) => {
        const dv = closing[m] - opening[m];
        const avg = avgPaid(m);
        return `<tr><td><span class="dot" style="background:${DOT[m]}"></span>${METAL_LABEL[m]}</td><td class="num">${grams(opening[m])}</td><td class="num ${dv >= 0 ? 'pos' : 'neg'}">${dv >= 0 ? '+' : '−'} ${grams(Math.abs(dv))}</td><td class="num">${grams(closing[m])}</td><td class="num">${avg ? perGramText(avg, m) : '—'}</td><td class="num">${formatEur(closing[m] * prices[m])}</td></tr>`;
      })
      .join('')}
    <tr class="tot"><td colspan="5">Valeur totale (cours du ${day(now)})</td><td class="num">${formatEur(metals.reduce((s, m) => s + closing[m] * prices[m], 0))}</td></tr>
  </table>
  <div class="foot">Relevé de suivi édité par l’application Orvia. Prix au gramme : cours du métal au moment de l’opération (hors frais) ; prix moyen payé : frais d’achat compris. Frais d’achat : 2,8 % (Gold Spot), 6,8 % (argent, platine), compris dans le montant. Métaux conservés en coffre-fort en port franc, inscrits au nom du titulaire et séparés des biens d’Orvia. Ce relevé n’est ni une facture ni une attestation de dépôt.</div>
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
