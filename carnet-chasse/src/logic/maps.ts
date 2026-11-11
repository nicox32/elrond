/** Cartes interactives Shackmaps (site tiers, affiché tel quel dans l'appli). */
import type { ReserveId } from './types.ts';

export const SHACKMAPS_HUB = 'https://www.shackmaps.com/way-of-the-hunter-2';

/**
 * Liens par défaut : New Laurentia donné par le joueur ; Kilimaya pointe vers l'accueil des cartes du jeu.
 * Seules New Laurentia et Kilimaya ont une carte (le QG n'est pas proposé à l'écran).
 */
export const DEFAULT_MAP_URLS: Record<ReserveId, string> = {
  'new-laurentia': `${SHACKMAPS_HUB}/new-laurentia`,
  kilimaya: SHACKMAPS_HUB,
  headquarters: SHACKMAPS_HUB,
};

/** Hôtes autorisés à s'ouvrir dans la carte ; tout autre lien part dans le navigateur. */
const ALLOWED_HOSTS = ['shackmaps.com', 'shacknews.com'];

export function hostOf(url: string): string | undefined {
  const m = url.trim().match(/^https:\/\/([^/?#:]+)/i);
  return m ? m[1].toLowerCase() : undefined;
}

export function isAllowedHost(url: string): boolean {
  const h = hostOf(url);
  return !!h && ALLOWED_HOSTS.some((a) => h === a || h.endsWith(`.${a}`));
}

/** Lien de carte acceptable : https et sur Shackmaps. */
export function isMapUrl(url: string): boolean {
  const h = hostOf(url);
  return !!h && (h === 'shackmaps.com' || h.endsWith('.shackmaps.com'));
}

export function mapUrlFor(reserveId: ReserveId, saved: Partial<Record<ReserveId, string>>): string {
  return saved[reserveId] ?? DEFAULT_MAP_URLS[reserveId];
}

/** La réserve n'a encore que le lien d'accueil : il faut choisir sa carte sur le site puis enregistrer le lien. */
export function isHubOnly(reserveId: ReserveId, saved: Partial<Record<ReserveId, string>>): boolean {
  return mapUrlFor(reserveId, saved).replace(/\/+$/, '') === SHACKMAPS_HUB;
}
