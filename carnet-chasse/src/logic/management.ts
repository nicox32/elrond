/**
 * Calculateur « tirer ou épargner » : tri par étapes, sur la condition physique (fitness) et l'âge.
 * 1. Tri strict 0-50 % (jeunes, adultes, matures) ; 2. tri adulte 50-70 % (adultes, matures) ;
 * 3. trophée 85-100 % (matures). Les femelles ne sont dans aucun tri : on les garde.
 */

export type Sex = 'male' | 'femelle';
export type AgeClass = 'jeune' | 'adulte' | 'mur';
/** Avant-dernière ou dernière année de vie (calculée d'après l'âge et l'espérance de vie). */
export type LifeStage = 'normal' | 'avant-derniere' | 'derniere';

export type Verdict = 'eliminer' | 'trophee' | 'surveiller' | 'possible' | 'epargner' | 'libre';

export interface AnimalInput {
  sex: Sex;
  age: AgeClass;
  /** Condition physique en %. */
  conditionPct?: number;
  /** Étoiles : informatives, elles ne décident pas du verdict. */
  stars?: number;
  /** Âge en années (rapport de chasse, fiche de l'animal). */
  ageYears?: number;
  /** Espérance de vie de l'espèce en années. */
  lifespanYears?: number;
  /** Condition médiane des animaux vivants du troupeau (même sexe), pour comparer. */
  herdMedianPct?: number;
}

export interface Advice {
  verdict: Verdict;
  title: string;
  reason: string;
}

/** Les trois tris, dans l'ordre où on les applique (mâles seulement). */
export const CULL_STEPS = [
  { id: 1, name: 'Tri strict', range: [0, 50] as [number, number], ages: ['jeune', 'adulte', 'mur'] as AgeClass[], goal: 'Les plus faibles, de tous âges' },
  { id: 2, name: 'Tri adulte', range: [50, 70] as [number, number], ages: ['adulte', 'mur'] as AgeClass[], goal: 'Les moyens, sans les jeunes' },
  { id: 3, name: 'Trophée', range: [85, 100] as [number, number], ages: ['mur'] as AgeClass[], goal: 'Les plus beaux mâles : à garder ou à viser comme trophées' },
] as const;

/** Tri (1, 2 ou 3) dans lequel tombe l'animal, ou undefined s'il n'est dans aucun (femelles : jamais). */
export function cullStep(sex: Sex, age: AgeClass, c: number | undefined): 1 | 2 | 3 | undefined {
  if (c === undefined || sex === 'femelle') return undefined;
  if (c < 50) return 1;
  if (c <= 70 && age !== 'jeune') return 2;
  if (c >= 85 && age === 'mur') return 3;
  return undefined;
}

const AGE_WORD: Record<AgeClass, string> = { jeune: 'Jeune', adulte: 'Adulte', mur: 'Mâle mûr' };

