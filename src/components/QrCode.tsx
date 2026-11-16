import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { qrMatrix, qrPath } from '../logic/qr';

/** QR code dessiné en SVG (noir sur fond blanc, lisible par tous les téléphones). */
export function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const { d, n } = useMemo(() => {
    const m = qrMatrix(value);
    return { d: qrPath(m), n: m.length + 4 };
  }, [value]);
  return (
    <View style={{ width: size, height: size, backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`}>
        <Rect width={n} height={n} fill="#fff" />
        <Path d={d} fill="#000" />
      </Svg>
    </View>
  );
}
