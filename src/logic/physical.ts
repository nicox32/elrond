/**
 * Retrait physique : de l'or du coffre livré en lingotins (affineries agréées LBMA, numéro de série et certificat),
 * et registre « Mon coffre maison » des lingotins retirés. Or seulement : l'argent et le platine paieraient 20 % de
 * TVA à la sortie du port franc. Ce n'est pas une vente : pas d'impôt, la durée de détention continue.
 */
import { applyTx, getChild, LedgerError, majorityDate, newId, replaceChildAccount } from './ledger.ts';
import { holdingLots } from './tax.ts';
import type { Account, HomeBar, Prices, Settings, StockMove } from './types.ts';

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
  /**
   * Remises de quantité du revendeur, par produit : dès `from` pièces du même produit dans une commande, sa prime
   * baisse de `off` (en part de la valeur de l'or). C'est un coût en moins pour Orvia, pas une remise client.
   */
  vendorTiers?: { from: number; off: number }[];
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

const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Référence interne Orvia, toujours aléatoire : « OV-XXXX-XXXX » (jamais le numéro gravé par l'affinerie). */
export function newRef(taken: Set<string> = new Set(), random: () => number = Math.random): string {
  for (;;) {
    let r = '';
    for (let i = 0; i < 8; i++) r += REF_ALPHABET[Math.floor(random() * REF_ALPHABET.length)];
    const ref = `OV-${r.slice(0, 4)}-${r.slice(4)}`;
    if (!taken.has(ref)) {
      taken.add(ref);
      return ref;
    }
  }
}

/** Un numéro d'essai : chiffres tous identiques, suite (123456, 654321) ou motif répété (121212). */
export function looksFake(digits: string): boolean {
  if (digits.length < 4) return false;
  if (/^(\d)\1+$/.test(digits)) return true;
  if (/^(\d\d)\1+$/.test(digits)) return true;
  const steps = [...digits].slice(1).map((c, i) => (Number(c) - Number(digits[i]) + 10) % 10);
  return steps.every((x) => x === 1) || steps.every((x) => x === 9);
}

/** Message d'erreur si le numéro n'a pas le format du producteur ou ressemble à un numéro d'essai, sinon null. */
export function serialFormatError(productId: string, input: string): string | null {
  const p = productOf(productId);
  if (!isPamp(productId) || p.coin) return null;
  const s = normalizeSerial(productId, input);
  if (!PAMP_SERIAL.test(s)) return 'Un numéro PAMP s’écrit « C » suivi de 6 chiffres (ex. C841201).';
  if (looksFake(s.slice(1))) {
    return 'Ce numéro ressemble à un numéro d’essai (123456, 111111…) : recopiez celui gravé sur le lingot.';
  }
  return null;
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
    vendorPremium: 0.0901, // relevé du 18/11/2026 : 612,50 € l'unité pour 561,86 € d'or
    vendorTiers: [
      { from: 10, off: 0.0062 },
      { from: 20, off: 0.0089 },
      { from: 50, off: 0.0169 },
    ],
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
    vendorPremium: 0.0652, // Godot & Fils, 18/11/2026 : 1 191 € pour 1 118,08 € d'or
    vendorTiers: [
      { from: 10, off: 0.0054 },
      { from: 20, off: 0.008 },
      { from: 50, off: 0.0161 },
    ],
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
    vendorPremium: 0.05, // Godot & Fils, 18/11/2026 : 2 348 € pour 2 236,16 € d'or
    vendorTiers: [
      { from: 10, off: 0.0027 },
      { from: 20, off: 0.0054 },
      { from: 50, off: 0.0105 },
    ],
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
    vendorPremium: 0.0401, // Godot & Fils, 18/11/2026 : 3 620 € pour 3 477,62 € d'or
    vendorTiers: [
      { from: 10, off: 0.0027 },
      { from: 20, off: 0.0053 },
      { from: 50, off: 0.0105 },
    ],
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
    premium: 0.075,
    vendorPremium: 0.0485, // Godot & Fils, 18/11/2026 : prime affichée par le revendeur
    // Mêmes paliers que les autres formats (10, 20, 50 pièces). Le revendeur en a deux de plus à 100 et 500 pièces,
    // non repris ici : 0,39 point dès 100 et 0,69 point dès 500.
    vendorTiers: [
      { from: 10, off: 0.0015 },
      { from: 20, off: 0.0015 },
      { from: 50, off: 0.0023 },
    ],
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
  /** Part de la remise de quantité du revendeur reversée au client (le reste améliore la marge d'Orvia). */
  clientDiscountShare: 0.5,
  /** Livraison payée au vendeur, par commande (relevé du 18/11/2026). */
  vendorDelivery: 7,
  /** TVA due à la sortie du port franc pour l'argent et le platine (l'or d'investissement en est exonéré). */
  vatSilverPlatinum: 0.2,
  /** Délai de livraison constaté, en jours réels. */
  delayDays: '8',
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
  /** Livraison payée au vendeur par palier de valeur de commande (le premier palier commence à 0 €). */
  vendorDeliveryTiers: { fromEur: number; cost: number }[];
  freeFromGrams: number;
  /** Remises de quantité du revendeur, par produit. */
  vendorTiers: Record<string, { from: number; off: number }[]>;
}

/** Les tranches de quantité d'une commande, les mêmes pour tous les lingotins et pièces. */
export const QTY_RANGES = [
  { from: 1, to: 9, label: '1 à 9' },
  { from: 10, to: 19, label: '10 à 19' },
  { from: 20, to: 49, label: '20 à 49' },
  { from: 50, to: null, label: '50 et plus' },
] as const;

/** Paliers triés, sans doublon, dont le premier commence à 0 € ; à défaut, un seul palier au coût fixe. */
export function normalizeDeliveryTiers(
  raw: { fromEur: number; cost: number }[] | undefined,
  flat: number,
): { fromEur: number; cost: number }[] {
  const clean = (raw ?? [])
    .filter((t) => Number.isFinite(t.fromEur) && Number.isFinite(t.cost) && t.fromEur >= 0 && t.cost >= 0)
    .sort((a, b) => a.fromEur - b.fromEur)
    .filter((t, i, all) => i === 0 || t.fromEur !== all[i - 1].fromEur);
  if (!clean.length) return [{ fromEur: 0, cost: flat }];
  return clean[0].fromEur > 0 ? [{ fromEur: 0, cost: clean[0].cost }, ...clean] : clean;
}

/** Livraison payée au vendeur pour une commande de cette valeur (en euros) : le dernier palier atteint. */
export function vendorDeliveryCost(goodsEur: number, fees: Pick<PhysicalFees, 'vendorDeliveryTiers'>): number {
  let cost = fees.vendorDeliveryTiers[0].cost;
  for (const t of fees.vendorDeliveryTiers) if (goodsEur >= t.fromEur) cost = t.cost;
  return cost;
}

export function physicalFeesOf(settings?: Pick<Settings, 'physicalFees'>): PhysicalFees {
  const s = settings?.physicalFees ?? {};
  const premiums: Record<string, number> = {};
  const vendor: Record<string, number> = {};
  const vendorTiers: Record<string, { from: number; off: number }[]> = {};
  for (const p of BAR_PRODUCTS) {
    premiums[p.id] = s.premiums?.[p.id] ?? p.premium;
    const v = s.vendor?.[p.id] ?? p.vendorPremium;
    if (v !== undefined) vendor[p.id] = v;
    vendorTiers[p.id] = s.vendorTiers?.[p.id] ?? p.vendorTiers ?? [];
  }
  const flat = s.vendorDelivery ?? PHYSICAL.vendorDelivery;
  const tiers = normalizeDeliveryTiers(s.vendorDeliveryTiers, flat);
  return {
    premiums,
    vendor,
    delivery: s.delivery ?? PHYSICAL.delivery,
    vendorDelivery: tiers[0].cost,
    vendorDeliveryTiers: tiers,
    vendorTiers,
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
    { label: 'Remise de quantité', orvia: 'Fabrication dégressive dès 10 pièces du même format' },
    { label: 'Argent et platine', orvia: 'Non retirables (20 % de TVA)' },
  ];
}

export function productOf(id: string): BarProduct {
  const p = BAR_PRODUCTS.find((x) => x.id === id);
  if (!p) throw new LedgerError('Produit inconnu.');
  return p;
}

/** Baisse de prime accordée par le revendeur pour `qty` pièces du même produit (0 sans palier atteint). */
export function vendorTierOff(p: Pick<BarProduct, 'vendorTiers'>, qty: number): number {
  let off = 0;
  for (const t of p.vendorTiers ?? []) if (qty >= t.from) off = Math.max(off, t.off);
  return off;
}

/** Détail chiffré d'un retrait : grammes pris au coffre, surcoût de fabrication, livraison. */
export function quoteWithdrawal(
  prices: Prices,
  order: BarOrder,
  fees: PhysicalFees = physicalFeesOf(),
  /** Retrait en agence du revendeur : pas de livraison, ni facturée au client ni payée au revendeur. */
  pickup = false,
) {
  const pieces = BAR_PRODUCTS.reduce((s, p) => s + Math.max(0, Math.floor(order[p.id] ?? 0)), 0);
  const lines = BAR_PRODUCTS.filter((p) => (order[p.id] ?? 0) > 0).map((p) => {
    const qty = Math.floor(order[p.id]);
    const value = qty * p.grams * prices.gold;
    const v = fees.vendor[p.id];
    // Remise de quantité du revendeur sur ce produit : un coût en moins pour Orvia, le prix client ne change pas.
    const applied = v !== undefined ? Math.min(v, vendorTierOff({ vendorTiers: fees.vendorTiers[p.id] }, qty)) : 0;
    return {
      product: p,
      qty,
      grams: qty * p.grams,
      value,
      premium: value * (fees.premiums[p.id] ?? p.premium) - value * applied * PHYSICAL.clientDiscountShare,
      clientDiscount: value * applied * PHYSICAL.clientDiscountShare,
      vendorCost: v === undefined ? undefined : value * (v - applied),
      vendorDiscount: value * applied,
    };
  });
  const grams = lines.reduce((s, l) => s + l.grams, 0);
  const value = lines.reduce((s, l) => s + l.value, 0);
  // Valeur de la commande chez le revendeur : l'or et sa prime. Elle fixe le coût de la livraison payée au vendeur.
  const goodsEur = lines.reduce((s, l) => s + l.value + (l.vendorCost ?? 0), 0);
  const premium = lines.reduce((s, l) => s + l.premium, 0);
  const vendorDiscount = lines.reduce((s, l) => s + l.vendorDiscount, 0);
  const clientDiscount = lines.reduce((s, l) => s + l.clientDiscount, 0);
  const delivery = pickup || !lines.length || grams >= fees.freeFromGrams - 1e-9 ? 0 : fees.delivery;
  const total = Math.round((premium + delivery) * 100) / 100;
  // Coût pour Orvia : lingotins payés au vendeur (si toutes les primes sont connues) et sa livraison, par commande.
  const cost =
    lines.length && lines.every((l) => l.vendorCost !== undefined)
      ? lines.reduce((s, l) => s + (l.vendorCost ?? 0), 0) + (pickup ? 0 : vendorDeliveryCost(goodsEur, fees))
      : undefined;
  return {
    lines,
    grams,
    value,
    premium,
    delivery,
    pickup,
    fees: total,
    feesPct: value ? total / value : 0,
    cost,
    pieces,
    volume: vendorDiscount > 0,
    vendorDiscount: Math.round(vendorDiscount * 100) / 100,
    /** Part de cette remise reversée au client : déjà déduite de `premium`. */
    clientDiscount: Math.round(clientDiscount * 100) / 100,
  };
}

/**
 * Retire de l'or en lingotins. Les grammes sortent du coffre ; le surcoût et la livraison sont payés depuis le compte
 * d'attente (payer en or serait une vente, donc imposée). Chaque lingotin entre au registre du coffre maison avec
 * les dates et le prix d'achat d'origine du métal (premier entré, premier sorti).
 */
export function withdrawPhysical(
  account: Account,
  prices: Prices,
  order: BarOrder,
  now = new Date(),
  /** Agence du revendeur où le client retire ses lingotins (sinon livraison à domicile). */
  pickupAgency?: string,
  /** Garde en coffre sécurisé chez le revendeur : ni livraison ni retrait, le lingotin reste au nom du client. */
  vault = false,
): Account {
  const agency = pickupAgency?.trim();
  if (pickupAgency !== undefined && agency!.length < 2) throw new LedgerError('Indiquez l’agence de retrait (ville).');
  const q = quoteWithdrawal(prices, order, physicalFeesOf(account.settings), pickupAgency !== undefined || vault);
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
  const label = `Retrait physique${agency ? ` en agence (${agency})` : ''}${vault ? ' gardé en coffre chez Godot & Fils' : ''} · ${q.lines.map((l) => `${l.qty} × ${l.product.label.toLowerCase()}`).join(', ')}`;
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
        ...(agency ? { pickupAgency: agency } : {}),
        ...(vault ? { vault: true, place: 'autre' as const, placeNote: CHILD_STORAGE_NOTE } : {}),
      });
    }
  }
  // Sortie du stock : d'abord ce que la société a chez elle, puis le coffre professionnel, sinon commande.
  const usedRefs = new Set<string>([
    ...(account.homeVault ?? []).flatMap((b) => (b.ref ? [b.ref] : [])),
    ...(account.stock ?? []).flatMap((l) => l.refs ?? []),
  ]);
  let stockLots = [...(account.stock ?? [])];
  const moves: StockMove[] = [];
  for (const bar of bars) {
    const lot =
      stockLots.find((l) => l.product === bar.product && l.source === 'maison' && l.qty > 0) ??
      stockLots.find((l) => l.product === bar.product && l.source === 'pro' && l.qty > 0);
    if (!lot) {
      bar.origin = 'commande';
      bar.ref = newRef(usedRefs);
      continue;
    }
    const [serial, ...restSerials] = lot.serials ?? [];
    const [ref, ...restRefs] = lot.refs ?? [];
    bar.ref = ref ?? newRef(usedRefs);
    bar.origin = lot.source;
    bar.lotId = lot.id;
    if (serial) bar.expectedSerial = serial;
    stockLots = stockLots.map((l) =>
      l.id === lot.id
        ? { ...l, qty: l.qty - 1, ...(serial ? { serials: restSerials } : {}), ...(ref ? { refs: restRefs } : {}) }
        : l,
    );
    const last = moves[moves.length - 1];
    if (last && last.lotId === lot.id) last.qty -= 1;
    else {
      moves.push({
        id: newId(),
        date: now.toISOString(),
        kind: 'out',
        product: bar.product,
        qty: -1,
        source: lot.source,
        lotId: lot.id,
        note: `Retrait client · ${label}`,
      });
    }
  }
  next = {
    ...next,
    ...(moves.length ? { stock: stockLots, stockLog: [...moves, ...(account.stockLog ?? [])].slice(0, 500) } : {}),
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

/**
 * Don d'un lingotin ou d'une pièce à un enfant. L'objet reste où il est (chez le parent, ou dans un coffre en banque) : seule la propriété (son numéro)
 * est cédée à l'enfant. Le don est inscrit à la valeur de l'or du jour dans les dons de l'enfant (formulaire 2735,
 * abattement de 100 000 €) ; l'enfant garde les dates d'achat d'origine de l'or (22 ans).
 */
export function giveBarToChild(
  account: Account,
  prices: Prices,
  barId: string,
  childId: string,
  now = new Date(),
  where?: { place: BarPlace; note?: string },
): Account {
  const bar = (account.homeVault ?? []).find((b) => b.id === barId);
  if (!bar) throw new LedgerError('Lingotin introuvable.');
  if (bar.ownerChildId) throw new LedgerError('Ce lingotin appartient déjà à un enfant.');
  if (bar.status !== 'received' || !bar.serial) {
    throw new LedgerError(
      'Le lingotin doit être reçu, avec son numéro noté, avant d’être donné : c’est ce numéro qui est cédé.',
    );
  }
  const child = getChild(account, childId);
  if (child.transferredAt) throw new LedgerError(`Le compte de ${child.name} lui a été transféré.`);
  if (child.birthDate && majorityDate(child.birthDate).getTime() <= now.getTime()) {
    throw new LedgerError(`${child.name} est majeur : un don à un majeur se fait autrement.`);
  }
  const p = productOf(bar.product);
  const value = bar.grams * prices.gold;
  const label = `Don du ${p.label.replace(/ \(.*/, '').toLowerCase()} · ${p.coin ? 'millésime' : 'n°'} ${bar.serial} (gardé : ${placeLabel(where ? { place: where.place, placeNote: where.note } : bar).toLowerCase()})`;
  const credited = applyTx(child, 'gift_bar', {}, value, label, now);
  const parent = replaceChildAccount(account, credited);
  const placed = where ? setBarPlace(parent, barId, where.place, where.note) : parent;
  return {
    ...placed,
    homeVault: (placed.homeVault ?? []).map((b) =>
      b.id === barId
        ? { ...b, ownerChildId: childId, giftedAt: now.toISOString(), giftValue: Math.round(value * 100) / 100 }
        : b,
    ),
  };
}

export type BarPlace = NonNullable<HomeBar['place']>;
export const PLACE_LABEL: Record<BarPlace, string> = {
  maison: 'Chez vous',
  banque: 'Coffre en banque',
  autre: 'Autre lieu',
};

/** Lieu où est gardé l'objet, en clair : « Chez vous », « Coffre en banque · Crédit X »… */
export function placeLabel(b: Pick<HomeBar, 'place' | 'placeNote'>): string {
  const base = PLACE_LABEL[b.place ?? 'maison'];
  const note = b.placeNote?.trim();
  if (!note) return base;
  return b.place === 'autre' ? note : `${base} · ${note}`;
}

/** Change le lieu de garde d'un lingotin ou d'une pièce (chez vous, coffre en banque, ailleurs). */
export function setBarPlace(
  account: Account,
  barId: string,
  place: BarPlace,
  note?: string,
  now = new Date(),
): Account {
  const found = (account.homeVault ?? []).find((b) => b.id === barId);
  if (!found) throw new LedgerError('Lingotin introuvable.');
  if (isLocked(found, now) && (place !== (found.place ?? 'maison') || (note ?? '') !== (found.placeNote ?? ''))) {
    throw new LedgerError('Sécurité maximale : ce lingotin ne peut pas être déplacé avant la majorité de l’enfant.');
  }
  const clean = note?.trim().slice(0, 80);
  return {
    ...account,
    homeVault: (account.homeVault ?? []).map((b) => {
      if (b.id !== barId) return b;
      const { placeNote: _old, ...rest } = b;
      return { ...rest, place, ...(clean ? { placeNote: clean } : {}) };
    }),
  };
}

/** Un lingotin en sécurité maximale est verrouillé jusqu'à la majorité de l'enfant. */
export function isLocked(bar: Pick<HomeBar, 'lockedUntil'>, now = new Date()): boolean {
  return !!bar.lockedUntil && now.getTime() < new Date(bar.lockedUntil).getTime();
}

export const CHILD_STORAGE_NOTE = 'Godot & Fils, stockage sécurisé';

/**
 * Convertit de l'or du compte d'un enfant en lingotins ou pièces, au nom de l'enfant et gardés uniquement chez le
 * revendeur (jamais livrés). Les grammes sortent de l'or de l'enfant ; seule la fabrication est payée, par le parent,
 * depuis son compte d'attente (jamais sur l'or de l'enfant). En « sécurité maximale », le lingotin est verrouillé
 * jusqu'à la majorité de l'enfant : pas de déplacement, ni de vente.
 */
export function convertChildToBars(
  account: Account,
  prices: Prices,
  childId: string,
  order: BarOrder,
  lock: boolean,
  now = new Date(),
): Account {
  const child = getChild(account, childId);
  if (child.transferredAt) throw new LedgerError(`Le compte de ${child.name} lui a été transféré.`);
  const majority = child.birthDate ? majorityDate(child.birthDate) : null;
  if (majority && majority.getTime() <= now.getTime()) {
    throw new LedgerError(`${child.name} est majeur : son compte lui est transféré.`);
  }
  if (lock && !majority) {
    throw new LedgerError('La sécurité maximale demande la date de naissance de l’enfant : renseignez-la d’abord.');
  }
  const q = quoteWithdrawal(prices, order, physicalFeesOf(account.settings));
  if (!q.lines.length) throw new LedgerError('Choisissez au moins un lingotin.');
  if (q.grams > child.holdings.gold + 1e-9) {
    throw new LedgerError(
      `Or insuffisant sur le compte de ${child.name} : ${child.holdings.gold.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} g disponibles.`,
    );
  }
  // Gardé chez le revendeur, jamais livré : seule la fabrication est payée (pas de livraison).
  const fee = Math.round(q.premium * 100) / 100;
  const cash = account.cashEur ?? 0;
  if (fee > cash + 0.005) {
    throw new LedgerError(
      `Fabrication de ${fee.toFixed(2).replace('.', ',')} € à payer depuis votre compte d’attente (${cash.toFixed(2).replace('.', ',')} € disponibles) : créditez-le d’abord.`,
    );
  }
  const lots = holdingLots(child).gold.map((l) => ({ ...l }));
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
  const names = q.lines.map((l) => `${l.qty} × ${l.product.label.replace(/ \(.*/, '').toLowerCase()}`).join(', ');
  const childTx = applyTx(
    child,
    'withdraw_physical',
    { gold: -q.grams },
    q.value,
    `Lingotin(s) au nom de ${child.name} · ${names}${lock ? ' · sécurité maximale' : ''}`,
    now,
  );
  const txId = childTx.transactions[0].id;
  const usedRefs = new Set<string>((account.homeVault ?? []).flatMap((b) => (b.ref ? [b.ref] : [])));
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
        txId,
        origin: 'commande',
        ref: newRef(usedRefs),
        ownerChildId: child.id,
        giftedAt: now.toISOString(),
        giftValue: Math.round(l.product.grams * prices.gold * 100) / 100,
        place: 'autre',
        placeNote: CHILD_STORAGE_NOTE,
        vault: true,
        ...(lock && majority ? { lockedUntil: majority.toISOString() } : {}),
      });
    }
  }
  let parent = replaceChildAccount(account, childTx);
  if (fee > 0) {
    parent = applyTx(parent, 'cash_out', {}, fee, `Fabrication des lingotins de ${child.name} (offerte)`, now);
    const [tx, ...rest] = parent.transactions;
    parent = {
      ...parent,
      cashEur: Math.round((cash - fee) * 100) / 100,
      transactions: [{ ...tx, cash: -fee }, ...rest],
    };
  }
  return { ...parent, homeVault: [...(parent.homeVault ?? []), ...bars] };
}

