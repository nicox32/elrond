/**
 * Calculateur « tirer ou épargner » : stratégie recommandée par le joueur (heures de jeu et retours de la
 * communauté). On oublie la règle simpliste « tout ce qui est sous 50 % » : on analyse troupeau par troupeau,
 * l'âge et la condition physique aux jumelles.
 */

export type Sex = 'male' | 'femelle';
export type AgeClass = 'jeune' | 'adulte' | 'mur';
/** Pour les âgés : avant-dernière ou dernière année de vie (âge actuel = espérance de vie maximale). */
export type LifeStage = 'normal' | 'avant-derniere' | 'derniere';

export type Verdict = 'eliminer' | 'trophee' | 'surveiller' | 'possible' | 'epargner' | 'libre';

export interface AnimalInput {
  sex: Sex;
  age: AgeClass;
  /** Condition physique en %. */
  conditionPct?: number;
  /** Moment de vie des âgés (et des femelles). */
  lifeStage?: LifeStage;
  /** Seuil des jeunes faibles : 50 % (par défaut) ou 40 % (mode prudent). */
  youngCutoff?: number;
  /** Étoiles : informatives, elles ne décident plus du verdict. */
  stars?: number;
  /** Âge en années (rapport de chasse, fiche de l'animal). */
  ageYears?: number;
  /** Espérance de vie de l'espèce en années : avec l'âge, donne le moment de vie automatiquement. */
  lifespanYears?: number;
  /** Condition médiane des animaux vivants du troupeau (même sexe), pour comparer. */
  herdMedianPct?: number;
  /** Nombre d'animaux (même sexe, vivants) dont la condition est notée dans le troupeau. */
  herdSampleSize?: number;
  /** Écart à la médiane (points) sous lequel un animal est « faible du troupeau » : 5, 10 ou 15. */
  medianGap?: number;
}

/** Il faut au moins 5 animaux notés (même sexe) pour que la médiane du troupeau remplace les seuils fixes. */
export const MIN_HERD_SAMPLE = 5;
export const MEDIAN_GAP_DEFAULT = 10;
export const MEDIAN_GAPS = [5, 10, 15] as const;

/** Repère du troupeau, s'il y a assez d'animaux notés ; sinon le calcul garde les seuils fixes. */
export function herdReference(a: Pick<AnimalInput, 'herdMedianPct' | 'herdSampleSize' | 'medianGap'>): { median: number; gap: number } | undefined {
  if (a.herdMedianPct === undefined || (a.herdSampleSize ?? 0) < MIN_HERD_SAMPLE) return undefined;
  return { median: a.herdMedianPct, gap: a.medianGap ?? MEDIAN_GAP_DEFAULT };
}

const pct = (n: number) => `${String(Math.round(n * 10) / 10).replace('.', ',')} %`;

/** Médiane d'une liste de pourcentages (undefined si vide). */
export function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const v = [...values].sort((x, y) => x - y);
  const m = Math.floor(v.length / 2);
  const out = v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  return Math.round(out * 10) / 10;
}

/** Part de la vie déjà écoulée, en % (âge / espérance de vie). */
export function lifeRatio(ageYears?: number, lifespanYears?: number): number | undefined {
  if (ageYears === undefined || !lifespanYears) return undefined;
  return Math.min(100, Math.round((ageYears / lifespanYears) * 100));
}

/** Moment de vie calculé d'après l'âge et l'espérance de vie de l'espèce. */
export function lifeFromAge(ageYears?: number, lifespanYears?: number): { stage: LifeStage; yearsLeft: number } | undefined {
  if (ageYears === undefined || lifespanYears === undefined || lifespanYears <= 0) return undefined;
  const yearsLeft = Math.max(0, lifespanYears - ageYears);
  return { stage: yearsLeft <= 1 ? 'derniere' : yearsLeft === 2 ? 'avant-derniere' : 'normal', yearsLeft };
}

/** Femelles très faibles : à prélever sous 40 %. */
export const FEMALE_LOW_PCT = 40;
/** Mâles à haut fitness : à épargner jusqu'à la fin de leur cycle mûr. */
export const HIGH_FITNESS_PCT = 80;
/** Prélèvements conseillés par troupeau et par session. */
export const MAX_TAKEN_PER_SESSION = 2;

