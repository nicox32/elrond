import { Platform } from 'react-native';

/**
 * Version web : déclare la fiche d'appli (manifest) et le service worker,
 * pour que Chrome propose « Installer l'application ». Sans effet sur mobile natif.
 */
export function setupPwa(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  // Publiée sous /elrond/ sur GitHub Pages, à la racine en développement.
  const base = window.location.pathname.startsWith('/elrond') ? '/elrond/' : '/';

  const addLink = (rel: string, href: string) => {
    if (document.querySelector(`link[rel="${rel}"]`)) return;
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    document.head.appendChild(link);
  };
  addLink('manifest', `${base}manifest.webmanifest`);
  addLink('apple-touch-icon', `${base}icons/apple-touch-icon.png`);

  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#0E0F13';
    document.head.appendChild(meta);
  }

  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      // L'appli fonctionne sans ; seule l'installation n'est alors pas proposée.
    });
  }
}
