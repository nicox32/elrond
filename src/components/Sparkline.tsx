import { StyleSheet, View } from 'react-native';

interface Props {
  values: number[];
  color: string;
  height?: number;
}

/** Mini-graphique en barres, sans dépendance de dessin. */
export function Sparkline({ values, color, height = 40 }: Props) {
  if (values.length === 0) return <View style={{ height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return (
    <View style={[styles.row, { height }]}>
      {values.map((v, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            {
              height: Math.max(2, ((v - min) / range) * height),
              backgroundColor: color,
              opacity: 0.35 + (0.65 * i) / values.length,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  bar: { flex: 1, borderRadius: 1 },
});
