import * as MediaLibrary from 'expo-media-library';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, type HostInstance, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { DEMO_PHOTO, FilteredPhoto, FILTERS } from '../../components/FilteredPhoto';
import { AppScreen, Button } from '../../components/phone';
import { clock } from '../../logic/format';
import { usePhone } from '../../state/PhoneProvider';
import { colors } from '../../theme';

export default function PhotoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, setPhotoFilter, deletePhoto, publish, buzz } = usePhone();
  const photo = state.photos.find((p) => p.id === id);
  const shot = useRef<HostInstance>(null);
  const [caption, setCaption] = useState('');
  const [info, setInfo] = useState<string | null>(null);

  if (!photo) {
    return (
      <AppScreen title="Photos" color={colors.sun} back="pop">
        <Text style={styles.info}>Photo introuvable.</Text>
      </AppScreen>
    );
  }

  const share = () => {
    publish(caption || '📸 Souvenir de Port Corail', { uri: photo.uri, filter: photo.filter });
    setCaption('');
    router.push('/feed');
  };

  // La photo et son filtre sont « aplatis » en une image, puis rangés dans la galerie du téléphone.
  const saveToDevice = async () => {
    if (Platform.OS === 'web') {
      setInfo('L’enregistrement dans la galerie fonctionne sur le téléphone Android.');
      return;
    }
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) {
        setInfo('Autorisation refusée : la photo reste dans NeonCell.');
        return;
      }
      const uri = await captureRef(shot, { format: 'jpg', quality: 0.9, result: 'tmpfile' });
      await MediaLibrary.Asset.create(uri);
      buzz('success');
      setInfo('Photo enregistrée dans la galerie du téléphone ✅');
    } catch {
      setInfo('Impossible d’enregistrer la photo.');
    }
  };

  const remove = () => {
    const run = () => {
      deletePhoto(photo.id);
      router.back();
    };
    if (Platform.OS === 'web') return run();
    Alert.alert('Supprimer la photo ?', 'Elle sera retirée de NeonCell.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: run },
    ]);
  };

  return (
    <AppScreen
      title={`Photo · ${clock(photo.at)}`}
      color={colors.sun}
      back="pop"
      right={
        <Pressable onPress={remove} hitSlop={10} accessibilityLabel="Supprimer">
          <Text style={{ fontSize: 20 }}>🗑️</Text>
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={{ padding: 14, gap: 14 }}>
        <View ref={shot} collapsable={false} style={styles.frame}>
          <FilteredPhoto uri={photo.uri} filter={photo.filter} style={StyleSheet.absoluteFill} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => {
                buzz();
                setPhotoFilter(photo.id, f.id);
              }}
              style={{ alignItems: 'center', width: 64, gap: 4 }}
              accessibilityLabel={`Filtre ${f.name}`}
            >
              <FilteredPhoto uri={photo.uri} filter={f.id} style={[styles.thumb, photo.filter === f.id && { borderColor: colors.sun }]} />
              <Text style={[styles.thumbLabel, photo.filter === f.id && { color: colors.sun }]} numberOfLines={1}>
                {f.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Légende pour Palmfeed…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          maxLength={200}
        />
        <Button label="🌴 Publier sur Palmfeed" onPress={share} color={colors.pink} />
        <Button label="Enregistrer dans la galerie du téléphone" onPress={saveToDevice} color={colors.sun} outline />
        {info && <Text style={styles.info}>{info}</Text>}
        {photo.uri === DEMO_PHOTO && <Text style={styles.info}>Photo de démonstration.</Text>}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 0.75, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' },
  thumb: { width: 58, height: 58, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  thumbLabel: { color: colors.text, fontSize: 10 },
  input: { color: colors.text, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  info: { color: colors.textMuted, textAlign: 'center' },
});
