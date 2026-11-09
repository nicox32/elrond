/**
 * Fiscalité dans le temps : calendrier d'exonération (22 ans de détention) et récapitulatif fiscal d'une année.
 */
import { formatEur } from './format.ts';
import { METAL_LABEL } from './ledger.ts';
import { docHead, DOT, esc, STYLE_A } from './statement.ts';
import { holdingAllowance, holdingLots, fullYears, TAX } from './tax.ts';
import { type Account, type Metal, METALS, type Prices, type Transaction, type Wallet } from './types.ts';

export interface ExemptionYear {
  /** Année d'achat (ou de réception) du métal encore détenu. */
  year: number;
  grams: Record<Metal, number>;
  cost: number;
  value: number;
  /** Abattement pour durée de détention aujourd'hui (0 à 1), pour le lot le plus récent de l'année. */
  allowance: number;
  /** Date à partir de laquelle tout le métal de cette année est exonéré (dernier lot + 22 ans). */
  exemptFrom: string;
  exempt: boolean;
}

/** Métal encore détenu regroupé par année d'acquisition, avec sa date d'exonération totale. */
export function exemptionCalendar(wallet: Pick<Wallet, 'transactions'>, prices: Prices, now = new Date()) {
  const lots = holdingLots(wallet);
  const byYear = new Map<number, ExemptionYear & { last: Date }>();
  for (const m of METALS) {
    for (const lot of lots[m]) {
      if (lot.grams < 1e-6) continue;
      const d = new Date(lot.date);
      const y = d.getFullYear();
      const row = byYear.get(y) ?? {
        year: y,
        grams: { gold: 0, silver: 0, platinum: 0 },
        cost: 0,
        value: 0,
        allowance: 0,
        exemptFrom: '',
        exempt: false,
        last: d,
      };
      row.grams[m] += lot.grams;
      row.cost += lot.cost;
      row.value += lot.grams * prices[m];
      if (d > row.last) row.last = d;
      byYear.set(y, row);
    }
  }
  return [...byYear.values()]
    .sort((a, b) => a.year - b.year)
    .map(({ last, ...row }) => {
      const free = new Date(last);
      free.setFullYear(free.getFullYear() + TAX.exemptAfterYears);
      return {
        ...row,
        allowance: holdingAllowance(fullYears(last, now)),
        exemptFrom: free.toISOString(),
        exempt: free <= now,
      };
    });
}

export interface TaxYearLine {
  date: string;
  wallet: string;
  label: string;
  metal: Metal | null;
  eur: number;
  tax: number;
  regime: 'flat' | 'gain' | null;
}

export interface TaxYearRecap {
  year: number;
  /** Ventes, virements, paiements par carte et conversions imposés (impôt retenu par Orvia). */
  taxed: TaxYearLine[];
  saleTotal: number;
  taxFlat: number;
  taxGain: number;
  invested: number;
  buyFees: number;
  custodyFees: number;
  dormancyFees: number;
  /** Dons versés aux enfants dans l'année (valeur au jour du don). */
  gifts: { name: string; eur: number }[];
}

const metalOf = (t: Transaction): Metal | null => METALS.find((m) => (t.deltas[m] ?? 0) < 0) ?? null;

/** Ce que l'année a coûté et rapporté côté impôts, sur le compte principal et les comptes enfants. */
export function taxYearRecap(account: Account, year: number): TaxYearRecap {
  const inYear = (t: Transaction) => new Date(t.date).getFullYear() === year;
  const wallets: { name: string; w: Wallet }[] = [
    { name: 'Compte principal', w: account },
    ...account.children.map((c) => ({ name: c.name, w: c as Wallet })),
  ];
  const taxed: TaxYearLine[] = [];
  let invested = 0;
  let buyFees = 0;
  let custodyFees = 0;
  let dormancyFees = 0;
  for (const { name, w } of wallets) {
    for (const t of w.transactions.filter(inYear)) {
      if (t.tax) {
        taxed.push({
          date: t.date,
          wallet: name,
          label: t.label,
          metal: metalOf(t),
          eur: t.eur,
          tax: t.tax,
          regime: t.taxRegime ?? null,
        });
      }
      if (t.kind === 'buy') {
        invested += t.eur;
        buyFees += t.fees ?? 0;
      }
      if (t.kind === 'fee_custody') custodyFees += t.eur;
      if (t.kind === 'fee_dormancy') dormancyFees += t.eur;
    }
  }
  taxed.sort((a, b) => a.date.localeCompare(b.date));
  const gifts = account.children
    .map((c) => ({
      name: c.name,
      eur: c.transactions.filter((t) => inYear(t) && t.kind === 'family_in').reduce((s, t) => s + t.eur, 0),
    }))
    .filter((g) => g.eur > 0);
  return {
    year,
    taxed,
    saleTotal: taxed.reduce((s, l) => s + l.eur, 0),
    taxFlat: taxed.filter((l) => l.regime !== 'gain').reduce((s, l) => s + l.tax, 0),
    taxGain: taxed.filter((l) => l.regime === 'gain').reduce((s, l) => s + l.tax, 0),
    invested,
    buyFees,
    custodyFees,
    dormancyFees,
    gifts,
  };
}

