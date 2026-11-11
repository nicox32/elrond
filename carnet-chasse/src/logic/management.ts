/**
 * Règles de gestion du troupeau (guide du garde-chasse fourni par le joueur) : éliminer les mâles à faible
 * potentiel pour améliorer la génétique du troupeau. Mûrs 1-2 étoiles et adultes 1 étoile en mauvaise condition
 * à prélever, mûrs 3-5 étoiles à prélever en fin de vie, jeunes, adultes prometteurs et femelles à épargner.
 */

export const OBJECTIVE =
  'Éliminer les mâles à faible potentiel pour améliorer la génétique du troupeau, laisser les meilleurs gènes se reproduire et faire apparaître des trophées 5 étoiles.';

export type Sex = 'male' | 'femelle';
export type AgeClass = 'jeune' | 'adulte' | 'mur';

export type Verdict = 'eliminer' | 'trophee' | 'surveiller' | 'possible' | 'epargner' | 'libre';

export interface AnimalInput {
  sex: Sex;
  age: AgeClass;
  /** Étoiles de gènes (1 à 5), pour les mâles adultes et mûrs. */
  stars?: number;
  /** Condition physique en %. */
  conditionPct?: number;
  /** Mûr arrivé en fin de vie (vieux), d'après l'analyse en jeu. */
  endOfLife?: boolean;
}

export interface Advice {
  verdict: Verdict;
  title: string;
  reason: string;
}

/** Sous ce seuil, la condition est « basse » (le jeu ne donne pas de chiffre : seuil du guide du joueur). */
export const CULL_BELOW_PCT = 40;
/** À partir de ce seuil, l'animal est prometteur. */
export const PROMISING_FROM_PCT = 50;
/** Nombre d'étoiles à partir duquel un mâle mûr est un trophée de luxe. */
export const TROPHY_MIN_STARS = 3;

export function advise(a: AnimalInput): Advice {
  const c = a.conditionPct;
  if (a.sex === 'femelle') {
    const jeune = a.age === 'jeune';
    if (c !== undefined && c < CULL_BELOW_PCT) {
      return {
        verdict: 'possible',
        title: 'Abattage possible (effet moindre)',
        reason: `${jeune ? 'Jeune femelle' : 'Femelle'} en condition basse (${c} %) : le jeu autorise l'abattage des femelles, ${
          jeune ? 'surtout les jeunes en condition basse' : 'en particulier les jeunes'
        }, mais l'effet sur la population est moindre qu'avec un mâle.`,
      };
    }
    return {
      verdict: 'epargner',
      title: 'Épargner',
      reason:
        c === undefined
          ? "Femelle : épargnez-la, sauf mission. Seules les femelles en condition basse (surtout jeunes) peuvent être abattues, avec un effet moindre."
          : `Femelle à ${c} % : pas en condition basse, épargnez-la (sauf mission).`,
    };
  }

  if (a.age === 'jeune') {
    if (c === undefined) {
      return { verdict: 'libre', title: 'Indiquez la condition', reason: 'Jeune mâle : la condition physique décide.' };
    }
    if (c < CULL_BELOW_PCT) {
      return {
        verdict: 'eliminer',
        title: 'Cible prioritaire selon le jeu',
        reason: `Jeune mâle en condition très basse (${c} %) : éliminez-le vite, il laissera la place à un animal de meilleur potentiel génétique (c'est aussi la cible recommandée par l'encyclopédie du jeu).`,
      };
    }
    if (c < PROMISING_FROM_PCT) {
      return {
        verdict: 'epargner',
        title: 'Ne pas tirer : laissez-le grandir',
        reason: `Jeune mâle à condition moyenne (${c} %) : ses stats peuvent s'améliorer avec le temps, laissez-le grandir.`,
      };
    }
    return {
      verdict: 'epargner',
      title: 'Ne pas tirer : jeune prometteur',
      reason: `Jeune mâle à ${c} % : bonne condition, laissez-le grandir.`,
    };
  }

  if (a.age === 'mur' && a.endOfLife) {
    const s = a.stars;
    return {
      verdict: 'eliminer',
      title: 'À prélever maintenant : fin de vie',
      reason:
        s !== undefined && s >= TROPHY_MIN_STARS
          ? `Vieux mâle à ${s} étoiles en fin de vie : c'est le moment, trophée au maximum et place libérée pour les jeunes.`
          : 'Vieux mâle en fin de vie : abattez-le, peu importe sa condition, pour faire de la place aux jeunes de meilleure qualité.',
    };
  }

  const stars = a.stars;
  if (stars === undefined) {
    return { verdict: 'libre', title: 'Indiquez les étoiles', reason: "Il faut le nombre d'étoiles du mâle pour décider." };
  }

  if (a.age === 'mur') {
    if (stars >= TROPHY_MIN_STARS) {
      return {
        verdict: 'trophee',
        title: 'Trophée de luxe : à prélever en fin de vie',
        reason: `Mûr à ${stars} étoiles : laissez-le transmettre ses gènes, puis prélevez-le pendant sa dernière année de vie (les 3 derniers jours en jeu) pour le meilleur trophée et le moins d'impact sur la population.`,
      };
    }
    return {
      verdict: 'eliminer',
      title: 'Cible n°1 : à prélever',
      reason: `Mûr à ${stars} étoile${stars > 1 ? 's' : ''} : mauvaise génétique, il ne progressera plus. Prélevez-le pour l'empêcher de se reproduire et récupérer l'argent avant qu'il meure de vieillesse.`,
    };
  }

  // Mâle adulte
  if (stars === 1) {
    const c = a.conditionPct;
    if (c === undefined) {
      return { verdict: 'libre', title: 'Indiquez la condition', reason: 'Pour un adulte 1 étoile, la condition physique décide.' };
    }
    if (c < CULL_BELOW_PCT) {
      return {
        verdict: 'eliminer',
        title: 'À éliminer',
        reason: `Adulte 1 étoile en très mauvaise condition (${c} %) : le prélever stoppe la transmission de ses mauvais gènes dès le stade adulte.`,
      };
    }
    if (c < PROMISING_FROM_PCT) {
      return {
        verdict: 'surveiller',
        title: 'À surveiller',
        reason: `Adulte 1 étoile à ${c} % : entre les deux seuils (${CULL_BELOW_PCT} et ${PROMISING_FROM_PCT} %). Revenez le voir plus tard.`,
      };
    }
    return {
      verdict: 'epargner',
      title: 'Ne pas tirer : adulte prometteur',
      reason: `Adulte 1 étoile à ${c} % : laissez-le grandir, il peut devenir un beau mûr à 3 ou 4 étoiles.`,
    };
  }
  return {
    verdict: 'epargner',
    title: 'Ne pas tirer : laissez-le mûrir',
    reason: `Adulte à ${stars} étoiles : bons gènes, attendez qu'il soit mûr.`,
  };
}

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
