/**
 * Retrait physique : de l'or du coffre livré en lingotins (affineries agréées LBMA, numéro de série et certificat),
 * et registre « Mon coffre maison » des lingotins retirés. Or seulement : l'argent et le platine paieraient 20 % de
 * TVA à la sortie du port franc. Ce n'est pas une vente : pas d'impôt, la durée de détention continue.
 */
import { applyTx, LedgerError, newId } from './ledger.ts';
import { holdingLots } from './tax.ts';
import type { Account, HomeBar, Prices, Settings } from './types.ts';

export const OZ_GRAMS = 31.1034768;

export interface BarProduct {
  id: string;
  label: string;
  grams: number;
  /** Surcoût de fabrication (lingotin) ou prime de marché (pièce), en part de la valeur du métal. */
  premium: number;
  /** Pièce : sa prime varie avec la demande, le prix exact est fixé le jour de la préparation. */
  coin?: boolean;
  /** Fiche technique du produit livré (quand elle est connue). */
  spec?: BarSpec;
  /** Prime payée au vendeur, en part de la valeur de l'or, quand elle est connue (relevé de prix). */
  vendorPremium?: number;
}

export interface BarSpec {
  producer: string;
  /** Titre en millièmes, tel qu'écrit sur le produit (« 999,9 »). */
  purity: string;
  /** Dimensions en mm : lingotin (longueur × largeur × épaisseur) ou pièce (diamètre). */
  lengthMm?: number;
  widthMm?: number;
  thicknessMm?: number;
  diameterMm?: number;
  /** Référence du produit chez le fournisseur. */
  ref?: string;
  /** Lingot PAMP : numéro de série et authenticité vérifiables par numérisation (technologie VERISCAN de PAMP). */
  veriscan?: boolean;
}

/** Mention affichée pour les lingots vérifiables avec VERISCAN. */
export const VERISCAN_NOTE =
  'Authenticité et numéro de série vérifiables par numérisation avec la technologie VERISCAN de PAMP (voir le site de l’affinerie).';

const mm = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

/** Les numéros de certificat PAMP s'écrivent toujours « C » suivi de 6 chiffres (ex. C841201). */
export const PAMP_SERIAL = /^C\d{6}$/;

const isPamp = (productId: string) => productOf(productId).spec?.producer === 'PAMP Suisse';

/** Numéro tel qu'il est gravé : majuscules, sans espace ni tiret pour un lingot PAMP (« c 841-201 » → « C841201 »). */
export function normalizeSerial(productId: string, input: string): string {
  const s = input.trim().toUpperCase();
  return isPamp(productId) && !productOf(productId).coin ? s.replace(/[\s\-_.]/g, '') : s;
}

/** Message d'erreur si le numéro n'a pas le format du producteur, sinon null. */
export function serialFormatError(productId: string, input: string): string | null {
  const p = productOf(productId);
  if (!isPamp(productId) || p.coin) return null;
  return PAMP_SERIAL.test(normalizeSerial(productId, input))
    ? null
    : 'Un numéro PAMP s’écrit « C » suivi de 6 chiffres (ex. C841201).';
}

/** Fiche technique en une ligne : « PAMP Suisse · or 999,9 · 23,3 × 14 × 0,79 mm ». */
export function specLine(s: BarSpec | undefined): string | null {
  if (!s) return null;
  const size = s.diameterMm
    ? `Ø ${mm(s.diameterMm)} mm`
    : s.lengthMm && s.widthMm
      ? `${mm(s.lengthMm)} × ${mm(s.widthMm)}${s.thicknessMm ? ` × ${mm(s.thicknessMm)}` : ''} mm`
      : '';
  return [s.producer, `or ${s.purity}`, size].filter(Boolean).join(' · ');
}

/** Napoléon 20 francs : 6,45 g d'or à 900 ‰, soit 5,806 g d'or fin. */
export const NAPOLEON_FINE_GRAMS = 5.806;

