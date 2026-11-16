/** QR codes lisibles par n'importe quel téléphone (texte UTF-8), en matrice ou en SVG pour les PDF. */
import qrcode from 'qrcode-generator';

function make(text: string) {
  // Accents et symboles : encodage UTF-8 (sinon les lecteurs affichent des caractères faux).
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  return qr;
}

/** Cases noires (true) du QR code, ligne par ligne. */
export function qrMatrix(text: string): boolean[][] {
  const qr = make(text);
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** Tracé SVG d'un QR code (une seule forme), avec une marge blanche de 2 cases. */
export function qrPath(matrix: boolean[][], cell = 1, margin = 2): string {
  let d = '';
  matrix.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark) d += `M${(c + margin) * cell},${(r + margin) * cell}h${cell}v${cell}h-${cell}z`;
    }),
  );
  return d;
}

/** QR code complet en SVG (pour un document HTML ou PDF). */
export function qrSvg(text: string, size = 120): string {
  const m = qrMatrix(text);
  const n = m.length + 4;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${qrPath(m)}" fill="#000"/></svg>`;
}