/** L'animal est-il mûr d'après son âge et l'âge de maturité de l'espèce ? */
export function isMatureByAge(ageYears?: number, matureAgeYears?: number): boolean | undefined {
  if (ageYears === undefined || matureAgeYears === undefined) return undefined;
  return ageYears >= matureAgeYears;
}

const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;

/** Phrase sur l'âge ajoutée au conseil : âge, années restantes et équivalent en jours de jeu. */
export function ageNote(ageYears?: number, lifespanYears?: number): string | undefined {
  if (ageYears === undefined) return undefined;
  const life = lifeFromAge(ageYears, lifespanYears);
  if (!life) return `${plural(ageYears, 'an')}.`;
  if (life.yearsLeft === 0) return `${plural(ageYears, 'an')} sur ${lifespanYears} : il a atteint l’espérance de vie de l’espèce, il peut mourir de vieillesse d’un jour à l’autre.`;
  const ratio = lifeRatio(ageYears, lifespanYears)!;
  const half = lifespanYears! / 2;
  const where = ageYears < half ? 'avant le milieu de sa vie' : ageYears === half ? 'au milieu de sa vie' : 'après le milieu de sa vie';
  return `${plural(ageYears, 'an')} sur ${lifespanYears} (${ratio} % de sa vie, ${where} : ${String(half).replace('.', ',')} ans) : il lui reste environ ${plural(life.yearsLeft, 'an')} à vivre, soit ${life.yearsLeft * GAME_DAYS_PER_YEAR} jours en jeu.`;
}

export interface Advice {
  verdict: Verdict;
  title: string;
  reason: string;
}

/** Jeunes faibles : sous 50 %, ou sous 40 % en mode prudent. */
export const YOUNG_CUTOFF = 50;
export const YOUNG_CUTOFF_PRUDENT = 40;
/** Adultes médians : environ 35 à 60 % en début de partie ; bonne condition au-delà de 55-60 %. */
export const ADULT_LOW_PCT = 35;
export const ADULT_GOOD_PCT = 55;
/** Âgés : faible condition sous 50 % ; bonne forme dès 40 %, idéalement 55 %. */
export const OLD_LOW_PCT = 50;
export const OLD_FAIR_PCT = 40;
export const OLD_GOOD_PCT = 55;

const ask = (who: string): Advice => ({ verdict: 'libre', title: 'Indiquez la condition', reason: `${who} : la condition physique décide.` });

/**
 * Tout ce qu'il faut savoir sur l'animal saisi, en plus du verdict : fitness, étoiles, âge,
 * argent, naissances, limite de prélèvements et suite à donner.
 */
