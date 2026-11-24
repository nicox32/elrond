export const colors = {
  background: '#0B0716',
  surface: '#171029',
  surfaceAlt: '#221838',
  border: '#33274F',
  text: '#F7F3FF',
  textMuted: '#A99CC6',
  pink: '#FF3D8B',
  cyan: '#2DE2E6',
  purple: '#8A4DFF',
  sun: '#FFB347',
  green: '#3DDC97',
  red: '#FF5C6C',
  bubbleMe: '#FF3D8B',
  bubbleThem: '#2A2042',
};

export type WallpaperId = 'auto' | 'sunset' | 'neon' | 'ocean' | 'midnight';

export const wallpapers: Record<WallpaperId, { name: string; colors: readonly [string, string, ...string[]] }> = {
  auto: { name: 'Selon l’heure', colors: ['#2B0B3F', '#B0246A', '#FF7A59', '#FFC46B'] },
  sunset: { name: 'Coucher de soleil', colors: ['#2B0B3F', '#B0246A', '#FF7A59', '#FFC46B'] },
  neon: { name: 'Néon', colors: ['#0B0716', '#3A0CA3', '#F72585'] },
  ocean: { name: 'Océan', colors: ['#03111F', '#05668D', '#02C39A'] },
  midnight: { name: 'Minuit', colors: ['#000000', '#141E30', '#243B55'] },
};

export type SkyPhase = 'aube' | 'jour' | 'couchant' | 'nuit';

/** Moment de la journée à Port Corail, d’après l’heure du téléphone. */
export function skyPhase(hour: number): SkyPhase {
  if (hour >= 6 && hour < 9) return 'aube';
  if (hour >= 9 && hour < 17) return 'jour';
  if (hour >= 17 && hour < 21) return 'couchant';
  return 'nuit';
}

export const skies: Record<SkyPhase, readonly [string, string, ...string[]]> = {
  aube: ['#2E2A6B', '#B35C9E', '#FF9A8B', '#FFD3A5'],
  jour: ['#1E6FD9', '#45A6F0', '#9BD8F5', '#FFE7B3'],
  couchant: ['#2B0B3F', '#B0246A', '#FF7A59', '#FFC46B'],
  nuit: ['#05030F', '#140B33', '#2A1660', '#4B1D6E'],
};
