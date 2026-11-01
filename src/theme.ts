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
  silverSoft: 'rgba(192, 198, 208, 0.15)',
  up: '#34D399',
  down: '#F87171',
};

export const metalColor = { gold: colors.gold, silver: colors.silver } as const;
export const metalSoft = { gold: colors.goldSoft, silver: colors.silverSoft } as const;
