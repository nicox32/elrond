/** Objectif retraite : où en est l'épargne, et combien mettre de côté chaque mois pour l'atteindre. */
import type { RetirementGoal } from './types.ts';

export interface RetirementStatus {
  progress: number;
  remaining: number;
  months: number;
  /** Versement mensuel nécessaire (frais d'achat non compris). */
  monthly: number;
  /** Valeur projetée à la date visée avec les seuls versements déjà faits. */
  projectedWithoutSaving: number;
  reached: boolean;
}

export function monthsBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth());
}

/**
 * Avec une hausse annuelle g, le capital actuel V devient V·(1+r)^n (r mensuel) et un versement mensuel P
 * s'accumule en P·((1+r)^n − 1)/r. On cherche P tel que le total atteigne l'objectif.
 */
export function retirementStatus(goal: RetirementGoal, value: number, now = new Date()): RetirementStatus {
  const months = monthsBetween(now, new Date(goal.date));
  const r = (1 + (goal.growth ?? 0)) ** (1 / 12) - 1;
  const grow = (1 + r) ** months;
  const projected = value * grow;
  const gap = Math.max(0, goal.target - projected);
  const annuity = r > 0 ? (grow - 1) / r : months;
  const monthly = gap === 0 ? 0 : months > 0 ? gap / annuity : gap;
  return {
    progress: goal.target > 0 ? Math.min(1, value / goal.target) : 0,
    remaining: Math.max(0, goal.target - value),
    months,
    monthly,
    projectedWithoutSaving: projected,
    reached: value >= goal.target,
  };
}