export function explain(a: AnimalInput, verdict: Verdict): string[] {
  const out: string[] = [];
  const c = a.conditionPct;
  const male = a.sex === 'male';
  const take = verdict === 'eliminer' || verdict === 'trophee' || verdict === 'possible';
  const life = lifeFromAge(a.ageYears, a.lifespanYears);

  const ref = herdReference(a);
  if (c !== undefined) {
    const weak = ref ? c <= ref.median - ref.gap : c < ADULT_LOW_PCT;
    const level =
      c > HIGH_FITNESS_PCT
        ? 'haut fitness'
        : ref
          ? weak
            ? 'faible pour ce troupeau'
            : c <= ref.median + ref.gap
              ? 'dans la moyenne de ce troupeau'
              : 'bon pour ce troupeau'
          : c >= OLD_GOOD_PCT
            ? 'bon fitness'
            : c >= ADULT_LOW_PCT
              ? 'fitness moyen'
              : 'fitness faible';
    const ceiling = male
      ? c > HIGH_FITNESS_PCT
        ? ' Une fois mûr, il peut atteindre 4 ou 5 étoiles.'
        : weak
          ? ' Même mûr, son trophée restera petit.'
          : ''
      : '';
    out.push(`🧬 ${c} % : ${level}. C’est son plafond génétique, fixé à la naissance : il ne changera jamais.${ceiling}`);
  }

  if (male && a.age !== 'mur') {
    out.push(
      `⭐ ${a.age === 'jeune' ? 'Jeune' : 'Adulte'} : 1 ou 2 étoiles pour l’instant, même avec un très bon fitness. Ses étoiles ne montrent son vrai potentiel qu’une fois mûr.`,
    );
  }

  if (a.herdMedianPct !== undefined) {
    out.push(
      ref
        ? `📐 Seuils calés sur ce troupeau : faible à ${pct(ref.median - ref.gap)} ou moins (médiane ${pct(ref.median)} − ${ref.gap} points), bon au-dessus de ${pct(ref.median + ref.gap)}.`
        : `📐 Seuils fixes : seulement ${a.herdSampleSize ?? 0} ${male ? 'mâle' : 'femelle'}${(a.herdSampleSize ?? 0) > 1 ? 's' : ''} noté${(a.herdSampleSize ?? 0) > 1 ? 's' : ''} dans ce troupeau, il en faut ${MIN_HERD_SAMPLE} pour caler les seuils sur sa médiane.`,
    );
  }
  if (c !== undefined && a.herdMedianPct !== undefined) {
    const d = Math.round((c - a.herdMedianPct) * 10) / 10;
    const fmt = (n: number) => String(n).replace('.', ',');
    out.push(
      d === 0
        ? `📊 Pile sur la médiane du troupeau (${fmt(a.herdMedianPct)} %).`
        : `📊 Médiane du troupeau : ${fmt(a.herdMedianPct)} %. Il est ${d > 0 ? `au-dessus (+${fmt(d)} points) : il fait monter` : `en dessous (${fmt(d)} points) : il tire vers le bas`} la génétique du troupeau.`,
    );
  }

  const note = ageNote(a.ageYears, a.lifespanYears);
  if (note) out.push(`⏳ ${note}`);
  if (life && !take && life.yearsLeft > 1 && (a.age === 'mur' || !male)) {
    const wait = (life.yearsLeft - 1) * GAME_DAYS_PER_YEAR;
    out.push(`📅 Sa dernière année commence dans environ ${wait} jours en jeu : dormez au chalet ou sous une tente, puis revenez le voir.`);
  } else if (a.ageYears !== undefined && a.lifespanYears === undefined && (a.age === 'mur' || !male)) {
    out.push('📅 Notez l’espérance de vie dans la fiche de l’espèce pour savoir quand arrive sa dernière année.');
  } else if (a.ageYears === undefined && a.age === 'mur') {
    out.push('📅 Indiquez son âge pour savoir quand arrive sa dernière année.');
  }

  if (take) {
    out.push(
      '💰 La vente ne paie que la viande intacte : poids après découpe × prix au kilo de l’espèce. Ni le fitness ni les bois ne changent le prix : visez les organes vitaux pour abîmer le moins de viande.',
    );
  }

  if (!male) out.push('♀ Les femelles font les naissances : n’en prélevez jamais plusieurs d’un coup dans un troupeau.');

  if (take) {
    out.push(`🎯 Au plus ${MAX_TAKEN_PER_SESSION} prélèvements dans ce troupeau aujourd’hui, dont un seul mâle : au-delà, la pression de chasse fait fuir les animaux.`);
    out.push('🌱 Ensuite : dormez quelques jours (chalet ou tente) pour déclencher les naissances. Mangeoires actives et points d’eau propres font monter le statut du troupeau.');
  }
  return out;
}

