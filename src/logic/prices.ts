import { TROY_OUNCE } from './ledger.ts';
import { type PriceQuote, type Prices, SPOT_METALS, type SpotMetal, type SpotPrices } from './types.ts';

/**
 * Cours indicatifs (€/g) utilisés uniquement si aucun cours réel n'a jamais pu être chargé.
 * L'appli l'indique alors clairement à l'écran.
 */
export const REFERENCE_PRICES: Prices = { gold: 105, silver: 1.25, platinum: 32 };

const SYMBOL: Record<SpotMetal, string> = { gold: 'XAU', silver: 'XAG', platinum: 'XPT' };

const TIMEOUT_MS = 10_000;

type Fetch = typeof fetch;

async function getJson(fetchFn: Fetch, url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchFn(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function positive(n: unknown): number {
  const v = typeof n === 'string' ? Number(n) : n;
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) throw new Error('Valeur invalide');
  return v;
}

/** Source principale : api.gold-api.com (gratuit, sans clé). */
async function fromGoldApi(fetchFn: Fetch, metal: SpotMetal): Promise<number> {
  const data = await getJson(fetchFn, `https://api.gold-api.com/price/${SYMBOL[metal]}`);
  return positive(data?.price);
}

/**
 * Source de secours : cotations publiques de Swissquote (milieu entre achat et vente). Elle n'autorise pas
 * l'accès depuis un navigateur : elle sert dans l'appli Android, la version web garde alors les derniers cours.
 */
async function fromSwissquote(fetchFn: Fetch, metal: SpotMetal): Promise<number> {
  const data = await getJson(
    fetchFn,
    `https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${SYMBOL[metal]}/USD`,
  );
  const quote = Array.isArray(data) ? data[0]?.spreadProfilePrices?.[0] : null;
  return positive((positive(quote?.bid) + positive(quote?.ask)) / 2);
}

/** Cours au comptant en dollars par once troy : source principale, puis secours si elle ne répond pas. */
async function fetchUsdPerOunce(fetchFn: Fetch, metal: SpotMetal): Promise<number> {
  try {
    return await fromGoldApi(fetchFn, metal);
  } catch (first) {
    try {
      return await fromSwissquote(fetchFn, metal);
    } catch {
      throw first;
    }
  }
}

/** Taux de change USD → EUR, avec une seconde source en secours. */
async function fetchUsdToEur(fetchFn: Fetch): Promise<number> {
  const sources: [string, (d: any) => unknown][] = [
    ['https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR', (d) => d?.rates?.EUR],
    ['https://open.er-api.com/v6/latest/USD', (d) => d?.rates?.EUR],
  ];
  let lastError: unknown;
  for (const [url, pick] of sources) {
    try {
      return positive(pick(await getJson(fetchFn, url)));
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

/** Le taux de change bouge peu : on le garde 10 minutes pour ne pas l'interroger à chaque actualisation. */
const FX_MAX_AGE_MS = 10 * 60_000;
let fxCache: { rate: number; at: number } | null = null;

export function clearFxCache(): void {
  fxCache = null;
}

async function usdToEur(fetchFn: Fetch, now: Date): Promise<number> {
  if (fxCache && now.getTime() - fxCache.at < FX_MAX_AGE_MS) return fxCache.rate;
  const rate = await fetchUsdToEur(fetchFn);
  fxCache = { rate, at: now.getTime() };
  return rate;
}

/** Convertit un cours en dollars par once en euros par gramme. */
export function usdOunceToEurGram(usdPerOunce: number, usdToEur: number): number {
  return (usdPerOunce * usdToEur) / TROY_OUNCE;
}

/** Charge les cours réels de l'or, de l'argent et du platine, en euros par gramme. */
export async function fetchLivePrices(fetchFn: Fetch = fetch, now = new Date()): Promise<PriceQuote> {
  const [rate, ...usd] = await Promise.all([
    usdToEur(fetchFn, now),
    ...SPOT_METALS.map((m) => fetchUsdPerOunce(fetchFn, m)),
  ]);
  const spot = {} as SpotPrices;
  SPOT_METALS.forEach((m, i) => {
    spot[m] = usdOunceToEurGram(usd[i], rate);
  });
  const prices: Prices = spot;
  return { prices, fetchedAt: now.toISOString(), source: 'live' };
}

export function referenceQuote(now = new Date()): PriceQuote {
  return { prices: { ...REFERENCE_PRICES }, fetchedAt: now.toISOString(), source: 'reference' };
}
