import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { FilteredPhoto } from '../../components/FilteredPhoto';
import { AppScreen, Button } from '../../components/phone';
import { usePhone } from '../../state/PhoneProvider';
import { colors } from '../../theme';

export default function Photos() {
  const { state } = usePhone();
  return (
    <AppScreen title="Photos" color={colors.sun}>
      {state.photos.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 56 }}>🖼️</Text>
          <Text style={styles.emptyText}>Aucune photo pour l’instant.{'\n'}Prenez votre premier souvenir de Port Corail !</Text>
          <Button label="Ouvrir l’appareil photo" onPress={() => router.push('/camera')} color={colors.pink} />
        </View>
      ) : (
        <FlatList
          data={state.photos}
          keyExtractor={(p) => p.id}
          numColumns={3}
          contentContainerStyle={{ padding: 2 }}
          renderItem={({ item }) => (
            <Pressable style={styles.cell} onPress={() => router.push(`/photos/${item.id}`)}>
              <FilteredPhoto uri={item.uri} filter={item.filter} style={StyleSheet.absoluteFill} />
            </Pressable>
          )}
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 30 },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  cell: { width: '33.333%', aspectRatio: 0.75, borderWidth: 1, borderColor: colors.background },
});