export function advise(a: AnimalInput): Advice {
  const c = a.conditionPct;
  const stage = lifeFromAge(a.ageYears, a.lifespanYears)?.stage ?? a.lifeStage ?? 'normal';
  // Seuils relatifs : faible du troupeau = médiane − écart (jamais un animal à haut fitness).
  const ref = herdReference(a);
  const weakLine = ref ? ref.median - ref.gap : undefined;
  const weakVsHerd = c !== undefined && weakLine !== undefined && c <= HIGH_FITNESS_PCT && c <= weakLine;
  const vsHerd = ref ? ` (médiane du troupeau ${pct(ref.median)}, faible à ${pct(weakLine!)} ou moins)` : '';

  // Femelles : très faibles (sous 40 %) ou en dernière année de vie.
  if (a.sex === 'femelle') {
    if (c !== undefined && c < FEMALE_LOW_PCT) {
      return {
        verdict: 'eliminer',
        title: 'Femelle très faible : à prélever',
        reason: `Femelle à ${c} % (sous ${FEMALE_LOW_PCT} %) : son impact génétique est moindre que celui d’un mâle, mais la garder tire la moyenne du troupeau vers le bas. Une ou deux à la fois au plus : moins de femelles, c’est moins de naissances.`,
      };
    }
    if (weakVsHerd) {
      return {
        verdict: 'eliminer',
        title: 'Femelle faible du troupeau : à prélever',
        reason: `Femelle à ${c} %${vsHerd} : parmi les plus faibles de ce troupeau. Une ou deux à la fois au plus : moins de femelles, c’est moins de naissances.`,
      };
    }
    if (stage === 'derniere') {
      return {
        verdict: 'eliminer',
        title: 'Dernière année : prélèvement possible',
        reason: 'Femelle dans sa dernière année de vie : vous pouvez la tirer, elle a peu d’impact négatif sur le troupeau.',
      };
    }
    return {
      verdict: 'epargner',
      title: 'Ne pas tirer',
      reason:
        c === undefined
          ? `Femelle : ne la tirez qu’en dernière année de vie, ou si sa condition est sous ${FEMALE_LOW_PCT} % (indiquez-la).`
          : `Femelle à ${c} % : gardez-la, elle assure les naissances. Ne la tirez qu’en dernière année de vie.`,
    };
  }

  // Priorité n°1 : jeunes faibles.
  if (a.age === 'jeune') {
    if (c === undefined) return ask('Jeune');
    const cutoff = a.youngCutoff ?? YOUNG_CUTOFF;
    if (c < cutoff || weakVsHerd) {
      return {
        verdict: 'eliminer',
        title: 'Priorité n°1 : jeune faible',
        reason: `Jeune à ${c} % (${c < cutoff ? `sous ${cutoff} %` : `faible pour ce troupeau${vsHerd}`}) : il tire le troupeau vers le bas sans avoir donné son potentiel, et plus longtemps que les autres puisqu’il est jeune.`,
      };
    }
    return {
      verdict: 'epargner',
      title: 'Ne pas tirer : laissez-le grandir',
      reason: `Jeune à ${c} % : au-dessus du seuil de ${cutoff} %${ref ? ` et de la ligne des faibles du troupeau (${pct(weakLine!)})` : ''}, laissez-le grandir.`,
    };
  }

  // Adultes : on garde les médians et les bons.
  if (a.age === 'adulte') {
    if (c === undefined) return ask('Adulte');
    if (ref) {
      if (weakVsHerd) {
        return {
          verdict: 'eliminer',
          title: 'Adulte faible du troupeau : à prélever',
          reason: `Adulte à ${c} %${vsHerd} : parmi les plus faibles de ce troupeau, même mûr son trophée restera petit. Retirer les jeunes et adultes faibles nettoie vite la génétique du secteur, grâce aux naissances suivantes.`,
        };
      }
      if (c <= ref.median + ref.gap) {
        return {
          verdict: 'epargner',
          title: 'Ne pas tirer : adulte médian',
          reason: `Adulte à ${c} % : dans la zone médiane de ce troupeau (${pct(weakLine!)} à ${pct(ref.median + ref.gap)}), ses bois ou cornes n’ont pas fini de grandir.`,
        };
      }
    } else if (c < ADULT_LOW_PCT) {
      return {
        verdict: 'eliminer',
        title: 'Adulte faible : à prélever',
        reason: `Adulte à ${c} % : sous la zone médiane (${ADULT_LOW_PCT}-60 %), même mûr, son trophée restera petit. Retirer les jeunes et adultes faibles nettoie vite la génétique du secteur, grâce aux naissances suivantes.`,
      };
    }
    if (!ref && c < ADULT_GOOD_PCT) {
      return {
        verdict: 'epargner',
        title: 'Ne pas tirer : adulte médian',
        reason: `Adulte à ${c} % : dans la zone médiane (environ ${ADULT_LOW_PCT}-60 % en début de partie), ses bois ou cornes n’ont pas fini de grandir.`,
      };
    }
    return {
      verdict: 'epargner',
      title: c > HIGH_FITNESS_PCT ? 'Ne pas tirer : haut fitness' : 'Ne pas tirer : bonne condition',
      reason: `Adulte en bonne condition physique (${c} %) : laissez-le${c > HIGH_FITNESS_PCT ? ' vieillir jusqu’à la fin de son cycle mûr pour qu’il transmette ses gènes' : ''}.`,
    };
  }

  // Âgés (mûrs).
  if (c === undefined) return ask('Âgé');
  if (c < OLD_FAIR_PCT || weakVsHerd || (c < OLD_LOW_PCT && stage === 'derniere')) {
    return {
      verdict: 'eliminer',
      title: stage === 'derniere' ? 'À prélever : fin de vie' : 'Âgé faible : à prélever',
      reason:
        stage === 'derniere'
          ? `Âgé à ${c} % en fin de vie${vsHerd} : il va mourir à la prochaine année, autant en tirer la viande et l’XP.`
          : `Âgé à faible condition (${c} %${c < OLD_FAIR_PCT ? '' : `, faible pour ce troupeau${vsHerd}`}) : retirez-le, il ne fera que transmettre une mauvaise condition.`,
    };
  }
  if (stage === 'derniere') {
    return {
      verdict: 'trophee',
      title: 'Dernière année : prélevez-le',
      reason: `Âgé en bonne forme (${c} %) dans sa dernière année : prélevez-le pour son trophée ; il a déjà apporté le maximum à la génération future.`,
    };
  }
  if (ref ? c < ref.median : c < OLD_LOW_PCT) {
    return {
      verdict: 'surveiller',
      title: 'À surveiller',
      reason: `Âgé à ${c} % : forme correcte mais limite (${ref ? `sous la médiane du troupeau, ${pct(ref.median)}` : `faible sous ${OLD_LOW_PCT} %`}). Gardez-le surtout s’il est en avant-dernière année, et prélevez-le en dernière année.`,
    };
  }
  return {
    verdict: 'epargner',
    title: stage === 'avant-derniere' ? 'Ne pas tirer : avant-dernière année' : 'Ne pas tirer : âgé en bonne forme',
    reason:
      stage === 'avant-derniere'
        ? `Âgé en bonne forme (${c} %) en avant-dernière année : son trophée peut encore grandir dans sa dernière année et il contribue fortement à la génération future. Prélevez-le l’an prochain.`
        : c > HIGH_FITNESS_PCT
          ? `Mâle à haut fitness (${c} %) : laissez-le vieillir jusqu’à la fin de son cycle mûr pour qu’il transmette ses gènes, puis prélevez-le comme trophée dans sa dernière année.`
          : `Âgé en bonne forme (${c} %${c >= OLD_GOOD_PCT ? '' : `, idéalement ${OLD_GOOD_PCT} % et plus`}) : laissez-le contribuer à la génération future, puis prélevez-le dans sa dernière année.`,
  };
}

