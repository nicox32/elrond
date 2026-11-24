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

export type WallpaperId = 'sunset' | 'neon' | 'ocean' | 'midnight';

export const wallpapers: Record<WallpaperId, { name: string; colors: readonly [string, string, ...string[]] }> = {
  sunset: { name: 'Coucher de soleil', colors: ['#2B0B3F', '#B0246A', '#FF7A59', '#FFC46B'] },
  neon: { name: 'Néon', colors: ['#0B0716', '#3A0CA3', '#F72585'] },
  ocean: { name: 'Océan', colors: ['#03111F', '#05668D', '#02C39A'] },
  midnight: { name: 'Minuit', colors: ['#000000', '#141E30', '#243B55'] },
};