const longDay = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

/** Récapitulatif fiscal annuel en HTML imprimable (PDF). */
export function taxYearHtml(account: Account, year: number, prices: Prices, now = new Date()): string {
  const r = taxYearRecap(account, year);
  const cal = exemptionCalendar(account, prices, now);
  const kpis: [string, string][] = [
    ['Ventes imposées', formatEur(r.saleTotal)],
    ['Impôt retenu', formatEur(r.taxFlat + r.taxGain)],
    ['Investi dans l’année', formatEur(r.invested)],
    ['Frais payés', formatEur(r.buyFees + r.custodyFees + r.dormancyFees)],
  ];
  const rows = r.taxed
    .map(
      (
        l,
      ) => `<tr><td>${new Date(l.date).toLocaleDateString('fr-FR')}</td><td>${esc(l.wallet)}</td><td>${esc(l.label)}</td>
      <td>${l.metal ? `<span class="dot" style="background:${DOT[l.metal]}"></span>${METAL_LABEL[l.metal]}` : ''}</td>
      <td>${l.regime === 'gain' ? 'Plus-values' : 'Taxe forfaitaire 11,5 %'}</td>
      <td class="num">${formatEur(l.eur)}</td><td class="num">${formatEur(l.tax)}</td></tr>`,
    )
    .join('');
  const calRows = cal
    .map(
      (c) => `<tr><td>${c.year}</td>
      <td class="num">${METALS.filter((m) => c.grams[m] > 1e-6)
        .map(
          (m) =>
            `${c.grams[m].toLocaleString('fr-FR', { maximumFractionDigits: 3 })} g ${METAL_LABEL[m].toLowerCase()}`,
        )
        .join('<br/>')}</td>
      <td class="num">${formatEur(c.cost)}</td><td class="num">${Math.round(c.allowance * 100)} %</td>
      <td class="num">${c.exempt ? 'exonéré' : longDay(c.exemptFrom)}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>Récapitulatif fiscal ${year}</title><style>${STYLE_A}</style></head><body>
  ${docHead(account)}
  <h1>Récapitulatif fiscal ${year}</h1>
  <p class="sub">Du 1er janvier au 31 décembre ${year} · compte principal et comptes enfants · édité le ${longDay(now.toISOString())}</p>
  <div class="kpis">${kpis.map(([k, v]) => `<div class="kpi"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}</div>
  <h2>Cessions imposées (impôt retenu et reversé par Orvia)</h2>
  <table><thead><tr><th>Date</th><th>Compte</th><th>Opération</th><th>Métal</th><th>Régime</th><th class="num">Montant</th><th class="num">Impôt</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="7" class="muted">Aucune vente imposée cette année : rien à déclarer pour les métaux.</td></tr>'}</tbody>
  ${r.taxed.length ? `<tfoot><tr class="tot"><td colspan="5">${r.taxed.length} cession${r.taxed.length > 1 ? 's' : ''}</td><td class="num">${formatEur(r.saleTotal)}</td><td class="num">${formatEur(r.taxFlat + r.taxGain)}</td></tr></tfoot>` : ''}
  </table>
  <h2>Frais de l’année</h2>
  <table><tbody>
    <tr><td>Frais d’achat (compris dans les montants investis)</td><td class="num">${formatEur(r.buyFees)}</td></tr>
    <tr><td>Frais de garde en coffre</td><td class="num">${formatEur(r.custodyFees)}</td></tr>
    <tr><td>Frais d’oxydation</td><td class="num">${formatEur(r.dormancyFees)}</td></tr>
  </tbody></table>
  ${
    r.gifts.length
      ? `<h2>Dons aux enfants</h2><table><tbody>${r.gifts.map((g) => `<tr><td>${esc(g.name)}</td><td class="num">${formatEur(g.eur)}</td></tr>`).join('')}</tbody></table>
  <p class="muted">Dons manuels : à déclarer (formulaire 2735) ; abattement de 100 000 € par parent et par enfant tous les 15 ans.</p>`
      : ''
  }
  <h2>Calendrier d’exonération (22 ans de détention)</h2>
  <table><thead><tr><th>Acquis en</th><th class="num">Encore détenu</th><th class="num">Prix de revient</th><th class="num">Abattement aujourd’hui</th><th class="num">Exonéré à partir du</th></tr></thead>
  <tbody>${calRows || '<tr><td colspan="5" class="muted">Aucun métal détenu.</td></tr>'}</tbody></table>
  <div class="foot">Document de suivi édité par l’application Orvia, à conserver avec vos papiers. L’impôt sur les ventes de métaux est retenu et reversé par Orvia au moment de la vente (taxe forfaitaire de 11,5 % du prix de vente, ou sur option impôt sur la plus-value avec un abattement de 5 % par année de détention au-delà de la 2e) : il n’y a en principe rien à reporter sur votre déclaration de revenus. Ce récapitulatif n’est pas un avis d’imposition.</div>
  </body></html>`;
}
