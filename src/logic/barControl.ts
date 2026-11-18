/**
 * Contrôle des lingotins et pièces du coffre maison (base interne, Société Orvia) : contrôle à la réception, poids de
 * référence, recontrôle par pesée. La base est remplie par le titulaire : elle prouve qu'un objet est le même qu'à la
 * réception, pas qu'il était authentique au départ (pour cela : VERISCAN de l'affinerie et carte d'essai).
 */
import { LedgerError } from './ledger.ts';
import { normalizeSerial, placeLabel, productOf, serialFormatError } from './physical.ts';
import type { Account, BarCheck, HomeBar } from './types.ts';

/**
 * Marges par défaut : balance au centigramme (±0,01 g) et pied à coulisse (±0,2 mm). Un lingot de fondeur-affineur reconnu
 * (LBMA) pèse entre son poids nominal et quelques milligrammes de plus : sous le poids nominal (moins la marge de la
 * balance), il est refusé.
 */
export const DEFAULT_TOLERANCE = { weightG: 0.01, dimMm: 0.2 } as const;
/** Un lingot plus lourd que prévu de plus que cela est suspect (autre métal, mauvais format). */
export const BAR_MAX_OVERWEIGHT_G = 0.05;
export type Tolerance = { weightG: number; dimMm: number };

/** Poids brut d'un Napoléon 20 F : 6,45 g (la pièce usée pèse un peu moins). */
export const NAPOLEON_GROSS_GRAMS = 6.45;
/** 20 F or : poids légal 6,45161 g, tolérance de frappe ±2 ‰ (soit au plus 6,4645 g) ; usure (frai) jusqu'à 0,5 %. */
export const NAPOLEON_MAX_G = 6.4645;
export const NAPOLEON_MIN_G = 6.4194;
/** Une pièce ancienne s'use : marge de pesée au moins de 0,1 g. */
const COIN_MIN_WEIGHT_TOL = 0.1;

export const toleranceOf = (account: Pick<Account, 'settings'>): Tolerance => ({
  ...DEFAULT_TOLERANCE,
  ...(account.settings.barTolerance ?? {}),
});

/** Poids attendu d'un objet : l'or d'un lingot (999,9) ; le poids brut d'une pièce. */
export const expectedWeight = (bar: HomeBar): number =>
  productOf(bar.product).coin ? NAPOLEON_GROSS_GRAMS : bar.grams;

const norm = (s: string) => s.replace(/[\s\-_.]/g, '').toUpperCase();
const num = (n: number | undefined) => typeof n === 'number' && Number.isFinite(n);
const g = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 3 });

export interface ControlInput {
  sealed: boolean;
  serialBar: string;
  /** Numéro de la carte d'essai (lingots seulement). */
  serialCard?: string;
  weight: number;
  length?: number;
  width?: number;
  thickness?: number;
  diameter?: number;
  /** Contrôle VERISCAN fait avec l'application de PAMP, conforme. */
  veriscan?: boolean;
  /** Lingotin sous blister scellé, non ouvert : pesée avec la carte (indicative), dimensions non mesurées. */
  blister?: boolean;
}

/** Poids habituel d'une carte CertiPAMP : environ 5 à 7 g, sans norme officielle. */
export const BLISTER_GRAMS = { min: 4, max: 8 } as const;

