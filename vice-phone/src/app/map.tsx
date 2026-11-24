import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, type GestureResponderEvent, type LayoutChangeEvent, PanResponder, type PanResponderInstance, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Polygon, Polyline, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { AppScreen, Button } from '../components/phone';
import { StateMap } from '../components/StateMap';
import { DISTRICTS, ISLAND, LAND, MAP_H, MAP_W, NODES, type Poi, type PoiCategory, poiById, POIS, type Pt, ROADS } from '../data/map';
import { JOBS } from '../data/world';
import { formatDistance, route } from '../logic/map';
import { usePhone } from '../state/PhoneProvider';
import { colors } from '../theme';

const pts = (p: Pt[]) => p.map(([x, y]) => `${x},${y}`).join(' ');

const CATS: { id: PoiCategory | 'tout'; label: string }[] = [
  { id: 'tout', label: 'Tout' },
  { id: 'sorties', label: 'Sorties' },
  { id: 'services', label: 'Services' },
  { id: 'lieux', label: 'Lieux' },
];

const MIN_ZOOM = 1;
const MAX_ZOOM = 3.5;

export default function MapScreen() {
  const params = useLocalSearchParams<{ poi?: string; view?: string }>();
  const [view, setView] = useState<'city' | 'state'>(params.view === 'state' ? 'state' : 'city');
  const { state, buzz } = usePhone();
  const home = poiById('maison')!;
  const cityPoi = params.view === 'state' ? undefined : params.poi;
  const [selected, setSelected] = useState<Poi | null>(() => (cityPoi ? (poiById(cityPoi) ?? null) : null));
  const [gps, setGps] = useState<string | null>(cityPoi ?? null);
  const [cat, setCat] = useState<PoiCategory | 'tout'>('tout');
  const [box, setBox] = useState({ w: 0, h: 0 });

  const storyMission = state.story.mission?.def;
  const missionPoi = storyMission?.map === 'city' ? storyMission.poi : undefined;
  const activeJob = state.activeJob ? JOBS.find((j) => j.id === state.activeJob!.id) : undefined;
  const target = gps ? poiById(gps) : undefined;
  const itinerary = useMemo(() => (target ? route(home.at, target.at) : null), [target, home.at]);

  // Échelle de base : la largeur de la carte remplit l’écran.
  const base = box.w ? box.w / MAP_W : 0;

  // Caméra de la carte (déplacement, zoom, gestes) : un objet stable, manipulé hors du rendu.
  const [cam] = useState(() => new MapCamera());
  const { tx, ty, zoom } = cam;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width === box.w && height === box.h) return;
    const first = box.w === 0;
    cam.resize(width, height);
    setBox({ w: width, h: height });
    // Premier affichage : centré sur le lieu demandé ou sur votre appartement.
    if (first) cam.centerOn((cityPoi && poiById(cityPoi)?.at) || home.at, 1.6, false);
  };
  const centerOn = (p: Pt, z?: number) => cam.centerOn(p, z);
  const zoomBy = (f: number) => cam.zoomBy(f);
  const pan = cam.gestures;

  const select = (p: Poi) => {
    buzz();
    setSelected(p);
    centerOn(p.at);
  };

  const visible = POIS.filter((p) => p.category === 'maison' || cat === 'tout' || p.category === cat);
  const info = selected ? route(home.at, selected.at) : null;

  // Halo qui pulse autour de votre position.
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const toggle = (
    <Pressable onPress={() => setView((v) => (v === 'city' ? 'state' : 'city'))} hitSlop={10} style={styles.toggle} accessibilityLabel={view === 'city' ? 'Carte de l’État' : 'Plan de la ville'}>
      <Ionicons name={view === 'city' ? 'earth' : 'business'} size={16} color={colors.background} />
      <Text style={styles.toggleText}>{view === 'city' ? 'État' : 'Ville'}</Text>
    </Pressable>
  );

  if (view === 'state') {
    return (
      <AppScreen title="Carte · Solenne" color={colors.cyan} right={toggle}>
        <StateMap initial={params.view === 'state' ? params.poi : undefined} missionPoi={storyMission?.map === 'state' ? storyMission.poi : undefined} onOpenCity={() => setView('city')} />
      </AppScreen>
    );
  }

  return (
    <AppScreen title="Carte · Port Corail" color={colors.cyan} right={toggle}>
      <View style={{ flex: 1 }}>
        <View style={styles.mapBox} onLayout={onLayout} {...pan.panHandlers}>
          {base > 0 && (
            <Animated.View
              style={{
                width: MAP_W * base,
                height: MAP_H * base,
                transformOrigin: 'top left',
                transform: [{ translateX: tx }, { translateY: ty }, { scale: zoom }],
              }}
            >
              <Svg width={MAP_W * base} height={MAP_H * base} viewBox={`0 0 ${MAP_W} ${MAP_H}`}>
                <Defs>
                  <LinearGradient id="sea" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#0B3D5C" />
                    <Stop offset="1" stopColor="#062238" />
                  </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={MAP_W} height={MAP_H} fill="url(#sea)" />
                {/* Vagues décoratives */}
                {Array.from({ length: 12 }, (_, i) => (
                  <Polyline key={i} points={`${780 + (i % 3) * 60},${80 + i * 110} ${800 + (i % 3) * 60},${72 + i * 110} ${820 + (i % 3) * 60},${80 + i * 110}`} stroke="#1E6A8E" strokeWidth={3} fill="none" />
                ))}
                {/* Plage puis terre */}
                <Polygon points={pts(LAND)} fill="#E9C48A" stroke="#E9C48A" strokeWidth={30} strokeLinejoin="round" />
                <Polygon points={pts(ISLAND)} fill="#E9C48A" stroke="#E9C48A" strokeWidth={24} strokeLinejoin="round" />
                <Polygon points={pts(LAND)} fill="#1C1530" />
                {DISTRICTS.map((d) => (
                  <Polygon key={d.id} points={pts(d.poly)} fill={d.color} fillOpacity={0.28} stroke={d.color} strokeOpacity={0.5} strokeWidth={2} />
                ))}
                {/* Routes : bordure puis chaussée */}
                {ROADS.map((r) => (
                  <Polyline key={`b${r.a}${r.b}`} points={pts([NODES[r.a], NODES[r.b]])} stroke={r.kind === 'bridge' ? '#5C4A7A' : '#0E0A1A'} strokeWidth={r.kind === 'highway' ? 26 : r.kind === 'bridge' ? 22 : 18} strokeLinecap="round" />
                ))}
                {ROADS.map((r) => (
                  <Polyline key={`r${r.a}${r.b}`} points={pts([NODES[r.a], NODES[r.b]])} stroke={r.kind === 'highway' ? '#E8B04B' : r.kind === 'bridge' ? '#B8A6D9' : '#4A3F66'} strokeWidth={r.kind === 'highway' ? 14 : 10} strokeLinecap="round" />
                ))}
                {DISTRICTS.map((d) => (
                  <SvgText key={`t${d.id}`} x={d.label[0]} y={d.label[1]} fill="#FFFFFF" fillOpacity={0.75} fontSize={22} fontWeight="bold" textAnchor="middle">
                    {d.name.toUpperCase()}
                  </SvgText>
                ))}
                <SvgText x={870} y={300} fill="#5FA8D3" fontSize={30} fontStyle="italic" textAnchor="middle">
                  Océan
                </SvgText>
                <SvgText x={690} y={1035} fill="#B8A6D9" fontSize={18} textAnchor="middle" rotation={0}>
                  Pont de la Baie
                </SvgText>
                {/* Itinéraire GPS */}
                {itinerary && (
                  <G>
                    <Polyline points={pts(itinerary.points)} stroke="#FF3D8B" strokeOpacity={0.35} strokeWidth={22} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                    <Polyline points={pts(itinerary.points)} stroke="#FF3D8B" strokeWidth={9} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                  </G>
                )}
                <Circle cx={home.at[0]} cy={home.at[1]} r={10} fill="#2DE2E6" stroke="#fff" strokeWidth={4} />
              </Svg>

              <Animated.View
                pointerEvents="none"
                style={[
                  styles.halo,
                  {
                    left: home.at[0] * base - 20,
                    top: home.at[1] * base - 20,
                    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.4] }) }],
                  },
                ]}
              />

              {visible
                .filter((p) => p.id !== 'maison')
                .map((p) => {
                  const isTarget = p.id === gps || p.id === missionPoi;
                  const isSel = selected?.id === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => select(p)}
                      style={[styles.marker, { left: p.at[0] * base - 17, top: p.at[1] * base - 17 }, (isSel || isTarget) && styles.markerOn]}
                      hitSlop={6}
                      accessibilityLabel={p.name}
                    >
                      <Text style={{ fontSize: 16 }}>{p.emoji}</Text>
                    </Pressable>
                  );
                })}
            </Animated.View>
          )}
        </View>

        {/* Filtres et zoom par-dessus la carte */}
        <View style={styles.chips} pointerEvents="box-none">
          {CATS.map((c) => (
            <Pressable key={c.id} onPress={() => setCat(c.id)} style={[styles.chip, cat === c.id && styles.chipOn]}>
              <Text style={[styles.chipText, cat === c.id && { color: colors.background }]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.zoom}>
          <Pressable onPress={() => zoomBy(1.4)} style={styles.zoomBtn} accessibilityLabel="Zoomer">
            <Text style={styles.zoomText}>＋</Text>
          </Pressable>
          <Pressable onPress={() => zoomBy(1 / 1.4)} style={styles.zoomBtn} accessibilityLabel="Dézoomer">
            <Text style={styles.zoomText}>－</Text>
          </Pressable>
          <Pressable onPress={() => centerOn(home.at)} style={styles.zoomBtn} accessibilityLabel="Ma position">
            <Text style={styles.zoomText}>◎</Text>
          </Pressable>
        </View>

        {gps && itinerary && target && (
          <View style={styles.gpsBar}>
            <Text style={styles.gpsText} numberOfLines={1}>
              🧭 {target.name} · {formatDistance(itinerary.meters)} · {itinerary.minutes} min
            </Text>
            <Pressable onPress={() => setGps(null)} hitSlop={10} accessibilityLabel="Arrêter le GPS">
              <Text style={styles.gpsStop}>✕</Text>
            </Pressable>
          </View>
        )}

        {selected ? (
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={{ fontSize: 34 }}>{selected.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{selected.name}</Text>
                <Text style={styles.sheetSub}>
                  {DISTRICTS.find((d) => d.poly && inside(selected.at, d.poly))?.name ?? 'Port Corail'}
                  {info && selected.id !== 'maison' ? ` · ${formatDistance(info.meters)} · ${info.minutes} min en voiture` : ''}
                </Text>
              </View>
              <Pressable onPress={() => setSelected(null)} hitSlop={10} accessibilityLabel="Fermer">
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.sheetDesc}>{selected.description}</Text>
            {activeJob && activeJob.poi === selected.id && <Text style={styles.jobHint}>💼 Votre boulot en cours se passe ici.</Text>}
            {missionPoi === selected.id && <Text style={[styles.jobHint, { color: colors.pink }]}>🚩 Mission La Cavale : {storyMission?.title}</Text>}
            <View style={styles.sheetActions}>
              {selected.id !== 'maison' && (
                <View style={{ flex: 1 }}>
                  <Button
                    label={gps === selected.id ? 'GPS activé' : 'Itinéraire GPS'}
                    color={colors.pink}
                    onPress={() => {
                      buzz('success');
                      setGps(selected.id);
                      setSelected(null);
                      centerOn(home.at, 1.2);
                    }}
                  />
                </View>
              )}
              {selected.contactId && (
                <View style={{ flex: 1 }}>
                  <Button label="📞 Appeler" color={colors.green} outline onPress={() => router.push(`/call/${selected.contactId}`)} />
                </View>
              )}
            </View>
          </View>
        ) : (
          activeJob &&
          activeJob.poi &&
          gps !== activeJob.poi && (
            <Pressable style={styles.jobBar} onPress={() => select(poiById(activeJob.poi)!)}>
              <Text style={styles.gpsText}>
                {activeJob.emoji} Boulot en cours : {activeJob.title} — voir le lieu
              </Text>
            </Pressable>
          )
        )}
      </View>
    </AppScreen>
  );
}

type View3 = { x: number; y: number; z: number };

/** Position et zoom de la carte, avec ses gestes : un doigt pour glisser, deux doigts pour zoomer. */
class MapCamera {
  tx = new Animated.Value(0);
  ty = new Animated.Value(0);
  zoom = new Animated.Value(1.6);
  private view: View3 = { x: 0, y: 0, z: 1.6 };
  private box = { w: 0, h: 0 };
  gestures: PanResponderInstance;

  constructor() {
    let start = this.view;
    let pinch = 0;
    const distance = (e: GestureResponderEvent) => {
      const t = e.nativeEvent.touches;
      return t.length < 2 ? 0 : Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
    };
    this.gestures = PanResponder.create({
      onStartShouldSetPanResponder: (e) => e.nativeEvent.touches.length >= 2,
      onMoveShouldSetPanResponder: (e, g) => e.nativeEvent.touches.length >= 2 || Math.abs(g.dx) + Math.abs(g.dy) > 6,
      onPanResponderGrant: (e) => {
        start = { ...this.view };
        pinch = distance(e);
      },
      onPanResponderMove: (e, g) => {
        const d = distance(e);
        if (d) {
          if (!pinch) {
            pinch = d;
            start = { ...this.view };
            return;
          }
          // Zoom à deux doigts autour du centre de l’écran.
          this.set(this.zoomed(start, (start.z * d) / pinch));
        } else if (!pinch) {
          this.set(this.clamp(start.x + g.dx, start.y + g.dy, start.z));
        }
      },
      onPanResponderRelease: () => {
        pinch = 0;
      },
    });
  }

  resize(w: number, h: number) {
    this.box = { w, h };
  }

  private clamp(x: number, y: number, z: number): View3 {
    const { w, h } = this.box;
    const b = w / MAP_W;
    const minX = Math.min(0, w - MAP_W * b * z);
    const minY = Math.min(0, h - MAP_H * b * z);
    return { x: Math.max(minX, Math.min(0, x)), y: Math.max(minY, Math.min(0, y)), z };
  }

  private zoomed(from: View3, z: number): View3 {
    const { w, h } = this.box;
    const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
    const k = nz / from.z;
    return this.clamp(w / 2 - (w / 2 - from.x) * k, h / 2 - (h / 2 - from.y) * k, nz);
  }

  private set(v: View3, animate = false) {
    this.view = v;
    if (!animate) {
      this.tx.setValue(v.x);
      this.ty.setValue(v.y);
      this.zoom.setValue(v.z);
      return;
    }
    const t = (val: Animated.Value, toValue: number) => Animated.timing(val, { toValue, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    Animated.parallel([t(this.tx, v.x), t(this.ty, v.y), t(this.zoom, v.z)]).start();
  }

  centerOn(p: Pt, z = this.view.z, animate = true) {
    const { w, h } = this.box;
    const b = w / MAP_W;
    this.set(this.clamp(w / 2 - p[0] * b * z, h / 2 - p[1] * b * z, z), animate);
  }

  zoomBy(f: number) {
    this.set(this.zoomed(this.view, this.view.z * f), true);
  }
}

/** Le point est-il dans le polygone ? (lancer de rayon) */
function inside([x, y]: Pt, poly: Pt[]) {
  let ok = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ok = !ok;
  }
  return ok;
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.cyan, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  toggleText: { color: colors.background, fontWeight: '800', fontSize: 13 },
  mapBox: { flex: 1, overflow: 'hidden', backgroundColor: '#062238' },
  halo: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: '#2DE2E6' },
  marker: { position: 'absolute', width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(11,7,22,0.85)', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  markerOn: { borderColor: colors.pink, backgroundColor: colors.pink },
  chips: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: 'rgba(11,7,22,0.85)', borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  chipText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  zoom: { position: 'absolute', right: 10, top: 60, gap: 8 },
  zoomBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(11,7,22,0.9)', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  zoomText: { color: colors.text, fontSize: 20, fontWeight: '700' },
  gpsBar: { position: 'absolute', top: 56, left: 10, right: 62, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.pink, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  gpsText: { color: '#fff', fontWeight: '700', flex: 1 },
  gpsStop: { color: '#fff', fontSize: 16, fontWeight: '800' },
  jobBar: { position: 'absolute', bottom: 12, left: 12, right: 12, backgroundColor: '#11876A', borderRadius: 14, padding: 12 },
  sheet: { position: 'absolute', bottom: 10, left: 10, right: 10, backgroundColor: colors.surface, borderRadius: 20, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  sheetSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  close: { color: colors.textMuted, fontSize: 18 },
  sheetDesc: { color: colors.text, fontSize: 14, lineHeight: 20, opacity: 0.9 },
  jobHint: { color: colors.green, fontWeight: '700' },
  sheetActions: { flexDirection: 'row', gap: 10 },
});
