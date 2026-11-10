/**
 * Règles de gestion du troupeau (guide du garde-chasse fourni par le joueur) : éliminer les mâles à faible
 * potentiel pour améliorer la génétique du troupeau. Mûrs 1-2 étoiles et adultes 1 étoile en mauvaise condition
 * à prélever, mûrs 3-5 étoiles à prélever en fin de vie, jeunes, adultes prometteurs et femelles à épargner.
 */

export const OBJECTIVE =
  'Éliminer les mâles à faible potentiel pour améliorer la génétique du troupeau, laisser les meilleurs gènes se reproduire et faire apparaître des trophées 5 étoiles.';

export type Sex = 'male' | 'femelle';
export type AgeClass = 'jeune' | 'adulte' | 'mur';

export type Verdict = 'eliminer' | 'trophee' | 'surveiller' | 'epargner' | 'libre';

export interface AnimalInput {
  sex: Sex;
  age: AgeClass;
  /** Étoiles de gènes (1 à 5), pour les mâles adultes et mûrs. */
  stars?: number;
  /** Condition physique en %. */
  conditionPct?: number;
}

export interface Advice {
  verdict: Verdict;
  title: string;
  reason: string;
}

/** Sous ce seuil, un mâle adulte 1 étoile est à éliminer. */
export const CULL_BELOW_PCT = 40;
/** À partir de ce seuil, un mâle adulte 1 étoile est prometteur. */
export const PROMISING_FROM_PCT = 50;
/** Nombre d'étoiles à partir duquel un mâle mûr est un trophée de luxe. */
export const TROPHY_MIN_STARS = 3;

export function advise(a: AnimalInput): Advice {
  if (a.sex === 'femelle') {
    return {
      verdict: 'epargner',
      title: 'Ne pas tirer',
      reason:
        "Femelle : ne la tuez jamais, sauf si une mission l'exige. Pas de gènes visibles, peu d'argent, et le troupeau rétrécit.",
    };
  }
  if (a.age === 'jeune') {
    return {
      verdict: 'epargner',
      title: 'Ne pas tirer',
      reason: 'Jeune : on ne connaît pas encore son potentiel génétique final.',
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
        reason: `Mûr à ${stars} étoiles : laissez-le transmettre ses gènes le plus longtemps possible, puis prélevez-le juste avant qu'il meure de vieillesse pour le score maximal.`,
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
    text: "Dormez dans un chalet pour faire avancer les jours : c'est ce qui fait grandir, vieillir et évoluer les animaux.",
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