export interface DistanceRule {
  icon: string;
  title: string;
  range: string;
  why: string;
  weapons: string;
}

/** Distances de tir conseillées (guide du joueur, à vérifier en jeu). */
export const DISTANCE_RULES: DistanceRule[] = [
  {
    icon: '🦌',
    title: 'Gros et moyens gibiers (cerfs, élans, loups, ours…)',
    range: '150 à 200 m',
    why: "Équilibre idéal : la balle garde assez d'énergie pour les organes vitaux sans abîmer la viande, et vous restez assez loin pour ne pas être repéré.",
    weapons: 'Carabines à verrou de gros calibre.',
  },
  {
    icon: '🐇',
    title: 'Petits gibiers au sol (lièvres, canards posés)',
    range: '50 à 100 m maximum',
    why: 'Organes minuscules et balles légères : au-delà de 100 m, le vent et la gravité font dévier la trajectoire.',
    weapons: 'Petite carabine (.22 LR).',
  },
  {
    icon: '🪶',
    title: 'Petits gibiers au vol ou en mouvement',
    range: '25 à 50 m maximum',
    why: 'Sous 25 m, la viande est abîmée ; au-delà de 50 m, les plombs se dispersent trop et risquent de seulement blesser.',
    weapons: 'Fusil à canon lisse (calibre 12, plombs).',
  },
];

export const DISTANCE_GOLDEN_RULE =
  'Mesurez toujours la distance aux jumelles, puis réglez le zéro de la lunette (50, 100, 200 ou 300 m) avant de tirer.';

/** Une année de vie d'un animal = 3 jours en jeu. */
export const GAME_DAYS_PER_YEAR = 3;