/** Lingotins et pièces qui appartiennent à un enfant (gardés chez le parent). */
export function barsOfChild(account: Pick<Account, 'homeVault'>, childId: string): HomeBar[] {
  return (account.homeVault ?? []).filter((b) => b.ownerChildId === childId);
}

/** Lingotin revendu ou donné en dehors d'Orvia : on le retire du registre. */
export function removeBar(account: Account, barId: string): Account {
  const owned = (account.homeVault ?? []).find((b) => b.id === barId)?.ownerChildId;
  if (owned) throw new LedgerError('Ce lingotin appartient à un enfant : il ne peut pas être retiré du registre.');
  return { ...account, homeVault: (account.homeVault ?? []).filter((b) => b.id !== barId) };
}

/** Total du coffre maison, valeur au cours de l'or (revente indicative, hors frais du comptoir). */
export function homeVaultTotal(account: Pick<Account, 'homeVault'>, prices: Prices) {
  // Les lingotins donnés à un enfant restent chez vous mais ne sont plus à vous.
  const bars = (account.homeVault ?? []).filter((b) => !b.ownerChildId);
  const grams = bars.reduce((s, b) => s + b.grams, 0);
  return { count: bars.length, grams, value: grams * prices.gold, cost: bars.reduce((s, b) => s + b.cost, 0) };
}

