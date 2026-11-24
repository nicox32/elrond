import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import type { SkyPhase } from '../theme';

// Silhouettes de Port Corail : immeubles, palmiers, mer. Fenêtres allumées la nuit.
const BUILDINGS = [
  [0, 120, 40], [38, 90, 30], [66, 150, 46], [110, 70, 26], [134, 185, 38], [170, 110, 34], [202, 230, 44],
  [244, 140, 30], [272, 95, 36], [306, 170, 40], [344, 120, 30], [372, 200, 34], [404, 80, 28],
] as const;

function palm(x: number, h: number, flip = 1) {
  const top = 300 - h;
  return `M${x} 300 Q ${x - 8 * flip} ${300 - h / 2} ${x + 4 * flip} ${top}
    M${x + 4 * flip} ${top} q ${-40 * flip} -6 ${-58 * flip} 22 q ${30 * flip} -16 ${58 * flip} -22
    M${x + 4 * flip} ${top} q ${-20 * flip} -30 ${-52 * flip} -30 q ${34 * flip} 8 ${52 * flip} 30
    M${x + 4 * flip} ${top} q ${16 * flip} -32 ${50 * flip} -34 q ${-32 * flip} 14 ${-50 * flip} 34
    M${x + 4 * flip} ${top} q ${40 * flip} -2 ${56 * flip} 26 q ${-26 * flip} -18 ${-56 * flip} -26`;
}

export function Skyline({ phase, height = 230 }: { phase: SkyPhase; height?: number }) {
  const night = phase === 'nuit';
  const ink = night ? '#0A0618' : phase === 'jour' ? '#1B2A4A' : '#1A0B2E';
  const windows = night ? '#FFD166' : phase === 'couchant' ? '#FF9F6B' : 'transparent';
  return (
    <View style={[styles.wrap, { height }]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 430 300" preserveAspectRatio="xMidYMax slice">
        {night && (
          <G>
            {Array.from({ length: 26 }, (_, i) => (
              <Circle key={i} cx={(i * 97) % 430} cy={(i * 53) % 110} r={i % 4 === 0 ? 1.4 : 0.8} fill="#fff" opacity={0.7} />
            ))}
            <Circle cx={350} cy={60} r={16} fill="#FFF4D6" opacity={0.9} />
          </G>
        )}
        {phase !== 'nuit' && <Circle cx={300} cy={phase === 'jour' ? 70 : 205} r={phase === 'jour' ? 22 : 46} fill={phase === 'jour' ? '#FFF6C9' : '#FFD27A'} opacity={0.95} />}
        {BUILDINGS.map(([x, h, w], i) => (
          <G key={i}>
            <Rect x={x} y={260 - h} width={w} height={h + 40} fill={ink} opacity={0.92} />
            {windows !== 'transparent' &&
              Array.from({ length: Math.floor(h / 16) }, (_, r) =>
                Array.from({ length: Math.floor(w / 10) }, (_, c) =>
                  (i * 7 + r * 3 + c * 5) % 3 !== 0 ? null : (
                    <Rect key={`${r}-${c}`} x={x + 4 + c * 10} y={268 - h + r * 16} width={4} height={6} fill={windows} opacity={0.85} />
                  ),
                ),
              )}
          </G>
        ))}
        <Rect x={0} y={262} width={430} height={40} fill={night ? '#0B1030' : '#12305A'} opacity={0.85} />
        {[0, 1, 2, 3].map((i) => (
          <Rect key={i} x={250 - i * 6} y={268 + i * 7} width={110 + i * 12} height={2} fill={night ? '#FFF4D6' : '#FFD27A'} opacity={0.5 - i * 0.1} />
        ))}
        <Path d={palm(36, 150)} stroke={ink} strokeWidth={7} fill="none" strokeLinecap="round" />
        <Path d={palm(392, 120, -1)} stroke={ink} strokeWidth={6} fill="none" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
