import { CameraView, useCameraPermissions } from 'expo-camera';
import { Directory, File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEMO_PHOTO, FilteredPhoto, FILTERS, type FilterId, FilterLayers } from '../components/FilteredPhoto';
import { Button, PhoneStatusBar } from '../components/phone';
import { usePhone } from '../state/PhoneProvider';
import { colors } from '../theme';

/** Copie la photo prise dans le dossier de l’appli, pour qu’elle survive au nettoyage du cache. */
async function keepPhoto(uri: string): Promise<string> {
  if (Platform.OS === 'web') return uri;
  try {
    const dir = new Directory(Paths.document, 'photos');
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const dest = new File(dir, `photo-${Date.now()}.jpg`);
    await new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}

export default function Camera() {
  const [permission, requestPermission] = useCameraPermissions();
  const { state, addPhoto, buzz } = usePhone();
  const insets = useSafeAreaInsets();
  const cam = useRef<CameraView>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [filter, setFilter] = useState<FilterId>('sunset');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash] = useState(() => new Animated.Value(0));
  const last = state.photos[0];

  const flashOnce = () => {
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 350, useNativeDriver: true }).start();
  };

  const shoot = async () => {
    if (busy) return;
    setBusy(true);
    buzz('success');
    flashOnce();
    try {
      const pic = await cam.current?.takePictureAsync({ quality: 0.7, skipProcessing: false });
      if (pic?.uri) {
        const id = addPhoto(await keepPhoto(pic.uri), filter);
        router.push(`/photos/${id}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const useDemo = () => {
    buzz('success');
    flashOnce();
    const id = addPhoto(DEMO_PHOTO, filter);
    router.push(`/photos/${id}`);
  };

  const granted = permission?.granted;

  return (
    <View style={styles.root}>
      <PhoneStatusBar />
      <View style={styles.viewfinder}>
        {granted ? (
          <View style={[StyleSheet.absoluteFill, { isolation: 'isolate' }]}>
            <CameraView ref={cam} style={StyleSheet.absoluteFill} facing={facing} onCameraReady={() => setReady(true)} mirror={facing === 'front'} />
            <FilterLayers filter={filter} live />
          </View>
        ) : (
          <View style={styles.noCam}>
            <FilteredPhoto uri={DEMO_PHOTO} filter={filter} style={StyleSheet.absoluteFill} />
            <View style={styles.noCamBox}>
              <Text style={styles.noCamTitle}>📷 Appareil photo</Text>
              <Text style={styles.noCamText}>
                {permission && !permission.canAskAgain
                  ? 'L’accès à l’appareil photo est refusé. Autorisez-le dans les réglages Android, ou essayez les filtres sur la photo de démo.'
                  : 'Autorisez l’appareil photo pour prendre vos propres photos, ou essayez les filtres sur la photo de démo.'}
              </Text>
              {(!permission || permission.canAskAgain) && <Button label="Autoriser l’appareil photo" onPress={requestPermission} />}
            </View>
          </View>
        )}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', opacity: flash }]} />
        <View style={styles.filterName} pointerEvents="none">
          <Text style={styles.filterNameText}>{FILTERS.find((f) => f.id === filter)?.name}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={{ flexGrow: 0 }}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => {
              buzz();
              setFilter(f.id);
            }}
            style={styles.filterItem}
            accessibilityLabel={`Filtre ${f.name}`}
          >
            <FilteredPhoto uri={DEMO_PHOTO} filter={f.id} style={[styles.filterThumb, filter === f.id && styles.filterThumbOn]} />
            <Text style={[styles.filterLabel, filter === f.id && { color: colors.sun }]} numberOfLines={1}>
              {f.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable onPress={() => router.navigate('/home')} style={styles.side} accessibilityLabel="Accueil">
          <Text style={styles.sideText}>✕</Text>
        </Pressable>
        <Pressable
          onPress={granted ? shoot : useDemo}
          disabled={granted ? !ready || busy : false}
          style={({ pressed }) => [styles.shutter, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}
          accessibilityLabel="Prendre une photo"
        >
          <View style={styles.shutterInner} />
        </Pressable>
        {granted ? (
          <Pressable onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} style={styles.side} accessibilityLabel="Changer de caméra">
            <Text style={styles.sideText}>🔄</Text>
          </Pressable>
        ) : (
          <View style={styles.side} />
        )}
      </View>
      {last && (
        <Pressable onPress={() => router.push('/photos')} style={[styles.lastThumb, { bottom: insets.bottom + 110 }]} accessibilityLabel="Voir les photos">
          <FilteredPhoto uri={last.uri} filter={last.filter} style={StyleSheet.absoluteFill} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  viewfinder: { flex: 1, marginHorizontal: 0, overflow: 'hidden', backgroundColor: '#111' },
  noCam: { flex: 1, justifyContent: 'flex-end' },
  noCamBox: { margin: 14, padding: 16, borderRadius: 18, backgroundColor: 'rgba(11,7,22,0.85)', gap: 10 },
  noCamTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  noCamText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  filterName: { position: 'absolute', top: 14, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  filterNameText: { color: '#fff', fontWeight: '700' },
  filters: { paddingHorizontal: 10, paddingVertical: 12, gap: 10 },
  filterItem: { alignItems: 'center', width: 66, gap: 4 },
  filterThumb: { width: 58, height: 58, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  filterThumbOn: { borderColor: colors.sun },
  filterLabel: { color: colors.text, fontSize: 10 },
  bar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: 6 },
  side: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  sideText: { color: '#fff', fontSize: 22 },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
  lastThumb: { position: 'absolute', left: 18, width: 48, height: 48, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: '#fff' },
});