/** Coût d'un retrait d'argent ou de platine s'il était proposé : la TVA à la sortie, en euros. */
export function vatIfWithdrawn(value: number): number {
  return value * PHYSICAL.vatSilverPlatinum;
}

/**
 * Prime du vendeur en % de la valeur de l'or, d'après sa page de prix.
 * Avec les frais en euros : frais ÷ (prix − frais). Sans eux : prix ÷ valeur de l'or − 1.
 * Le prix s'entend livraison comprise dans le pays, hors frais de port. Renvoie null si le calcul est impossible.
 */
export function vendorPremiumFrom(price: number, fees: number | null, metalValue: number): number | null {
  if (!(price > 0)) return null;
  let rate: number;
  if (fees !== null && Number.isFinite(fees)) {
    if (fees < 0 || fees >= price) return null;
    rate = fees / (price - fees);
  } else {
    if (!(metalValue > 0)) return null;
    rate = price / metalValue - 1;
  }
  return Number.isFinite(rate) && rate >= -0.5 && rate <= 0.5 ? rate : null;
}

/** Jours réels (calendaires) écoulés entre deux dates, en jours entiers. */
function daysBetween(from: Date, to: Date): number {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((end.getTime() - d.getTime()) / 86400000));
}

export const FABRICATION_STEPS = ['Commandé', 'En fabrication', 'En route', 'Arrivé'] as const;

