/**
 * Dons manuels à un enfant : récapitulatif par période pour le formulaire 2735 (déclaration de don manuel),
 * suivi de l'abattement parent-enfant (100 000 € par parent et par enfant sur 15 ans) et rappel trimestriel.
 * Un don = les versements faits le même jour (un même don peut être partagé entre plusieurs métaux).
 */
import { formatEur } from './format.ts';
import { METAL_LABEL } from './ledger.ts';
import { LOGO_PNG_BASE64 } from './logoData.ts';
import { type Account, type ChildAccount, type Metal, METALS } from './types.ts';

export const GIFT_ALLOWANCE = { amount: 100_000, years: 15 } as const;

export interface Gift {
  /** Jour du don (AAAA-MM-JJ). */
  day: string;
  grams: Record<Metal, number>;
  /** Valeur du métal reçu au jour du don (€). */
  value: number;
}

export type GiftPeriod = 'quarter' | 'lastQuarter' | 'year' | 'lastYear' | 'all';

export const GIFT_PERIOD_LABEL: Record<GiftPeriod, string> = {
  quarter: 'Ce trimestre',
  lastQuarter: 'Trimestre précédent',
  year: 'Cette année',
  lastYear: 'Année précédente',
  all: 'Depuis l’ouverture',
};

/** « 2026-T4 » pour une date. */
export function quarterKey(d: Date): string {
  return `${d.getFullYear()}-T${Math.floor(d.getMonth() / 3) + 1}`;
}

export function quarterLabel(key: string): string {
  const [y, q] = key.split('-T');
  return `${['1er', '2e', '3e', '4e'][Number(q) - 1]} trimestre ${y}`;
}

/** Début (inclus) et fin (exclue) d'une période. */
export function giftPeriodRange(period: GiftPeriod, now = new Date()): { from: Date; to: Date; label: string } {
  const y = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3);
  switch (period) {
    case 'quarter':
      return { from: new Date(y, q * 3, 1), to: new Date(y, q * 3 + 3, 1), label: quarterLabel(quarterKey(now)) };
    case 'lastQuarter': {
      const from = new Date(y, q * 3 - 3, 1);
      return { from, to: new Date(y, q * 3, 1), label: quarterLabel(quarterKey(from)) };
    }
    case 'year':
      return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1), label: `Année ${y}` };
    case 'lastYear':
      return { from: new Date(y - 1, 0, 1), to: new Date(y, 0, 1), label: `Année ${y - 1}` };
    default:
      return { from: new Date(2000, 0, 1), to: new Date(y + 1, 0, 1), label: 'Depuis l’ouverture' };
  }
}

