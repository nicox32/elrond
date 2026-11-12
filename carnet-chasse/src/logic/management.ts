/**
 * Calculateur « tirer ou épargner » : stratégie recommandée par le joueur (heures de jeu et retours de la
 * communauté). On oublie la règle simpliste « tout ce qui est sous 50 % » : on analyse troupeau par troupeau,
 * l'âge et la condition physique aux jumelles.
 */

export const OBJECTIVE =
  "Analyser chaque troupeau (âge et condition physique aux jumelles), retirer ce qui tire le troupeau vers le bas, laisser progresser le reste et prélever les âgés au bon moment.";

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
}

/** Moment de vie calculé d'après l'âge et l'espérance de vie de l'espèce. */
export function lifeFromAge(ageYears?: number, lifespanYears?: number): { stage: LifeStage; yearsLeft: number } | undefined {
  if (ageYears === undefined || lifespanYears === undefined || lifespanYears <= 0) return undefined;
  const yearsLeft = Math.max(0, lifespanYears - ageYears);
  return { stage: yearsLeft <= 1 ? 'derniere' : yearsLeft === 2 ? 'avant-derniere' : 'normal', yearsLeft };
}

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
  return `${plural(ageYears, 'an')} sur ${lifespanYears} : il lui reste environ ${plural(life.yearsLeft, 'an')} à vivre, soit ${life.yearsLeft * GAME_DAYS_PER_YEAR} jours en jeu.`;
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

export function advise(a: AnimalInput): Advice {
  const base = adviseCore(a);
  const note = ageNote(a.ageYears, a.lifespanYears);
  return note ? { ...base, reason: `${base.reason} ${note}` } : base;
}

function adviseCore(a: AnimalInput): Advice {
  const c = a.conditionPct;
  const stage = lifeFromAge(a.ageYears, a.lifespanYears)?.stage ?? a.lifeStage ?? 'normal';

  // Femelles : seulement en dernière année de vie.
  if (a.sex === 'femelle') {
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
      reason: 'Femelle : ne la tirez qu’en dernière année de vie.',
    };
  }

  // Priorité n°1 : jeunes faibles.
  if (a.age === 'jeune') {
    if (c === undefined) return ask('Jeune');
    const cutoff = a.youngCutoff ?? YOUNG_CUTOFF;
    if (c < cutoff) {
      return {
        verdict: 'eliminer',
        title: 'Priorité n°1 : jeune faible',
        reason: `Jeune à ${c} % (sous ${cutoff} %) : il tire le troupeau vers le bas sans avoir donné son potentiel, et plus longtemps que les autres puisqu’il est jeune.`,
      };
    }
    return {
      verdict: 'epargner',
      title: 'Ne pas tirer : laissez-le grandir',
      reason: `Jeune à ${c} % : au-dessus du seuil de ${cutoff} %, laissez-le grandir. Ne vous fiez pas à ses étoiles : un jeune n’a que 1 ou 2 étoiles, même avec un très bon fitness.`,
    };
  }

  // Adultes : on garde les médians et les bons.
  if (a.age === 'adulte') {
    if (c === undefined) return ask('Adulte');
    if (c < ADULT_LOW_PCT) {
      return {
        verdict: 'possible',
        title: 'Adulte faible : prélèvement possible',
        reason: `Adulte à ${c} % : sous la zone médiane (${ADULT_LOW_PCT}-60 %), même mûr, son trophée restera petit.`,
      };
    }
    if (c < ADULT_GOOD_PCT) {
      return {
        verdict: 'epargner',
        title: 'Ne pas tirer : adulte médian',
        reason: `Adulte à ${c} % : dans la zone médiane (environ ${ADULT_LOW_PCT}-60 % en début de partie), ses bois ou cornes n’ont pas fini de grandir.`,
      };
    }
    return {
      verdict: 'epargner',
      title: 'Ne pas tirer : bonne condition',
      reason: `Adulte en bonne condition physique (${c} %) : laissez-le. Ses 1 ou 2 étoiles actuelles ne montrent pas son potentiel, il n’atteindra ses 4 ou 5 étoiles qu’une fois mûr.`,
    };
  }

  // Âgés (mûrs).
  if (c === undefined) return ask('Âgé');
  if (c < OLD_FAIR_PCT || (c < OLD_LOW_PCT && stage === 'derniere')) {
    return {
      verdict: 'eliminer',
      title: stage === 'derniere' ? 'À prélever : fin de vie' : 'Âgé faible : à prélever',
      reason:
        stage === 'derniere'
          ? `Âgé à ${c} % en fin de vie : il va mourir à la prochaine année, autant en tirer l’argent et l’XP.`
          : `Âgé à faible condition (${c} %) : retirez-le, il ne fera que transmettre une mauvaise condition.`,
    };
  }
  if (stage === 'derniere') {
    return {
      verdict: 'trophee',
      title: 'Dernière année : prélevez-le',
      reason: `Âgé en bonne forme (${c} %) dans sa dernière année : prélevez-le pour son trophée et pour l’argent (âgé et lourd, il se vend au meilleur prix) ; il a déjà apporté le maximum à la génération future.`,
    };
  }
  if (c < OLD_LOW_PCT) {
    return {
      verdict: 'surveiller',
      title: 'À surveiller',
      reason: `Âgé à ${c} % : forme correcte mais limite (faible sous ${OLD_LOW_PCT} %). Gardez-le surtout s’il est en avant-dernière année, et prélevez-le en dernière année.`,
    };
  }
  return {
    verdict: 'epargner',
    title: stage === 'avant-derniere' ? 'Ne pas tirer : avant-dernière année' : 'Ne pas tirer : âgé en bonne forme',
    reason:
      stage === 'avant-derniere'
        ? `Âgé en bonne forme (${c} %) en avant-dernière année : son trophée peut encore grandir dans sa dernière année et il contribue fortement à la génération future. Prélevez-le l’an prochain : plus âgé et plus lourd, il rapportera plus d’argent à la vente.`
        : `Âgé en bonne forme (${c} %${c >= OLD_GOOD_PCT ? '' : `, idéalement ${OLD_GOOD_PCT} % et plus`}) : laissez-le contribuer à la génération future, puis prélevez-le dans sa dernière année.`,
  };
}