/**
 * Avancement estimé d'un lingotin commandé, d'après les jours réels écoulés (aucun suivi réel du revendeur) : commandé
 * le premier jour, en fabrication jusqu'au 3e jour, en route jusqu'au 7e, arrivé au bout de 8 jours.
 * En retrait en agence, la dernière étape est « Prêt en agence ».
 */
export const FABRICATION_DAYS = 8;

export function fabricationProgress(orderedAt: string, now = new Date(), pickup = false, vault = false) {
  const days = daysBetween(new Date(orderedAt), now);
  const step = days < 1 ? 0 : days < 4 ? 1 : days < FABRICATION_DAYS ? 2 : 3;
  const labels = vault
    ? ['Commandé', 'En fabrication', 'En route vers le coffre', 'Entré au coffre']
    : pickup
      ? ['Commandé', 'En fabrication', 'En route vers l’agence', 'Prêt en agence']
      : [...FABRICATION_STEPS];
  return { days, step, ratio: Math.min(1, days / FABRICATION_DAYS), label: labels[step], labels };
}

/**
 * Agences Godot & Fils relevées sur leurs sites (liste non exhaustive, adresses à confirmer avant de se déplacer).
 * Sans adresse : la ville figure sur leur réseau, mais l'adresse n'a pas été relevée.
 */
