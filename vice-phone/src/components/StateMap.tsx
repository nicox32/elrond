import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Polygon, Polyline, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { MAP_H, MAP_W, type Pt } from '../data/map';
import { KEYS, PLACES, type Place, REGIONS, STATE_LAND, STATE_NAME, STATE_ROADS } from '../data/state';
import { colors } from '../theme';
import { Button } from './phone';

const pts = (p: Pt[]) => p.map(([x, y]) => `${x},${y}`).join(' ');

/** Carte de tout l’État de Solenne, ajustée à l’écran. */
export function StateMap({ initial, missionPoi, onOpenCity }: { initial?: string; missionPoi?: string; onOpenCity: () => void }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [selected, setSelected] = useState<Place | null>(() => PLACES.find((p) => p.id === initial) ?? null);
  const scale = box.w ? Math.min(box.w / MAP_W, box.h / MAP_H) : 0;
  const offX = (box.w - MAP_W * scale) / 2;
  const offY = (box.h - MAP_H * scale) / 2;
  const region = selected ? REGIONS.find((r) => r.id === selected.region) : null;

  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.map} onLayout={onLayout}>
        {scale > 0 && (
          <View style={{ position: 'absolute', left: offX, top: offY, width: MAP_W * scale, height: MAP_H * scale }}>
            <Svg width={MAP_W * scale} height={MAP_H * scale} viewBox={`0 0 ${MAP_W} ${MAP_H}`}>
              <Defs>
                <LinearGradient id="ocean" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#0B3D5C" />
                  <Stop offset="1" stopColor="#04182A" />
                </LinearGradient>
              </Defs>
              <Rect width={MAP_W} height={MAP_H} fill="url(#ocean)" />
              <Polygon points={pts(STATE_LAND)} fill="#E9C48A" stroke="#E9C48A" strokeWidth={22} strokeLinejoin="round" />
              {KEYS.map((k, i) => (
                <Circle key={i} cx={k.at[0]} cy={k.at[1]} r={k.r} fill="#E9C48A" />
              ))}
              <Polygon points={pts(STATE_LAND)} fill="#1C1530" />
              {REGIONS.filter((r) => r.poly.length).map((r) => (
                <Polygon key={r.id} points={pts(r.poly)} fill={r.color} fillOpacity={selected?.region === r.id ? 0.5 : 0.28} stroke={r.color} strokeOpacity={0.6} strokeWidth={3} />
              ))}
              {KEYS.map((k, i) => (
                <Circle key={`k${i}`} cx={k.at[0]} cy={k.at[1]} r={k.r - 6} fill="#4CC9F0" fillOpacity={0.35} />
              ))}
              <Ellipse cx={690} cy={470} rx={70} ry={45} fill="#1E6A8E" />
              <SvgText x={690} y={476} fill="#9BD8F5" fontSize={18} fontStyle="italic" textAnchor="middle">
                Lac Miroir
              </SvgText>
              {STATE_ROADS.map((r, i) => (
                <Polyline key={i} points={pts(r)} stroke="#E8B04B" strokeWidth={8} strokeOpacity={0.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {REGIONS.map((r) => (
                <SvgText key={`t${r.id}`} x={r.label[0]} y={r.label[1]} fill="#fff" fillOpacity={0.85} fontSize={26} fontWeight="bold" textAnchor="middle">
                  {r.name.toUpperCase()}
                </SvgText>
              ))}
              <SvgText x={500} y={40} fill="#5FA8D3" fontSize={30} fontWeight="bold" textAnchor="middle">
                {STATE_NAME.toUpperCase()}
              </SvgText>
            </Svg>
            {PLACES.map((p) => {
              const isMission = p.id === missionPoi;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => (p.id === 'portcorail' ? onOpenCity() : setSelected(p))}
                  style={[styles.marker, { left: p.at[0] * scale - 18, top: p.at[1] * scale - 18 }, (selected?.id === p.id || isMission) && styles.markerOn]}
                  accessibilityLabel={p.name}
                >
                  <Text style={{ fontSize: 16 }}>{p.emoji}</Text>
                  {isMission && (
                    <View style={styles.flag}>
                      <Ionicons name="flag" size={10} color="#fff" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
      {selected && (
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={{ fontSize: 30 }}>{selected.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{selected.name}</Text>
              <Text style={styles.sub}>{region?.name}</Text>
            </View>
            <Pressable onPress={() => setSelected(null)} hitSlop={10} accessibilityLabel="Fermer">
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.desc}>{selected.description}</Text>
          {region && <Text style={styles.region}>{region.text}</Text>}
          {selected.id === missionPoi && <Text style={styles.mission}>🚩 Lieu de votre mission en cours.</Text>}
          {selected.region === 'corail' && <Button label="Ouvrir le plan de Port Corail" color={colors.pink} onPress={onOpenCity} />}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: '#04182A' },
  marker: { position: 'absolute', width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(11,7,22,0.88)', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  markerOn: { borderColor: colors.pink, backgroundColor: colors.pink },
  flag: { position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  sheet: { position: 'absolute', left: 10, right: 10, bottom: 10, backgroundColor: colors.surface, borderRadius: 20, padding: 14, gap: 8, borderWidth: 1, borderColor: colors.border },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 13 },
  desc: { color: colors.text, fontSize: 14, lineHeight: 20 },
  region: { color: colors.textMuted, fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  mission: { color: colors.pink, fontWeight: '700' },
});
