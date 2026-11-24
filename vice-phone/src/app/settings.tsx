import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { AppScreen, Button } from '../components/phone';
import { usePhone } from '../state/PhoneProvider';
import { colors, type WallpaperId, wallpapers } from '../theme';

export default function Settings() {
  const { state, updateSettings, reset, lock } = usePhone();
  const [name, setName] = useState(state.name);

  const confirmReset = () => {
    const run = () => {
      reset();
      lock();
      router.replace('/');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Effacer messages, publications, argent et historique ?')) run();
      return;
    }
    Alert.alert('Réinitialiser le téléphone', 'Effacer messages, publications, argent et historique ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Réinitialiser', style: 'destructive', onPress: run },
    ]);
  };

  return (
    <AppScreen title="Réglages" color="#8A80A8">
      <ScrollView contentContainerStyle={{ padding: 14, gap: 18 }}>
        <View style={styles.section}>
          <Text style={styles.label}>Votre prénom</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            onEndEditing={() => updateSettings({ name: name.trim() || 'Alex' })}
            onBlur={() => updateSettings({ name: name.trim() || 'Alex' })}
            maxLength={20}
            style={styles.input}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Fond d’écran</Text>
          <View style={styles.walls}>
            {(Object.keys(wallpapers) as WallpaperId[]).map((id) => (
              <Pressable key={id} onPress={() => updateSettings({ wallpaper: id })} style={{ alignItems: 'center', gap: 6, width: '22%' }}>
                <LinearGradient colors={wallpapers[id].colors} style={[styles.wall, state.wallpaper === id && styles.wallOn]} />
                <Text style={styles.wallName} numberOfLines={1}>
                  {wallpapers[id].name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.section, styles.row]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Vibrations</Text>
            <Text style={styles.hint}>Touches, notifications et sonneries.</Text>
          </View>
          <Switch value={state.haptics} onValueChange={(v) => updateSettings({ haptics: v })} trackColor={{ true: colors.pink, false: colors.border }} />
        </View>

        <View style={[styles.section, styles.row]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Sons</Text>
            <Text style={styles.hint}>Notifications, sonnerie, missions.</Text>
          </View>
          <Switch value={state.sound} onValueChange={(v) => updateSettings({ sound: v })} trackColor={{ true: colors.pink, false: colors.border }} />
        </View>

        <Button
          label="Verrouiller l’écran"
          color={colors.purple}
          onPress={() => {
            lock();
            router.replace('/');
          }}
        />
        <Button label="Réinitialiser le téléphone" color={colors.red} outline onPress={confirmReset} />

        <Text style={styles.about}>
          NeonCell 2.0 · Corail OS{'\n'}Simulateur de téléphone dans un univers fictif inspiré des jeux en monde ouvert. Application de fan non officielle, sans lien avec un éditeur de jeux vidéo. Tous les personnages, lieux et marques sont inventés.
        </Text>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: colors.surface, borderRadius: 18, padding: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { color: colors.text, fontSize: 16, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  input: { color: colors.text, backgroundColor: colors.surfaceAlt, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16 },
  walls: { flexDirection: 'row', justifyContent: 'space-between' },
  wall: { width: '100%', aspectRatio: 0.55, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  wallOn: { borderColor: colors.text },
  wallName: { color: colors.textMuted, fontSize: 11 },
  about: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 10 },
});