export const BAR_PRODUCTS: BarProduct[] = [
  {
    id: 'g5',
    label: 'Lingotin 5 g',
    grams: 5,
    // Relevé du 18/11/2026 : 621,01 € TTC pour 1 lingotin + 7 € de livraison. Les frais du vendeur (8,91 % du prix)
    // font 9,78 % de la valeur de l'or ; facturée 11 % au client, soit environ 1,2 point de marge (≈ 7 €).
    premium: 0.11,
    vendorPremium: 0.0978,
    spec: {
      veriscan: true,
      producer: 'PAMP Suisse',
      purity: '999,9',
      lengthMm: 23.3,
      widthMm: 14,
      thicknessMm: 0.79,
      ref: 'ZAUFS00080',
    },
  },
  {
    id: 'g10',
    label: 'Lingotin 10 g',
    grams: 10,
    // Relevé du 18/11/2026 : 1 lingotin 1 199,83 € à la commande (+ 7 € de livraison) pour 1 127,83 € d'or, soit
    // 6,4 % de prime (le tableau de prix du vendeur affichait +4,80 %). Facturée 7,5 % au client : ≈ 1,1 point (≈ 12 €).
    premium: 0.075,
    vendorPremium: 0.064,
    spec: {
      veriscan: true,
      producer: 'PAMP Suisse',
      purity: '999,9',
      lengthMm: 26.5,
      widthMm: 15.8,
      thicknessMm: 1.25,
      ref: 'ZAUFS00084',
    },
  },
  {
    id: 'g20',
    label: 'Lingotin 20 g',
    grams: 20,
    // Relevé du 18/11/2026 (détail du prix) : valeur métal 2 259,61 €, frais 147,57 € = 6,53 % ; 7 € de livraison.
    // Facturée 7,5 % : environ 1 point de marge (≈ 22 €), la livraison étant offerte dès 20 g (7 € à votre charge).
    premium: 0.075,
    vendorPremium: 0.0653,
    spec: {
      veriscan: true,
      producer: 'PAMP Suisse',
      purity: '999,9',
      lengthMm: 32,
      widthMm: 18,
      thicknessMm: 1.88,
      ref: 'ZAUFS00089',
    },
  },
  {
    id: 'oz1',
    label: 'Lingot 1 once (31,1 g)',
    grams: OZ_GRAMS,
    // Relevé du 18/11/2026 (détail du prix) : valeur métal 3 508,47 €, frais 182,03 € = 5,19 % ; 7 € de livraison.
    // Facturée 6 % : environ 0,8 point de marge (≈ 28 €), moins les 7 € de livraison offerte dès 20 g.
    premium: 0.06,
    vendorPremium: 0.0519,
    spec: {
      veriscan: true,
      producer: 'PAMP Suisse',
      purity: '999,9',
      lengthMm: 41,
      widthMm: 24,
      thicknessMm: 1.66,
      ref: 'ZAUFS00115',
    },
  },
  {
    id: 'nap20',
    label: 'Napoléon 20 F (5,81 g d’or fin)',
    grams: NAPOLEON_FINE_GRAMS,
    premium: 0.06,
    coin: true,
    // Pièce de 6,45 g à 900 ‰, frappée en France (Monnaie de Paris) de 1803 à 1914.
    spec: { producer: 'Monnaie de Paris', purity: '900 ‰', diameterMm: 21 },
  },
];

/** Valeur d'un lingotin ou d'une pièce : son or au cours du moment, et le prix indicatif avec fabrication ou prime. */
export function productPrice(p: BarProduct, goldEurPerGram: number, premium = p.premium) {
  const metal = goldEurPerGram * p.grams;
  return { metal, withPremium: metal * (1 + premium) };
}

/** Valeur d'un Napoléon : l'or qu'il contient au cours du moment, et le prix indicatif avec sa prime. */
export function napoleonPrice(goldEurPerGram: number) {
  return productPrice(productOf('nap20'), goldEurPerGram);
}

export const PHYSICAL = {
  /** Livraison assurée, remise en main propre contre signature, par envoi… */
  delivery: 12,
  /** … offerte à partir de ce poids d'or dans le même envoi (inciter à grouper les retraits). */
  freeDeliveryFromGrams: 20,
  /** Livraison payée au vendeur, par commande (relevé du 18/11/2026). */
  vendorDelivery: 7,
  /** TVA due à la sortie du port franc pour l'argent et le platine (l'or d'investissement en est exonéré). */
  vatSilverPlatinum: 0.2,
  /** Délai indicatif de livraison, en jours ouvrés. */
  delayDays: '5 à 10',
} as const;

export type BarOrder = Record<string, number>;

/** Frais du retrait physique en vigueur : valeurs de Société Orvia, sinon valeurs par défaut. */
export interface PhysicalFees {
  premiums: Record<string, number>;
  /** Prime payée au vendeur, par produit (seulement ceux dont elle est connue). */
  vendor: Record<string, number>;
  delivery: number;
  /** Livraison payée au vendeur, par commande. */
  vendorDelivery: number;
  freeFromGrams: number;
}