export const GODOT_AGENCIES: { name: string; address?: string }[] = [
  { name: 'Paris 2 (siège)', address: '26 rue Vivienne, 75002' },
  { name: 'Paris 5 (Panthéon)', address: '14 rue Soufflot, 75005' },
  { name: 'Paris 14', address: '33 avenue du Général Leclerc, 75014' },
  { name: 'Paris 15', address: '17 rue Cambronne, 75015' },
  { name: 'Aix-en-Provence', address: '33 rue Espariat, 13100' },
  { name: 'Albi', address: '21 rue Sainte-Cécile, 81000' },
  { name: 'Alès', address: '25 rue Taisson, 30100' },
  { name: 'Amiens', address: '11 rue Noyon, 80000' },
  { name: 'Angers', address: '5 rue d’Alsace, 49100' },
  { name: 'Arras' },
  { name: 'Baie-Mahault (Guadeloupe)', address: 'boulevard de Houelbourg' },
  { name: 'Beauvais', address: '32 place Jeanne Hachette' },
  { name: 'Blois', address: '78 rue du Commerce' },
  { name: 'Bourges', address: '21 rue Moyenne' },
  { name: 'Caen', address: '18 rue Saint-Jean' },
  { name: 'Chartres', address: '23 rue de la Pie' },
  { name: 'Colmar', address: '7 place de l’École, 68000' },
  { name: 'Courbevoie' },
  { name: 'Gustavia (Saint-Barthélemy)', address: '4 rue du Bord de Mer' },
  { name: 'Hyères' },
  { name: 'Le Havre', address: '73/75 boulevard de Strasbourg' },
  { name: 'Lille Flandres', address: '48 rue Faidherbe, 59800' },
  { name: 'Lille Gambetta', address: '116 rue Léon Gambetta, 59000' },
  { name: 'Marseille Saint-Ferréol' },
  { name: 'Nantes', address: '22 rue des Halles, 44000' },
  { name: 'Orléans', address: '6 rue de la République' },
  { name: 'Perpignan' },
  { name: 'Poitiers', address: '21 rue du Marché Notre Dame, 86000' },
  { name: 'Rouen', address: '13 rue Jeanne d’Arc' },
  { name: 'Saint-Quentin', address: '16 rue des Toiles' },
  { name: 'Toulouse Centre' },
  { name: 'Tours', address: '11 rue Néricault Destouches' },
  { name: 'Valenciennes', address: '74 ter rue du Quesnoy' },
  { name: 'Versailles (États-Généraux)', address: '8 rue des États-Généraux, 78000' },
  { name: 'Versailles (Saint-Cloud)', address: '26 avenue de Saint-Cloud, 78000' },
];