export function advise(a: AnimalInput): Advice {
  if (a.sex === 'femelle') {
    return {
      verdict: 'epargner',
      title: 'Femelle : à garder',
      reason: 'Aucune femelle dans les tris : elles assurent les naissances du troupeau.',
    };
  }
  const c = a.conditionPct;
  if (c === undefined) return { verdict: 'libre', title: 'Indiquez la condition', reason: `${AGE_WORD[a.age]} : la condition physique décide du tri.` };
  const who = AGE_WORD[a.age];
  switch (cullStep(a.sex, a.age, c)) {
    case 1:
      return {
        verdict: 'eliminer',
        title: '1er tri – tri strict : à prélever',
        reason: `${who} à ${c} % : dans le tri strict (0 à 50 %, tous âges). Ce sont les plus faibles : retirez-les en premier.`,
      };
    case 2:
      return {
        verdict: 'possible',
        title: '2e tri – tri adulte : à prélever ensuite',
        reason: `${who} à ${c} % : dans le tri adulte (50 à 70 %, adultes et matures, sans les jeunes). À prélever une fois le tri strict fini.`,
      };
    case 3:
      return {
        verdict: 'trophee',
        title: '3e réglage – trophée',
        reason: `Mâle mûr à ${c} % : parmi les plus beaux (85 à 100 %). Gardez-le pour ses gènes, ou visez-le comme trophée.`,
      };
    default:
      return {
        verdict: 'epargner',
        title: 'Hors tri : à garder',
        reason:
          a.age === 'jeune'
            ? `Jeune à ${c} % : au-dessus de 50 %, les jeunes ne sont pas dans les tris suivants. Laissez-le grandir.`
            : `${who} à ${c} % : dans aucun des trois tris (0-50 %, 50-70 %, 85-100 % matures). À garder.`,
      };
  }
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

/** Prélèvements conseillés par troupeau et par session. */
export const MAX_TAKEN_PER_SESSION = 2;

/** L'animal est-il mûr d'après son âge et l'âge de maturité de l'espèce ? */
export function isMatureByAge(ageYears?: number, matureAgeYears?: number): boolean | undefined {
  if (ageYears === undefined || matureAgeYears === undefined) return undefined;
  return ageYears >= matureAgeYears;
}

const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;

/** Phrase sur l'âge : âge, part de la vie, années restantes et équivalent en jours de jeu. */
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

/**
 * Tout ce qu'il faut savoir sur l'animal saisi, en plus du verdict : fitness, étoiles, médiane
 * du troupeau, âge, argent, limite de prélèvements et suite à donner.
 */
export function explain(a: AnimalInput, verdict: Verdict): string[] {
  const out: string[] = [];
  const c = a.conditionPct;
  const male = a.sex === 'male';
  const take = verdict === 'eliminer' || verdict === 'trophee' || verdict === 'possible';
  const life = lifeFromAge(a.ageYears, a.lifespanYears);

  if (c !== undefined) {
    const level = c < 50 ? 'fitness faible' : c <= 70 ? 'fitness moyen' : c >= 85 ? 'haut fitness' : 'bon fitness';
    const ceiling = male ? (c >= 85 ? ' Une fois mûr, il peut atteindre 4 ou 5 étoiles.' : c < 50 ? ' Même mûr, son trophée restera petit.' : '') : '';
    out.push(`🧬 ${c} % : ${level}. C’est son plafond génétique, fixé à la naissance : il ne changera jamais.${ceiling}`);
  }

  if (male && a.age !== 'mur') {
    out.push(
      `⭐ ${a.age === 'jeune' ? 'Jeune' : 'Adulte'} : 1 ou 2 étoiles pour l’instant, même avec un très bon fitness. Ses étoiles ne montrent son vrai potentiel qu’une fois mûr.`,
    );
  }

  if (c !== undefined && a.herdMedianPct !== undefined) {
    const d = Math.round((c - a.herdMedianPct) * 10) / 10;
    const fmt = (n: number) => String(n).replace('.', ',');
    out.push(
      d === 0
        ? `📊 Pile sur la médiane du troupeau (${pct(a.herdMedianPct)}).`
        : `📊 Médiane du troupeau : ${pct(a.herdMedianPct)}. Il est ${d > 0 ? `au-dessus (+${fmt(d)} points)` : `en dessous (${fmt(d)} points)`}.`,
    );
  }

  const note = ageNote(a.ageYears, a.lifespanYears);
  if (note) out.push(`⏳ ${note}`);
  if (life && !take && life.yearsLeft > 1 && a.age === 'mur') {
    const wait = (life.yearsLeft - 1) * GAME_DAYS_PER_YEAR;
    out.push(`📅 Sa dernière année commence dans environ ${wait} jours en jeu : dormez au chalet ou sous une tente, puis revenez le voir.`);
  }

  if (!male) out.push('♀ Les femelles font les naissances : elles restent hors des tris.');

  if (take) {
    out.push(
      '💰 La vente ne paie que la viande intacte : poids après découpe × prix au kilo de l’espèce. Ni le fitness ni les bois ne changent le prix. Visez le défaut de l’épaule (juste derrière la patte avant, à mi-hauteur, de profil) : poumons et cœur, 100 % de la viande noble gardée. Évitez l’os de l’épaule, l’arrière-train, le ventre et les pattes.',
    );
    out.push(`🎯 Au plus ${MAX_TAKEN_PER_SESSION} prélèvements dans ce troupeau aujourd’hui, dont un seul mâle : au-delà, la pression de chasse fait fuir les animaux.`);
    out.push('🌱 Ensuite : dormez quelques jours (chalet ou tente) pour déclencher les naissances. Mangeoires actives et points d’eau propres font monter le statut du troupeau.');
  }
  return out;
}

/** Pas des réglages de lunette (m). */
export const SCOPE_STEP_M = 50;

/**
 * Réglage de lunette : le palier le plus proche de la distance réelle (75-125 m → 100 m,
 * 125-175 m → 150 m, 175-225 m → 200 m…). Au milieu pile, on prend le palier du dessus.
 */
export function scopeSetting(distanceM: number | undefined): number | undefined {
  if (distanceM === undefined || !(distanceM > 0)) return undefined;
  return Math.max(SCOPE_STEP_M, Math.round(distanceM / SCOPE_STEP_M) * SCOPE_STEP_M);
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
    range: '150 à 250 m',
    why: "Distance idéale de sécurité : aucun risque de fuite, 100 % de pénétration. Au maximum « à coup sûr » : 450 à 500 m avec une grosse carabine.",
    weapons: 'Carabines à verrou de gros calibre. Arme de départ : cerfs à moins de 100-120 m.',
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
  'Mesurez toujours la distance aux jumelles, puis réglez la lunette sur le palier le plus proche (100, 150, 200 m…) avant de tirer.';

/** Gros et moyens gibiers à la carabine : distance idéale et maximum « à coup sûr ». */
export const BIG_GAME_IDEAL_M: [number, number] = [150, 250];
export const BIG_GAME_MAX_M: [number, number] = [450, 500];
/** Arme de départ (sous la classe de l'animal) : cerfs à moins de 100-120 m. */
export const STARTER_MAX_M = 120;

/** Avis sur la distance de tir d'un gros ou moyen gibier à la carabine. */
export function bigGameDistanceCheck(distanceM: number | undefined, weaponUnderClass = false): { ok: boolean; text: string } | undefined {
  if (distanceM === undefined || !(distanceM > 0)) return undefined;
  if (weaponUnderClass) {
    return distanceM <= STARTER_MAX_M
      ? { ok: true, text: `Arme sous la classe de l’animal : ${distanceM} m reste dans la limite de 100-120 m.` }
      : { ok: false, text: `Arme sous la classe de l’animal : au-delà de 100-120 m, l’énergie tombe sous le seuil et la balle risque de ne pas atteindre les poumons.` };
  }
  const [lo, hi] = BIG_GAME_IDEAL_M;
  if (distanceM < lo) return { ok: false, text: `Plus près que l’idéal (${lo}-${hi} m) : l’animal risque de vous repérer et de fuir.` };
  if (distanceM <= hi) return { ok: true, text: `Distance idéale de sécurité (${lo}-${hi} m) : aucun risque de fuite, 100 % de pénétration.` };
  if (distanceM <= BIG_GAME_MAX_M[1])
    return { ok: false, text: `Au-delà de l’idéal : seulement avec une grosse carabine, ${BIG_GAME_MAX_M[0]}-${BIG_GAME_MAX_M[1]} m au maximum « à coup sûr ».` };
  return { ok: false, text: `Trop loin : au-delà de ${BIG_GAME_MAX_M[1]} m, même une grosse carabine n’est plus « à coup sûr ».` };
}

/** Une année de vie d'un animal = 3 jours en jeu. */
export const GAME_DAYS_PER_YEAR = 3;