/** Comprendre le fitness (condition physique) : affiché dans le guide. */
export const FITNESS_RULES: { title: string; text: string }[] = [
  {
    title: 'Le fitness fixe le plafond génétique',
    text: 'Ce pourcentage est attribué à la naissance et ne change jamais : il définit la taille maximale que les bois ou cornes pourront atteindre.',
  },
  {
    title: "L'âge débloque le potentiel",
    text: "Un animal à 95 % de fitness n'aura que 1 ou 2 étoiles s'il est jeune ou adulte : il n'a pas encore eu le temps de grandir.",
  },
  {
    title: 'Le stade mûr révèle le vrai score',
    text: "C'est seulement une fois mûr (et dans ses dernières années de vie) qu'un animal à haut fitness atteint ses 4 ou 5 étoiles.",
  },
  {
    title: "Le poids et l'âge font le prix",
    text: "Plus l'animal est âgé et lourd au moment du tir, plus la vente rapporte d'argent.",
  },
  {
    title: "L'abattage sélectif améliore la harde",
    text: 'Prélevez les mâles mûrs à faible fitness (1 étoile) pour relever la moyenne génétique des générations futures.',
  },
];

/** Les principes de la stratégie, affichés dans le guide. */
export const STRATEGY = {
  intro:
    'Oubliez la règle simpliste « tout ce qui est sous 50 % ». Analysez toujours troupeau par troupeau, et regardez l’âge et la condition physique aux jumelles.',
  remove: [
    'Priorité n°1 : les jeunes faibles (sous 50 %, ou sous 40 % pour être plus prudent). Ils tirent le troupeau vers le bas sans avoir donné leur potentiel, et plus longtemps que les autres.',
    'Les âgés à faible condition (sous 50 %), surtout en fin de vie (âge actuel = espérance de vie maximale) : ils vont mourir à la prochaine année, autant en tirer l’argent et l’XP.',
    'Les âgés en bonne forme dans leur dernière année de vie : on profite de leur trophée après leur contribution maximale à la génération future.',
    'Les femelles : seulement en dernière année de vie (peu d’impact négatif).',
  ],
  keep: [
    'Les adultes médians (environ 35 à 60 % en début de partie) : leurs bois ou cornes n’ont pas fini de grandir.',
    'Les adultes en bonne condition physique (plus de 55-60 %).',
    'Les âgés en bonne forme (40 % et plus, idéalement 55 % et plus), surtout en avant-dernière année : leur trophée grandit encore, et plus âgés et plus lourds, ils rapporteront plus d’argent à la vente.',
  ],
};