/** Dons reçus par l'enfant (versements familiaux), regroupés par jour, du plus ancien au plus récent. */
export function childGifts(child: Pick<ChildAccount, 'transactions'>, from?: Date, to?: Date): Gift[] {
  const byDay = new Map<string, Gift>();
  for (const t of child.transactions) {
    if (t.kind !== 'family_in' || t.reversed) continue;
    const d = new Date(t.date);
    if ((from && d < from) || (to && d >= to)) continue;
    const day = t.date.slice(0, 10);
    const g = byDay.get(day) ?? { day, grams: { gold: 0, silver: 0, platinum: 0 }, value: 0 };
    for (const m of METALS) g.grams[m] += Math.max(0, t.deltas[m] ?? 0);
    g.value += t.eur;
    byDay.set(day, g);
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Part de l'abattement de 15 ans déjà utilisée par les dons de ce parent à cet enfant. */
export function allowanceUsed(child: Pick<ChildAccount, 'transactions'>, now = new Date()) {
  const from = new Date(now);
  from.setFullYear(from.getFullYear() - GIFT_ALLOWANCE.years);
  const used = childGifts(child, from).reduce((s, g) => s + g.value, 0);
  return { used, left: Math.max(0, GIFT_ALLOWANCE.amount - used), since: from };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const day = (d: Date | string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const grams = (g: number) => `${g.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} g`;

/** Récapitulatif des dons d'une période, prêt pour le formulaire 2735 (HTML imprimable en PDF). */
export function giftRecapHtml(account: Account, child: ChildAccount, period: GiftPeriod, now = new Date()): string {
  const { from, to, label } = giftPeriodRange(period, now);
  const gifts = childGifts(child, from, to);
  const total = gifts.reduce((s, g) => s + g.value, 0);
  const totals = { gold: 0, silver: 0, platinum: 0 } as Record<Metal, number>;
  for (const g of gifts) for (const m of METALS) totals[m] += g.grams[m];
  const used = METALS.filter((m) => totals[m] > 0);
  const allowance = allowanceUsed(child, now);
  const rows = gifts
    .map(
      (g) =>
        `<tr><td>${day(g.day)}</td>${used.map((m) => `<td class="n">${g.grams[m] ? grams(g.grams[m]) : '—'}</td>`).join('')}<td class="n">${formatEur(g.value)}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>Dons à ${esc(child.name)} — ${esc(label)}</title><style>
  @page { size: A4; margin: 14mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1d1f24; font-size: 11px; line-height: 1.45; margin: 0; }
  .head { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #b8902c; padding-bottom: 12px; }
  .head img { width: 56px; height: 56px; }
  .brand { font-size: 20px; font-weight: 800; letter-spacing: 1px; }
  .meta { margin-left: auto; text-align: right; color: #6b7080; font-size: 10px; }
  h1 { font-size: 18px; margin: 16px 0 2px; }
  .sub { color: #6b7080; margin: 0 0 12px; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #8a6a1c; margin: 16px 0 6px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .box { background: #faf6ec; border: 1px solid #e6dcc3; border-radius: 8px; padding: 8px 12px; }
  .box .k { font-size: 9.5px; color: #7a7f8c; text-transform: uppercase; letter-spacing: .5px; }
  .box .v { font-weight: 700; font-size: 12.5px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; background: #1d1f24; color: #f3e7c4; font-weight: 600; font-size: 9.5px; padding: 6px 8px; }
  td { padding: 5px 8px; border-bottom: 1px solid #ece7da; }
  .n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  tr.tot td { font-weight: 800; border-top: 1.5px solid #1d1f24; border-bottom: none; }
  ol { margin: 0; padding-left: 18px; } li { margin: 3px 0; }
  .note { background: #faf6ec; border-left: 3px solid #b8902c; padding: 8px 12px; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 18px; }
  .sign div { border-top: 1px solid #1d1f24; padding-top: 4px; color: #6b7080; font-size: 10px; height: 46px; }
  .foot { margin-top: 16px; padding-top: 8px; border-top: 1px solid #ddd; color: #8a8f9c; font-size: 9px; }
  </style></head><body>
  <div class="head">
    <img src="data:image/png;base64,${LOGO_PNG_BASE64}" alt="Orvia"/>
    <div class="brand">ORVIA</div>
    <div class="meta">Édité le ${day(now)}<br/>Membre ${esc(account.memberId)}</div>
  </div>
  <h1>Récapitulatif des dons manuels — ${esc(label)}</h1>
  <p class="sub">Pour la déclaration de don manuel (formulaire 2735 ou en ligne sur impots.gouv.fr).</p>

  <div class="grid">
    <div class="box"><div class="k">Donateur</div><div class="v">${esc(account.holder)}</div>parent de l’enfant</div>
    <div class="box"><div class="k">Bénéficiaire</div><div class="v">${esc(child.name)}</div>${child.birthDate ? `né(e) le ${day(child.birthDate)}, mineur(e)` : 'mineur(e)'}</div>
    <div class="box"><div class="k">Acceptation</div><div class="v">${esc(account.holder)}</div>pour l’enfant, en qualité de représentant légal</div>
    <div class="box"><div class="k">Période</div><div class="v">${esc(label)}</div>du ${day(from)} au ${day(new Date(to.getTime() - 86_400_000))}</div>
  </div>

  <h2>Dons de la période</h2>
  ${
    gifts.length
      ? `<table><tr><th>Date du don</th>${used.map((m) => `<th class="n">${METAL_LABEL[m]}</th>`).join('')}<th class="n">Valeur au jour du don</th></tr>${rows}
  <tr class="tot"><td>${gifts.length} don${gifts.length > 1 ? 's' : ''}</td>${used.map((m) => `<td class="n">${grams(totals[m])}</td>`).join('')}<td class="n">${formatEur(total)}</td></tr></table>`
      : '<p>Aucun don sur cette période.</p>'
  }

  <h2>À reporter sur la déclaration</h2>
  <ol>
    <li>Nature du bien : métaux précieux d’investissement (or, argent, platine), inscrits au nom de l’enfant.</li>
    <li>Valeur déclarée : <b>${formatEur(total)}</b> (valeur au jour de chaque don).</li>
    <li>Lien de parenté : parent → enfant. Abattement de ${formatEur(GIFT_ALLOWANCE.amount)} par parent et par enfant, sur ${GIFT_ALLOWANCE.years} ans.</li>
    <li>Abattement déjà utilisé sur ${GIFT_ALLOWANCE.years} ans (depuis le ${day(allowance.since)}) : <b>${formatEur(allowance.used)}</b> — reste <b>${formatEur(allowance.left)}</b>. Aucun droit de donation à payer tant que ce reste est positif.</li>
  </ol>

  <h2>Bon à savoir</h2>
  <div class="note">Le don manuel est irrévocable : le métal appartient à l’enfant et ne peut pas être repris par le donateur. La déclaration donne une date certaine au don. Pour une revente future par l’enfant, la valeur déclarée et la date du don servent en principe de prix et de date d’acquisition. Gardez ce récapitulatif avec les relevés et les factures d’achat d’origine.</div>

  <div class="sign"><div>Le donateur — date et signature</div><div>Le représentant légal, pour l’enfant — date et signature</div></div>

  <div class="foot">Récapitulatif établi par l’application Orvia d’après les versements enregistrés sur le compte de l’enfant. Il aide à remplir la déclaration ; il ne constitue ni une attestation d’un dépositaire, ni un conseil juridique ou fiscal.</div>
  </body></html>`;
}

/**
 * Rappel trimestriel : au début de chaque trimestre, si l'enfant a reçu des dons au trimestre précédent et
 * qu'ils ne sont pas marqués comme déclarés, une notification (une seule fois par trimestre).
 */
export function runDeclarationReminders(account: Account, now = new Date()) {
  const prevStart = giftPeriodRange('lastQuarter', now);
  const prevKey = quarterKey(prevStart.from);
  const notices: { title: string; body: string }[] = [];
  let changed = false;
  const children = account.children.map((c) => {
    if (c.transferredAt || c.declarationRemindedFor === prevKey || c.declaredQuarters?.includes(prevKey)) return c;
    const gifts = childGifts(c, prevStart.from, prevStart.to);
    if (!gifts.length) return c;
    const total = gifts.reduce((s, g) => s + g.value, 0);
    notices.push({
      title: `Dons à ${c.name} : à déclarer`,
      body: `${gifts.length} don${gifts.length > 1 ? 's' : ''} au ${quarterLabel(prevKey)} (${formatEur(total)}). Récapitulatif pour le formulaire 2735 dans son compte.`,
    });
    changed = true;
    return { ...c, declarationRemindedFor: prevKey };
  });
  return { account: changed ? { ...account, children } : account, notices };
}
