const eurFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export function formatEur(n: number): string {
  return eurFormatter.format(n);
}

export function formatGrams(n: number): string {
  const abs = Math.abs(n);
  const decimals = abs >= 100 ? 2 : abs >= 1 ? 3 : 4;
  return `${n.toFixed(decimals).replace('.', ',')} g`;
}

export function formatPercent(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2).replace('.', ',')} %`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Lit un nombre tapé à la française (« 12,5 »). */
export function parseAmount(text: string): number {
  return Number(text.replace(/\s/g, '').replace(',', '.'));
}
