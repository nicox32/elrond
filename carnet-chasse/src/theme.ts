/**
 * Thème « Way of the Hunter 2 Tracker », repris de l'interface du jeu : nuit bleu marine,
 * texte crème, étiquettes « papier déchiré » claires, vert tendre des libellés de
 * l'encyclopédie et or des insignes de classe.
 */
export const colors = {
  background: '#0B1422',
  surface: '#121F33',
  surfaceAlt: '#1A2A43',
  hud: '#0F1A2C',
  tabBar: '#0D1727',
  border: '#26385A',
  text: '#ECE6D6',
  textMuted: '#93A1B8',
  /** Alertes et points d'attention (ambre, comme les icônes « dormir » du jeu). */
  accent: '#E9A84C',
  accentSoft: 'rgba(233, 168, 76, 0.15)',
  onAccent: '#1A1206',
  /** Étiquette papier du jeu (onglet choisi, boutons « Maintenir »). */
  paper: '#E4DECF',
  onPaper: '#111C2E',
  /** Vert tendre des libellés de l'encyclopédie : sélection, liens, onglet actif. */
  highlight: '#B7D98C',
  gold: '#E2CF9D',
  goldSoft: 'rgba(226, 207, 157, 0.14)',
  goldFrame: '#3B3727',
  trophyBg: '#101B2C',
  olive: '#A7D07D',
  oliveSoft: 'rgba(167, 208, 125, 0.15)',
  danger: '#E2665C',
  dangerSoft: 'rgba(226, 102, 92, 0.16)',
  water: '#6DB3E8',
};

/** Polices chargées dans app/_layout.tsx (Barlow et Barlow Condensed, proches de celles du jeu). */
export const fonts = {
  display: 'BarlowCondensed_800ExtraBold',
  heading: 'BarlowCondensed_700Bold',
  body: 'Barlow_400Regular',
  medium: 'Barlow_500Medium',
  semibold: 'Barlow_600SemiBold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

/** Coins nets, comme les panneaux du jeu. */
export const radius = { sm: 4, md: 6, lg: 8 };