export interface CheckLine {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

/** Les vérifications d'un contrôle de réception, avec leur résultat. */
export function evaluateControl(bar: HomeBar, input: ControlInput, tol: Tolerance): CheckLine[] {
  const p = productOf(bar.product);
  const lines: CheckLine[] = [];
  lines.push({
    key: 'seal',
    label: 'Emballage et scellé intacts',
    ok: input.sealed,
    detail: input.sealed ? 'Intact' : 'À cocher après vérification',
  });
  const sb = norm(input.serialBar);
  if (p.coin) {
    lines.push({
      key: 'serial',
      label: 'Millésime noté',
      ok: sb.length >= 3,
      detail: sb.length >= 3 ? input.serialBar.trim() : 'Indiquez le millésime',
    });
  } else {
    const sc = norm(input.serialCard ?? '');
    const same = sb.length >= 3 && sb === sc;
    const fmtError = serialFormatError(bar.product, input.serialBar);
    if (p.spec?.producer === 'PAMP Suisse') {
      lines.push({
        key: 'format',
        label: 'Format du numéro (C + 6 chiffres)',
        ok: !fmtError,
        detail: fmtError ?? 'Conforme au format PAMP',
      });
    }
    lines.push({
      key: 'serial',
      label: 'N° gravé = Certificate Number de la carte',
      ok: same,
      detail:
        !sb || !sc
          ? 'Indiquez les deux numéros'
          : same
            ? 'Identiques'
            : `Différents : ${input.serialBar.trim()} / ${input.serialCard?.trim()}`,
    });
  }
  const expected = expectedWeight(bar);
  if (input.blister && !p.coin) {
    // Sous blister : on ne verdicte pas la pesée (le poids de la carte n'est pas normé), on la garde comme référence.
    const w = input.weight;
    const usual = w >= expected + BLISTER_GRAMS.min && w <= expected + BLISTER_GRAMS.max;
    lines.push({
      key: 'weight',
      label: 'Pesée avec blister (indicative)',
      ok: num(w) && w >= expected,
      detail: !num(w)
        ? 'Indiquez le poids mesuré'
        : w < expected
          ? `${g(w)} g : moins que le lingotin seul (${g(expected)} g)`
          : `${g(w)} g avec la carte${usual ? '' : ' · hors de l’ordre habituel (carte de 5 à 7 g, sans norme officielle)'}`,
    });
    if (p.spec?.veriscan) {
      lines.push({
        key: 'veriscan',
        label: 'VERISCAN fait avec l’appli PAMP',
        ok: !!input.veriscan,
        detail: input.veriscan ? 'Conforme' : 'À cocher après le scan',
      });
    }
    return lines;
  }
  const wTol = p.coin ? Math.max(tol.weightG, COIN_MIN_WEIGHT_TOL) : tol.weightG;
  if (num(input.weight)) {
    const d = input.weight - expected;
    // Lingot : jamais sous le poids nominal (à la marge de la balance près). Pièce usée : marge des deux côtés.
    const ok = p.coin
      ? input.weight >= NAPOLEON_MIN_G - tol.weightG - 1e-9 && input.weight <= NAPOLEON_MAX_G + tol.weightG + 1e-9
      : d >= -wTol - 1e-9 && d <= Math.max(wTol, BAR_MAX_OVERWEIGHT_G) + 1e-9;
    lines.push({
      key: 'weight',
      label: 'Pesée',
      ok,
      detail: p.coin
        ? `${g(input.weight)} g · attendu de ${g(NAPOLEON_MIN_G)} g (usure de 0,5 %) à ${g(NAPOLEON_MAX_G)} g (poids légal ${g(6.4516)} g ±2 ‰), balance ±${g(tol.weightG)} g`
        : `${g(input.weight)} g · au moins ${g(expected)} g (balance −${g(wTol)} g) · écart ${d >= 0 ? '+' : '−'}${g(Math.abs(d))} g`,
    });
  } else {
    lines.push({ key: 'weight', label: 'Pesée', ok: false, detail: 'Indiquez le poids mesuré' });
  }
  const spec = p.spec;
  const dims: [string, number | undefined, number | undefined][] = spec?.diameterMm
    ? [['diamètre', input.diameter, spec.diameterMm]]
    : [
        ['longueur', input.length, spec?.lengthMm],
        ['largeur', input.width, spec?.widthMm],
        ['épaisseur', input.thickness, spec?.thicknessMm],
      ];
  const known = dims.filter(([, , exp]) => num(exp));
  if (known.length) {
    const bad: string[] = [];
    let missing = false;
    for (const [name, got, exp] of known) {
      if (!num(got)) missing = true;
      else if (Math.abs((got as number) - (exp as number)) > tol.dimMm + 1e-9)
        bad.push(`${name} ${g(got as number)} mm (attendu ${g(exp as number)})`);
    }
    lines.push({
      key: 'dims',
      label: 'Dimensions au pied à coulisse',
      ok: !missing && bad.length === 0,
      detail: missing
        ? 'Indiquez les dimensions mesurées'
        : bad.length
          ? bad.join(' · ')
          : `Conformes (marge ±${g(tol.dimMm)} mm)`,
    });
  }
  if (spec?.veriscan) {
    lines.push({
      key: 'veriscan',
      label: 'VERISCAN fait avec l’appli PAMP',
      ok: !!input.veriscan,
      detail: input.veriscan ? 'Conforme' : 'À cocher après le scan',
    });
  }
  return lines;
}

export type BarState = 'todo' | 'ok' | 'anomaly';

/** État d'un objet : à contrôler, conforme ou anomalie (d'après son dernier contrôle). */
export function barState(bar: HomeBar): BarState {
  const last = (bar.checks ?? []).at(-1);
  if (!last) return 'todo';
  return last.ok ? 'ok' : 'anomaly';
}

export const lastCheck = (bar: HomeBar): BarCheck | undefined => (bar.checks ?? []).at(-1);

/** Date du dernier contrôle conforme à la réception (affichée au client), sinon null. */
export function controlledOn(bar: HomeBar): string | null {
  if (barState(bar) !== 'ok') return null;
  return (bar.checks ?? []).find((c) => c.kind === 'reception')?.date ?? null;
}

export function barSummary(account: Pick<Account, 'homeVault'>) {
  const bars = account.homeVault ?? [];
  const states = bars.map(barState);
  return {
    total: bars.length,
    todo: states.filter((s) => s === 'todo').length,
    anomalies: states.filter((s) => s === 'anomaly').length,
  };
}

/** Recherche par numéro de série, référence interne ou lieu de garde (espaces, tirets et casse ignorés). */
export function searchBars(account: Pick<Account, 'homeVault'>, query: string): HomeBar[] {
  const q = norm(query);
  const bars = account.homeVault ?? [];
  return q
    ? bars.filter(
        (b) => norm(b.serial ?? '').includes(q) || norm(b.ref ?? '').includes(q) || norm(placeLabel(b)).includes(q),
      )
    : bars;
}

/** Numéros de série (hors pièces, dont les millésimes se répètent) présents plus d'une fois dans la base. */
export function duplicateSerials(account: Pick<Account, 'homeVault'>): string[] {
  const seen = new Map<string, number>();
  for (const b of account.homeVault ?? []) {
    if (!b.serial || productOf(b.product).coin) continue;
    seen.set(norm(b.serial), (seen.get(norm(b.serial)) ?? 0) + 1);
  }
  return [...seen].filter(([, n]) => n > 1).map(([s]) => s);
}

/** Un numéro de série est-il déjà pris par un autre lingot de la base ? */
export function serialTaken(account: Pick<Account, 'homeVault'>, serial: string, exceptId?: string): boolean {
  const s = norm(serial);
  return (account.homeVault ?? []).some(
    (b) => b.id !== exceptId && !productOf(b.product).coin && !!b.serial && norm(b.serial) === s,
  );
}

function update(account: Account, barId: string, fn: (b: HomeBar) => HomeBar): Account {
  if (!(account.homeVault ?? []).some((b) => b.id === barId)) throw new LedgerError('Lingotin introuvable.');
  return { ...account, homeVault: (account.homeVault ?? []).map((b) => (b.id === barId ? fn(b) : b)) };
}

/**
 * Enregistre le contrôle de réception : numéro de série, poids de référence, résultat. Un numéro de série déjà présent
 * dans la base est refusé. Un contrôle non conforme est enregistré comme anomalie (jamais effacé).
 */
export function recordControl(account: Account, barId: string, input: ControlInput, now = new Date()): Account {
  const bar = (account.homeVault ?? []).find((b) => b.id === barId);
  if (!bar) throw new LedgerError('Lingotin introuvable.');
  const p = productOf(bar.product);
  const serial = normalizeSerial(bar.product, input.serialBar);
  if (serial.length < 3) throw new LedgerError(p.coin ? 'Indiquez le millésime.' : 'Indiquez le numéro de série.');
  if (!p.coin && serialTaken(account, serial, barId)) {
    throw new LedgerError('Ce numéro de série est déjà dans la base pour un autre lingot.');
  }
  if (!num(input.weight) || input.weight <= 0) throw new LedgerError('Indiquez le poids mesuré.');
  const lines = evaluateControl(bar, input, toleranceOf(account));
  const failed = lines.filter((l) => !l.ok).map((l) => l.label);
  const check: BarCheck = {
    date: now.toISOString(),
    kind: 'reception',
    weight: input.weight,
    measures: { length: input.length, width: input.width, thickness: input.thickness, diameter: input.diameter },
    ok: failed.length === 0,
    ...(failed.length ? { failed } : {}),
    ...(input.blister && !p.coin ? { blister: true } : {}),
  };
  return update(account, barId, (b) => ({
    ...b,
    serial,
    status: 'received',
    receivedAt: b.receivedAt ?? now.toISOString(),
    weightRef: input.weight,
    ...(input.blister && !p.coin ? { weightRefBlister: true } : { weightRefBlister: undefined }),
    checks: [...(b.checks ?? []), check],
  }));
}

/** Recontrôle par pesée, comparée au poids de référence de la réception. */
export function recheckWeight(account: Account, barId: string, weight: number, now = new Date()): Account {
  const bar = (account.homeVault ?? []).find((b) => b.id === barId);
  if (!bar) throw new LedgerError('Lingotin introuvable.');
  if (bar.weightRef === undefined) throw new LedgerError('Faites d’abord le contrôle de réception.');
  if (!num(weight) || weight <= 0) throw new LedgerError('Indiquez le poids mesuré.');
  const tol = toleranceOf(account);
  const wTol = productOf(bar.product).coin ? Math.max(tol.weightG, COIN_MIN_WEIGHT_TOL) : tol.weightG;
  const delta = weight - bar.weightRef;
  const ok = Math.abs(delta) <= wTol + 1e-9;
  const check: BarCheck = {
    date: now.toISOString(),
    kind: 'recheck',
    weight,
    ok,
    ...(ok ? {} : { failed: ['Pesée'] }),
    note: `écart ${delta >= 0 ? '+' : '−'}${g(Math.abs(delta))} g (${((delta / bar.weightRef) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2, signDisplay: 'exceptZero' })} %)`,
  };
  return update(account, barId, (b) => ({ ...b, checks: [...(b.checks ?? []), check] }));
}

/** Lève une anomalie après vérification (VERISCAN conforme, nouvelle pesée contrôlée…). */
export function resolveAnomaly(account: Account, barId: string, note: string, now = new Date()): Account {
  return update(account, barId, (b) => {
    if (barState(b) !== 'anomaly') throw new LedgerError('Aucune anomalie à lever.');
    const check: BarCheck = {
      date: now.toISOString(),
      kind: 'resolved',
      ok: true,
      note: note.trim() || 'Anomalie levée',
    };
    return { ...b, checks: [...(b.checks ?? []), check] };
  });
}
