import { LinearGradient } from 'expo-linear-gradient';
import { Image, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

export type FilterId = 'normal' | 'sunset' | 'neon' | 'noir' | 'vhs' | 'postcard' | 'ocean';

export const FILTERS: { id: FilterId; name: string }[] = [
  { id: 'normal', name: 'Normal' },
  { id: 'sunset', name: 'Coucher de soleil' },
  { id: 'neon', name: 'Néon' },
  { id: 'ocean', name: 'Océan' },
  { id: 'noir', name: 'Noir & blanc' },
  { id: 'vhs', name: 'VHS 86' },
  { id: 'postcard', name: 'Carte postale' },
];

/** Photo de démonstration, utilisée quand l’appareil photo n’est pas disponible (web, émulateur). */
export const DEMO_PHOTO = 'demo:plage';
const DEMO_SOURCE = require('../../assets/demo-photo.jpg');

/** Calques du filtre, posés par-dessus une photo ou l’aperçu de l’appareil. */
export function FilterLayers({ filter, live = false }: { filter: FilterId; live?: boolean }) {
  switch (filter) {
    case 'sunset':
      return (
        <>
          <LinearGradient colors={['#FF3D8B', '#FFB347']} style={[StyleSheet.absoluteFill, { mixBlendMode: 'soft-light', opacity: live ? 0.45 : 0.9 }]} />
          <LinearGradient colors={['rgba(255,120,60,0.35)', 'rgba(255,200,100,0)']} style={StyleSheet.absoluteFill} />
          <Vignette strength={0.45} />
        </>
      );
    case 'neon':
      return (
        <>
          <LinearGradient colors={['#F72585', '#4CC9F0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { mixBlendMode: 'color', opacity: live ? 0.4 : 0.75 }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#3A0CA3', mixBlendMode: 'multiply', opacity: 0.25 }]} />
          <Vignette strength={0.55} />
        </>
      );
    case 'ocean':
      return (
        <>
          <LinearGradient colors={['#02C39A', '#05668D']} style={[StyleSheet.absoluteFill, { mixBlendMode: 'overlay', opacity: live ? 0.45 : 0.8 }]} />
          <Vignette strength={0.35} />
        </>
      );
    case 'noir':
      return (
        <>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#808080', mixBlendMode: 'saturation' }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: live ? 0.05 : 0.1 }]} />
          <Vignette strength={0.6} />
        </>
      );
    case 'vhs':
      return (
        <>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FF0055', mixBlendMode: 'screen', opacity: 0.12, transform: [{ translateX: 3 }] }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#00E5FF', mixBlendMode: 'screen', opacity: 0.1, transform: [{ translateX: -3 }] }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFE8B0', mixBlendMode: 'multiply', opacity: 0.35 }]} />
          <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
            {Array.from({ length: 70 }, (_, i) => (
              <View key={i} style={{ height: 1, marginBottom: 4, backgroundColor: 'rgba(0,0,0,0.22)' }} />
            ))}
          </View>
          <Text style={styles.vhsPlay}>▶ PLAY</Text>
          <Text style={styles.vhsDate}>24 NOV. 1986{'\n'}21:47</Text>
        </>
      );
    case 'postcard':
      return (
        <>
          <LinearGradient colors={['rgba(255,179,71,0.35)', 'rgba(255,61,139,0.2)']} style={[StyleSheet.absoluteFill, { mixBlendMode: 'overlay' }]} />
          <View style={[StyleSheet.absoluteFill, styles.postFrame]} pointerEvents="none" />
          <View style={styles.postBanner} pointerEvents="none">
            <Text style={styles.postSmall}>Bons baisers de</Text>
            <Text style={styles.postBig}>PORT CORAIL</Text>
          </View>
        </>
      );
    default:
      return null;
  }
}

function Vignette({ strength }: { strength: number }) {
  return (
    <>
      <LinearGradient colors={[`rgba(0,0,0,${strength})`, 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', `rgba(0,0,0,${strength})`]} locations={[0, 0.25, 0.75, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <LinearGradient colors={[`rgba(0,0,0,${strength * 0.8})`, 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', `rgba(0,0,0,${strength * 0.8})`]} locations={[0, 0.2, 0.8, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
    </>
  );
}

/** Photo avec son filtre. Le filtre reste modifiable : la photo d’origine n’est jamais altérée. */
export function FilteredPhoto({ uri, filter, style }: { uri: string; filter: FilterId; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ overflow: 'hidden', isolation: 'isolate', backgroundColor: '#000' }, style]}>
      <Image source={uri === DEMO_PHOTO ? DEMO_SOURCE : { uri }} style={styles.fill} resizeMode="cover" />
      <FilterLayers filter={filter} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Taille explicite : une image du paquet porte sa taille d’origine, qui l’emporterait sinon.
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  vhsPlay: { position: 'absolute', top: 14, left: 14, color: '#fff', fontWeight: '900', fontSize: 18, fontFamily: 'monospace', textShadowColor: '#00E5FF', textShadowRadius: 6 },
  vhsDate: { position: 'absolute', bottom: 14, right: 14, color: '#FFD166', fontWeight: '900', fontSize: 16, textAlign: 'right', fontFamily: 'monospace', textShadowColor: '#000', textShadowRadius: 4 },
  postFrame: { borderWidth: 10, borderColor: '#FFF8EC' },
  postBanner: { position: 'absolute', left: 18, bottom: 22, transform: [{ rotate: '-4deg' }] },
  postSmall: { color: '#fff', fontSize: 16, fontStyle: 'italic', fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  postBig: { color: '#FFD166', fontSize: 30, fontWeight: '900', letterSpacing: 1, textShadowColor: '#FF3D8B', textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 },
});
