import type { Metal } from './logic/types';

export const colors = {
  background: '#0E0F13',
  surface: '#181A21',
  surfaceAlt: '#22252E',
  border: '#2C3039',
  text: '#F3F4F6',
  textMuted: '#9CA3AF',
  gold: '#D4AF37',
  goldSoft: 'rgba(212, 175, 55, 0.15)',
  silver: '#C0C6D0',
  platinum: '#8FB3CC',
  up: '#34D399',
  down: '#F87171',
  warning: '#FBBF24',
};

export const metalColor: Record<Metal, string> = {
  gold: colors.gold,
  silver: colors.silver,
  platinum: colors.platinum,
  ecu: '#F0C75E',
};

export const metalSymbol: Record<Metal, string> = { gold: 'Au', silver: 'Ag', platinum: 'Pt', ecu: 'GO' };
