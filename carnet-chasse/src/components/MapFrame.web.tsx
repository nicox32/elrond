import { createElement } from 'react';

/** Version web : la carte dans un cadre (si le site l'autorise ; sinon, bouton « Ouvrir dans le navigateur »). */
export function MapFrame({ url }: { url: string; onUrlChange?: (url: string) => void }) {
  return createElement('iframe', {
    src: url,
    title: 'Carte interactive Shackmaps',
    style: { flex: 1, width: '100%', height: '100%', border: 0, backgroundColor: '#0B1422' },
    referrerPolicy: 'no-referrer',
  });
}