export const GOLDEN_RULES: { title: string; text: string }[] = [
  {
    title: 'Un seul mâle à la fois',
    text: "Ne tuez jamais plus d'un mâle par troupeau lors d'une même session, pour ne pas faire fuir les animaux (pression de chasse).",
  },
  {
    title: 'Suivez la routine',
    text: 'Utilisez les jumelles sur les zones de besoin (manger, boire, dormir) pour retrouver le même troupeau au fil des jours.',
  },
  {
    title: 'Faites passer le temps',
    text: "Dormez dans un chalet, ou sous une tente près des points de chasse pour surveiller plus vite, afin de faire avancer les jours : c'est ce qui fait grandir, vieillir et évoluer les animaux.",
  },
];

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

/** Encyclopédie du jeu, « Gestion de la faune et abattage ». */
export const GAME_RULES: string[] = [
  "Plus la condition physique d'un animal est élevée, plus son trophée sera grand : gestion de l'environnement et amélioration des habitats valent le coup.",
  "L'abattage est le prélèvement sélectif d'animaux aux caractéristiques indésirables, selon la condition physique, le sexe et l'âge. Ciblez les animaux jeunes à la condition physique basse, de préférence les mâles.",
  "Les femelles peuvent aussi être abattues, en particulier les jeunes en condition basse, mais l'effet sur la population est moindre.",
  "Une année de vie d'un animal = 3 jours en jeu. En fin d'espérance de vie, il disparaît et d'autres prennent sa place : prélevez-le pendant sa dernière année pour le meilleur trophée et le moins d'impact.",
  "L'abattage ne compte que pour le territoire où vivait l'animal : gérer les élans d'une région n'affecte que les élans de cette région.",
  'Espèces solitaires (comme les élans) : explorez tout le territoire pour repérer les individus les plus faibles.',
  "Trophée « Ultime » : pas seulement grand, il vient d'un animal à condition rare : albinisme (fourrure blanche, yeux rouges), leucisme (fourrure blanche, yeux normaux), mélanisme (fourrure noire ou foncée) ou érythrisme (fourrure rose ou rougeâtre). Il faut de la chance !",
  "Empaillez ces trophées ultimes : ils coûtent une petite fortune, mais c'est le meilleur moyen de créer une collection dont vous serez fier.",
  "Tout est dans le journal : vos prélèvements permettent de corréler qualité des trophées et condition physique. Ce ne sont que des probabilités : rien n'est garanti.",
];

export interface PopulationStatus {
  name: string;
  text: string;
}

export const POPULATION_STATUSES: PopulationStatus[] = [
  { name: 'Vulnérable', text: 'Aucun spécimen en bonne condition physique.' },
  { name: 'Stable', text: 'Part moyenne de spécimens en bonne condition.' },
  { name: 'Saine', text: 'Produit régulièrement des animaux aux meilleurs trophées.' },
  { name: 'Prospère', text: 'Produit régulièrement des animaux aux meilleurs trophées.' },
];

export const POPULATION_PATIENCE =
  "Passer de Vulnérable à Stable, puis de Stable à Saine, prend beaucoup de temps. Continuez d'abattre les spécimens faibles dans votre territoire : la condition physique finira par monter.";

/** Une année de vie d'un animal = 3 jours en jeu. */
export const GAME_DAYS_PER_YEAR = 3;
