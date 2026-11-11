import { useState } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MapFrame } from '../components/MapFrame';
import { Chip, ChipRow, styles } from '../components/ui';
import { RESERVES, SPECIES } from '../data/game';
import { DEFAULT_MAP_URLS, isHubOnly, isMapUrl, mapUrlFor } from '../logic/maps';
import type { ReserveId } from '../logic/types';
import { useCarnet } from '../state/CarnetProvider';
import { colors, fonts } from '../theme';

function SmallButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        paddingHorizontal: 12,
        minHeight: 40,
        justifyContent: 'center',
        borderRadius: 10,
        backgroundColor: primary ? colors.accent : colors.surfaceAlt,
        borderWidth: primary ? 0 : 1,
        borderColor: colors.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ color: primary ? colors.onAccent : colors.text, fontFamily: fonts.semibold, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

/** Seules les deux réserves de chasse ont une carte : New Laurentia et Kilimaya Reserve. */
const MAP_RESERVES = RESERVES.filter((r) => SPECIES.some((s) => s.reserveId === r.id));

export default function CarteScreen() {
  const { state, setMapUrl } = useCarnet();
  const [reserve, setReserve] = useState<ReserveId>(
    MAP_RESERVES.find((r) => r.id === state.lastReserveId)?.id ?? 'new-laurentia',
  );
  const url = mapUrlFor(reserve, state.mapUrls);
  const [current, setCurrent] = useState(url);
  const [paste, setPaste] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const reserveName = RESERVES.find((r) => r.id === reserve)?.name ?? '';
  const hub = isHubOnly(reserve, state.mapUrls);
  const canSave = isMapUrl(current) && current !== url && !current.replace(/\/+$/, '').endsWith('way-of-the-hunter-2');

  function choose(r: ReserveId) {
    setReserve(r);
    setCurrent(mapUrlFor(r, state.mapUrls));
    setPaste(null);
    setMsg(null);
  }

  function saveUrl(u: string) {
    const clean = u.trim();
    if (!isMapUrl(clean)) {
      setMsg('Lien refusé : il doit commencer par https://www.shackmaps.com/');
      return;
    }
    setMapUrl(reserve, clean === DEFAULT_MAP_URLS[reserve] ? undefined : clean);
    setCurrent(clean);
    setPaste(null);
    setMsg(`Carte enregistrée pour ${reserveName}.`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      <View style={{ padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <ChipRow>
          {MAP_RESERVES.map((r) => (
            <Chip key={r.id} label={`${r.name} · ${r.region}`} selected={reserve === r.id} onPress={() => choose(r.id)} />
          ))}
        </ChipRow>
        {hub ? (
          <Text style={[styles.muted, { color: colors.accent }]}>
            Choisissez la carte « {reserveName} » sur le site, puis touchez « Enregistrer cette carte ».
          </Text>
        ) : null}
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          {canSave ? <SmallButton primary label="Enregistrer cette carte" onPress={() => saveUrl(current)} /> : null}
          <SmallButton label="Ouvrir dans le navigateur" onPress={() => Linking.openURL(current).catch(() => {})} />
          <SmallButton label={paste === null ? 'Coller un lien' : 'Annuler'} onPress={() => setPaste(paste === null ? '' : null)} />
          {state.mapUrls[reserve] ? (
            <SmallButton
              label="Lien par défaut"
              onPress={() => {
                setMapUrl(reserve, undefined);
                setCurrent(DEFAULT_MAP_URLS[reserve]);
                setMsg(null);
              }}
            />
          ) : null}
        </View>
        {paste !== null ? (
          <View style={styles.row}>
            <TextInput
              value={paste}
              onChangeText={setPaste}
              placeholder="https://www.shackmaps.com/way-of-the-hunter-2/…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[styles.input, { flex: 1 }]}
            />
            <SmallButton primary label="OK" onPress={() => saveUrl(paste)} />
          </View>
        ) : null}
        {msg ? <Text style={[styles.muted, { color: colors.olive }]}>{msg}</Text> : null}
      </View>
      <MapFrame key={`${reserve}:${url}`} url={url} onUrlChange={setCurrent} />
      <Text style={[styles.muted, { fontSize: 11, textAlign: 'center', paddingVertical: 4 }]}>
        Carte interactive : Shackmaps (shacknews.com) — site tiers, affiché tel quel.
      </Text>
    </SafeAreaView>
  );
}
