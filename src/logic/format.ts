import { METAL_OF, TROY_OUNCE as TROY_OUNCE } from './ledger.ts';
import type { Metal, WeightUnit } from './types.ts';

const eurFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export function formatEur(n: number): string {
  return eurFormatter.format(n);
}

function decimalsFor(abs: number): number {
  return abs >= 100 ? 2 : abs >= 1 ? 3 : 4;
}

function formatEcus(n: number): string {
  const text = n.toFixed(Math.abs(n) >= 100 ? 2 : 3).replace('.', ',');
  return `${text} jeton${Math.abs(n) >= 2 ? 's' : ''}`;
}

/** Formate un poids donné en grammes, dans l'unité choisie ; pour l'Écu Orvia, un nombre d'écus. */
export function formatWeight(grams: number, unit: WeightUnit = 'g', metal?: Metal): string {
  if (metal === 'ecu') return formatEcus(grams);
  const value = unit === 'oz' ? grams / TROY_OUNCE : grams;
  const text = value.toFixed(decimalsFor(Math.abs(value))).replace('.', ',');
  return `${text} ${unit === 'oz' ? 'oz' : 'g'}`;
}

/** Variation de poids avec son signe. */
export function formatWeightDelta(grams: number, unit: WeightUnit = 'g', metal?: Metal): string {
  return `${grams > 0 ? '+' : grams < 0 ? '−' : ''}${formatWeight(Math.abs(grams), unit, metal)}`;
}

/** « 2,500 g de Gold Spot », « 3,000 jetons Gold Oria ». */
export function formatQty(metal: Metal, grams: number, unit: WeightUnit = 'g'): string {
  return metal === 'ecu' ? `${formatEcus(grams)} Gold Oria` : `${formatWeight(grams, unit)} ${METAL_OF[metal]}`;
}

/** Prix par unité de poids (€/g ou €/oz). */
export function formatUnitPrice(eurPerGram: number, unit: WeightUnit = 'g', metal?: Metal): string {
  if (metal === 'ecu') return `${formatEur(eurPerGram)}/jeton`;
  return `${formatEur(unit === 'oz' ? eurPerGram * TROY_OUNCE : eurPerGram)}/${unit}`;
}

export function formatPercent(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2).replace('.', ',')}\u00a0%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimeWithSeconds(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** Lit un nombre tapé à la française (« 12,5 »). */
export function parseAmount(text: string): number {
  if (!text.trim()) return Number.NaN;
  return Number(text.replace(/\s/g, '').replace(',', '.'));
}