/** Libellé d'une agence, tel qu'il est noté sur le retrait : « Nantes · 22 rue des Halles, 44000 ». */
export const agencyLabel = (a: { name: string; address?: string }) => (a.address ? `${a.name} · ${a.address}` : a.name);

/**
 * Demande de sortie d'un lingotin gardé en coffre chez Godot & Fils : livraison à domicile (12 € par envoi, offerte dès
 * 20 g) ou retrait gratuit en agence. Les frais éventuels sont payés depuis le compte d'attente. Impossible pour un
 * lingotin d'enfant (jamais livré) ou verrouillé.
 */
export function requestVaultExit(
  account: Account,
  barId: string,
  mode: 'home' | 'agency',
  agency?: string,
  now = new Date(),
): Account {
  const bar = (account.homeVault ?? []).find((b) => b.id === barId);
  if (!bar) throw new LedgerError('Lingotin introuvable.');
  if (!bar.vault) throw new LedgerError('Ce lingotin n’est pas gardé en coffre.');
  if (bar.ownerChildId) throw new LedgerError('Le lingotin d’un enfant reste au coffre : il n’est jamais livré.');
  if (isLocked(bar, now))
    throw new LedgerError('Sécurité maximale : ce lingotin ne peut pas sortir avant la majorité.');
  if (bar.status !== 'received') throw new LedgerError('Le lingotin n’est pas encore entré au coffre.');
  if (bar.exitRequest) throw new LedgerError('Un retrait est déjà demandé pour ce lingotin.');
  const place = agency?.trim();
  if (mode === 'agency' && (!place || place.length < 2)) throw new LedgerError('Indiquez l’agence de retrait.');
  const fees = physicalFeesOf(account.settings);
  const fee = mode === 'home' && bar.grams < fees.freeFromGrams - 1e-9 ? fees.delivery : 0;
  const cash = account.cashEur ?? 0;
  if (fee > cash + 0.005) {
    throw new LedgerError(
      `Livraison de ${fee.toFixed(2).replace('.', ',')} € à payer depuis le compte d’attente (${cash.toFixed(2).replace('.', ',')} € disponibles) : créditez-le d’abord.`,
    );
  }
  let next = account;
  if (fee > 0) {
    next = applyTx(next, 'cash_out', {}, fee, `Sortie du coffre · ${productOf(bar.product).label} · livraison`, now);
    const [tx, ...rest] = next.transactions;
    next = {
      ...next,
      cashEur: Math.round((cash - fee) * 100) / 100,
      transactions: [{ ...tx, cash: -fee }, ...rest],
    };
  }
  return {
    ...next,
    homeVault: (next.homeVault ?? []).map((b) =>
      b.id === barId
        ? { ...b, exitRequest: { mode, ...(mode === 'agency' ? { agency: place } : {}), at: now.toISOString() } }
        : b,
    ),
  };
}

/** Le lingotin sorti du coffre est en main : il passe chez le client, hors du coffre de Godot & Fils. */
export function confirmVaultExit(account: Account, barId: string, now = new Date()): Account {
  const bar = (account.homeVault ?? []).find((b) => b.id === barId);
  if (!bar?.exitRequest) throw new LedgerError('Aucun retrait demandé pour ce lingotin.');
  return {
    ...account,
    homeVault: (account.homeVault ?? []).map((b) => {
      if (b.id !== barId) return b;
      const { exitRequest: _e, placeNote: _n, vault: _v, ...rest } = b;
      return { ...rest, place: 'maison' as const, exitedAt: now.toISOString() };
    }),
  };
}