export function physicalFeesOf(settings?: Pick<Settings, 'physicalFees'>): PhysicalFees {
  const s = settings?.physicalFees ?? {};
  const premiums: Record<string, number> = {};
  const vendor: Record<string, number> = {};
  for (const p of BAR_PRODUCTS) {
    premiums[p.id] = s.premiums?.[p.id] ?? p.premium;
    const v = s.vendor?.[p.id] ?? p.vendorPremium;
    if (v !== undefined) vendor[p.id] = v;
  }
  return {
    premiums,
    vendor,
    delivery: s.delivery ?? PHYSICAL.delivery,
    vendorDelivery: s.vendorDelivery ?? PHYSICAL.vendorDelivery,
    freeFromGrams: s.freeFromGrams ?? PHYSICAL.freeDeliveryFromGrams,
  };
}

/** Lignes de la grille « Retrait physique » des Tarifs, avec les frais en vigueur. */
export function physicalFeeRows(fees: PhysicalFees): { label: string; orvia: string }[] {
  const pct = (n: number) => `${(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;
  const row = (id: string, label: string) => ({
    label,
    orvia: productOf(id).coin ? `Prime ≈ ${pct(fees.premiums[id])}, variable` : `Fabrication ${pct(fees.premiums[id])}`,
  });
  return [
    row('g5', 'Lingotin 5 g (PAMP Suisse, numéro de série, certificat, VERISCAN)'),
    row('g10', 'Lingotin 10 g'),
    row('g20', 'Lingotin 20 g'),
    row('oz1', 'Lingot 1 once (31,1 g)'),
    row('nap20', 'Napoléon 20 F (5,81 g d’or fin)'),
    {
      label: 'Livraison assurée, remise contre signature',
      orvia: `${fees.delivery.toLocaleString('fr-FR')} € par envoi, offerte dès ${fees.freeFromGrams.toLocaleString('fr-FR')} g`,
    },
    { label: 'Argent et platine', orvia: 'Non retirables (20 % de TVA)' },
  ];
}

export function productOf(id: string): BarProduct {
  const p = BAR_PRODUCTS.find((x) => x.id === id);
  if (!p) throw new LedgerError('Produit inconnu.');
  return p;
}

/** Détail chiffré d'un retrait : grammes pris au coffre, surcoût de fabrication, livraison. */
export function quoteWithdrawal(prices: Prices, order: BarOrder, fees: PhysicalFees = physicalFeesOf()) {
  const lines = BAR_PRODUCTS.filter((p) => (order[p.id] ?? 0) > 0).map((p) => {
    const qty = Math.floor(order[p.id]);
    const value = qty * p.grams * prices.gold;
    const v = fees.vendor[p.id];
    return {
      product: p,
      qty,
      grams: qty * p.grams,
      value,
      premium: value * (fees.premiums[p.id] ?? p.premium),
      vendorCost: v === undefined ? undefined : value * v,
    };
  });
  const grams = lines.reduce((s, l) => s + l.grams, 0);
  const value = lines.reduce((s, l) => s + l.value, 0);
  const premium = lines.reduce((s, l) => s + l.premium, 0);
  const delivery = !lines.length || grams >= fees.freeFromGrams - 1e-9 ? 0 : fees.delivery;
  const total = Math.round((premium + delivery) * 100) / 100;
  // Coût pour Orvia : lingotins payés au vendeur (si toutes les primes sont connues) et sa livraison, par commande.
  const cost =
    lines.length && lines.every((l) => l.vendorCost !== undefined)
      ? lines.reduce((s, l) => s + (l.vendorCost ?? 0), 0) + fees.vendorDelivery
      : undefined;
  return { lines, grams, value, premium, delivery, fees: total, feesPct: value ? total / value : 0, cost };
}

/**
 * Retire de l'or en lingotins. Les grammes sortent du coffre ; le surcoût et la livraison sont payés depuis le compte
 * d'attente (payer en or serait une vente, donc imposée). Chaque lingotin entre au registre du coffre maison avec
 * les dates et le prix d'achat d'origine du métal (premier entré, premier sorti).
 */
export function withdrawPhysical(account: Account, prices: Prices, order: BarOrder, now = new Date()): Account {
  const q = quoteWithdrawal(prices, order, physicalFeesOf(account.settings));
  if (!q.lines.length) throw new LedgerError('Choisissez au moins un lingotin.');
  if (q.grams > account.holdings.gold + 1e-9) {
    throw new LedgerError(
      `Or insuffisant au coffre : ${account.holdings.gold.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} g disponibles.`,
    );
  }
  const cash = account.cashEur ?? 0;
  if (q.fees > cash + 0.005) {
    throw new LedgerError(
      `Frais de ${q.fees.toFixed(2).replace('.', ',')} € à payer depuis le compte d’attente (${cash.toFixed(2).replace('.', ',')} € disponibles) : créditez-le d’abord.`,
    );
  }
  // Lots d'origine consommés, du plus ancien au plus récent, lingotin par lingotin.
  const lots = holdingLots(account).gold.map((l) => ({ ...l }));
  const take = (grams: number) => {
    let left = grams;
    let cost = 0;
    let from = '';
    let to = '';
    while (left > 1e-9 && lots.length) {
      const lot = lots[0];
      const used = Math.min(left, lot.grams);
      cost += (lot.cost * used) / lot.grams;
      from = from || lot.date;
      to = lot.date;
      lot.cost -= (lot.cost * used) / lot.grams;
      lot.grams -= used;
      left -= used;
      if (lot.grams <= 1e-9) lots.shift();
    }
    return { cost, from: from || now.toISOString(), to: to || now.toISOString() };
  };
  const label = `Retrait physique · ${q.lines.map((l) => `${l.qty} × ${l.product.label.toLowerCase()}`).join(', ')}`;
  let next = applyTx(account, 'withdraw_physical', { gold: -q.grams }, q.value, label, now, q.fees);
  const [tx, ...rest] = next.transactions;
  const bars: HomeBar[] = [];
  for (const l of q.lines) {
    for (let i = 0; i < l.qty; i++) {
      const t = take(l.product.grams);
      bars.push({
        id: newId(),
        product: l.product.id,
        grams: l.product.grams,
        orderedAt: now.toISOString(),
        status: 'preparing',
        cost: Math.round(t.cost * 100) / 100,
        acquiredFrom: t.from,
        acquiredTo: t.to,
        txId: tx.id,
      });
    }
  }
  next = {
    ...next,
    cashEur: Math.round((cash - q.fees) * 100) / 100,
    transactions: [
      {
        ...tx,
        cash: -q.fees,
        ...(q.cost !== undefined ? { costEur: Math.round(q.cost * 100) / 100 } : {}),
      },
      ...rest,
    ],
    homeVault: [...(account.homeVault ?? []), ...bars],
  };
  return next;
}

/** Lingotin reçu : on note la date et son numéro de série (gravé sur le lingotin et son certificat). */
export function receiveBar(account: Account, barId: string, serial: string, now = new Date()): Account {
  const found = (account.homeVault ?? []).find((b) => b.id === barId);
  const s = found ? normalizeSerial(found.product, serial) : serial.trim().toUpperCase();
  if (s.length < 3) throw new LedgerError('Indiquez le numéro de série du lingotin, ou le millésime de la pièce.');
  const bar = (account.homeVault ?? []).find((b) => b.id === barId);
  if (!bar) throw new LedgerError('Lingotin introuvable.');
  const formatError = serialFormatError(bar.product, s);
  if (formatError) throw new LedgerError(formatError);
  // Un numéro de série ne peut désigner qu'un lingot (les millésimes d'une pièce, eux, se répètent).
  const key = (x: string) => x.replace(/[\s\-_.]/g, '').toUpperCase();
  if (
    !productOf(bar.product).coin &&
    (account.homeVault ?? []).some(
      (b) => b.id !== barId && !productOf(b.product).coin && b.serial && key(b.serial) === key(s),
    )
  ) {
    throw new LedgerError('Ce numéro de série est déjà dans la base pour un autre lingot.');
  }
  return {
    ...account,
    homeVault: (account.homeVault ?? []).map((b) =>
      b.id === barId ? { ...b, status: 'received', serial: s, receivedAt: b.receivedAt ?? now.toISOString() } : b,
    ),
  };
}

/** Lingotin revendu ou donné en dehors d'Orvia : on le retire du registre. */
export function removeBar(account: Account, barId: string): Account {
  return { ...account, homeVault: (account.homeVault ?? []).filter((b) => b.id !== barId) };
}

/** Total du coffre maison, valeur au cours de l'or (revente indicative, hors frais du comptoir). */
export function homeVaultTotal(account: Pick<Account, 'homeVault'>, prices: Prices) {
  const bars = account.homeVault ?? [];
  const grams = bars.reduce((s, b) => s + b.grams, 0);
  return { count: bars.length, grams, value: grams * prices.gold, cost: bars.reduce((s, b) => s + b.cost, 0) };
}

/** Coût d'un retrait d'argent ou de platine s'il était proposé : la TVA à la sortie, en euros. */
export function vatIfWithdrawn(value: number): number {
  return value * PHYSICAL.vatSilverPlatinum;
}
