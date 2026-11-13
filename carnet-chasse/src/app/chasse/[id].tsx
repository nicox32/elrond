import { router, Stack, useLocalSearchParams } from "expo-router";
import { type ReactNode, useState } from "react";
import { Image, Text, View } from "react-native";

import {
  Button,
  Card,
  Empty,
  Screen,
  SectionTitle,
  styles, PaperTag } from "../../components/ui";
import {
  findWeapon,
  getReserve,
  getSpecies,
  SHOT_ZONE_ADVICE,
  SHOT_ZONE_LABELS,
  TROPHY_TYPE_LABELS,
} from "../../data/game";
import { checkEnergy, energyKindFor, getSpeciesInfo } from "../../data/speciesInfo";
import {
  computeNetWeight,
  damagedOrgans,
  estimateMeatPrice,
  organShots,
  organWarnings,
  ratingHints,
  ratingMeaning,
  formatDuration,
  isRareCoat,
} from "../../logic/details";
import { formatTime } from "../../logic/schedule";
import { formatDateTime, formatNumber, formatScore } from "../../logic/stats";
import { useCarnet } from "../../state/CarnetProvider";
import { colors, fonts } from "../../theme";

function Line({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View
      style={[
        styles.row,
        { justifyContent: "space-between", paddingVertical: 6 },
      ]}
    >
      <Text style={styles.muted}>{label}</Text>
      <Text style={[styles.text, { flexShrink: 1, textAlign: "right" }]}>
        {value}
      </Text>
    </View>
  );
}

/** Bloc affiché seulement s'il contient au moins une valeur. */
function Block({
  title,
  values,
  children,
}: {
  title: string;
  values: (string | undefined)[];
  children: ReactNode;
}) {
  if (!values.some(Boolean)) return null;
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <Card>{children}</Card>
    </>
  );
}

const n = (v: number | undefined, unit = "", digits = 2) =>
  v === undefined
    ? undefined
    : `${String(Math.round(v * 10 ** digits) / 10 ** digits).replace(".", ",")}${unit}`;
const yesNo = (v: boolean | undefined) =>
  v === undefined ? undefined : v ? "Oui" : "Non";

export default function HuntScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, deleteHunt, setPlaced } = useCarnet();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hunt = state.hunts.find((h) => h.id === id);

  if (!hunt) {
    return (
      <Screen top={false}>
        <Empty>Cette chasse n&apos;existe plus.</Empty>
      </Screen>
    );
  }

  const species = getSpecies(hunt.speciesId);
  const weapon = findWeapon(hunt.weaponId, state.customWeapons);
  const zoneAdvice = hunt.shotZone ? SHOT_ZONE_ADVICE[hunt.shotZone] : undefined;
  const ratingNotes = ratingHints({
    rating: hunt.huntRating,
    oneShot: (hunt.moreShots?.length ?? 0) > 0 ? false : undefined,
    zone: zoneAdvice && hunt.shotZone ? { label: SHOT_ZONE_LABELS[hunt.shotZone], good: zoneAdvice.good } : undefined,
    energy: checkEnergy(getSpeciesInfo(hunt.speciesId, state.speciesSheets), energyKindFor(weapon?.type), hunt.impactEnergyJ),
    organWarnings: organWarnings(organShots(hunt)),
    trackingDistanceM: hunt.trackingDistanceM,
    trackingTimeSec: hunt.trackingTimeSec,
    weightKg: hunt.weightKg,
    shotDegradationKg: hunt.shotDegradationKg,
  });
  const shots = organShots(hunt).map((d) => damagedOrgans({ organs: d }));
  const net = hunt.netWeightKg ?? computeNetWeight(hunt);
  const meat =
    hunt.salePrice === undefined ? estimateMeatPrice(hunt) : undefined;

  const animal = {
    sexe: hunt.sex ? (hunt.sex === "male" ? "Mâle" : "Femelle") : undefined,
    age: n(hunt.ageYears, " ans", 0),
    classe: n(hunt.animalClass, "", 0),
    condition: n(hunt.conditionPct, " %", 1),
    poids: n(hunt.weightKg, " kg"),
  };
  const tir = {
    type: hunt.ammoType,
    munition:
      [hunt.ammo, hunt.ammoClass ? `(classe ${hunt.ammoClass})` : undefined]
        .filter(Boolean)
        .join(" ") || undefined,
    heure:
      hunt.killTimeMin !== undefined ? formatTime(hunt.killTimeMin) : undefined,
    traque: n(hunt.trackingDistanceM, " m", 0),
    temps:
      hunt.trackingTimeSec !== undefined
        ? formatDuration(hunt.trackingTimeSec)
        : undefined,
    energie: n(hunt.impactEnergyJ, " J", 0),
    vent: n(hunt.windMs, " m/s", 1),
    detecte: yesNo(hunt.hunterDetected),
    chien: yesNo(hunt.dogUsed),
  };
  const prix = {
    tps: n(hunt.timeDegradationKg, " kg"),
    tirDeg: n(hunt.shotDegradationKg, " kg"),
    dechets: n(hunt.butcherWasteKg, " kg"),
    net:
      n(net, " kg") &&
      `${n(net, " kg")}${hunt.netWeightKg === undefined ? " (calculé)" : ""}`,
    kg: n(hunt.pricePerKg, " /kg"),
    vente:
      hunt.salePrice !== undefined
        ? n(hunt.salePrice, "", 0)
        : meat !== undefined
          ? `≈ ${meat} (viande, calculé)`
          : undefined,
  };

  return (
    <Screen top={false}>
      <Stack.Screen options={{ title: species?.name ?? "Chasse" }} />
      {hunt.photoUri ? (
        <Image
          source={{ uri: hunt.photoUri }}
          style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 14 }}
          resizeMode="cover"
        />
      ) : null}

      <Card>
        <Text style={styles.title}>{species?.name ?? hunt.speciesId}</Text>
        {species ? <Text style={styles.muted}>{species.gameName}</Text> : null}
        <View style={[styles.row, { marginTop: 8, flexWrap: "wrap", gap: 14 }]}>
          {hunt.trophyScore !== undefined ? (
            <Text
              style={{
                color: colors.gold,
                fontSize: 40,
                fontFamily: fonts.display,
              }}
            >
              {formatScore(hunt.trophyScore)} pts
            </Text>
          ) : null}
          {hunt.huntRating ? <PaperTag size="lg">{hunt.huntRating}</PaperTag> : null}
          {hunt.trophyStars ? (
            <Text style={{ color: colors.gold, fontSize: 22 }}>
              {"★".repeat(hunt.trophyStars)}
              <Text style={{ color: colors.border }}>
                {"★".repeat(5 - hunt.trophyStars)}
              </Text>
            </Text>
          ) : null}
        </View>
      </Card>

      {isRareCoat(hunt.coat) ? (
        <Card
          style={{
            borderColor: colors.gold,
            backgroundColor: colors.goldSoft,
            gap: 2,
          }}
        >
          <Text style={[styles.strong, { color: colors.gold }]}>
            ✦ Trophée Ultime · fourrure {hunt.coat?.toLowerCase()}
          </Text>
          <Text style={styles.text}>
            {hunt.outcome === "empaille"
              ? "Empaillé : une pièce maîtresse pour votre collection."
              : "Condition rare : le jeu conseille de l’empailler, même si cela coûte cher."}
          </Text>
        </Card>
      ) : null}

      {!getSpeciesInfo(hunt.speciesId, state.speciesSheets) ? (
        <Card
          onPress={() =>
            router.push({
              pathname: "/espece/fiche",
              params: { id: hunt.speciesId },
            })
          }
          style={{ borderColor: colors.gold, gap: 2 }}
        >
          <Text style={[styles.strong, { color: colors.gold }]}>
            Fiche de l&apos;espèce débloquée en jeu
          </Text>
          <Text style={styles.muted}>
            Recopiez la page de l&apos;encyclopédie (routine, énergie
            recommandée…) pour en profiter partout dans l&apos;appli →
          </Text>
        </Card>
      ) : null}

      <Card>
        <Line label="Date" value={formatDateTime(hunt.date)} />
        <Line label="Réserve" value={getReserve(hunt.reserveId)?.name} />
        <Line
          label="Arme"
          value={
            weapon ? `${weapon.name} (${weapon.caliber})` : "Arme supprimée"
          }
        />
        <Line
          label="Distance de tir"
          value={
            hunt.distanceM !== undefined
              ? `${formatNumber(hunt.distanceM)} m`
              : undefined
          }
        />
        <Line
          label="Zone touchée"
          value={hunt.shotZone ? SHOT_ZONE_LABELS[hunt.shotZone] : undefined}
        />
        <Line label="Tué d'un seul tir" value={hunt.oneShot ? "Oui" : "Non"} />
        <Line label="Trophée" value={TROPHY_TYPE_LABELS[hunt.trophyType]} />
        <Line
          label="Décision"
          value={
            hunt.outcome
              ? hunt.outcome === "vendu"
                ? "Vendu"
                : "Empaillé"
              : undefined
          }
        />
        <Line label="Mode" value={hunt.mode === "coop" ? "Coop" : "Solo"} />
        <Line label="Pavillon" value={hunt.toPlace ? "À exposer" : undefined} />
      </Card>

      <Block
        title="Animal"
        values={[...Object.values(animal), hunt.coat, hunt.rarity]}
      >
        <Line label="Sexe" value={animal.sexe} />
        <Line label="Âge" value={animal.age} />
        <Line label="Classe" value={animal.classe} />
        <Line label="Condition physique" value={animal.condition} />
        <Line label="Poids" value={animal.poids} />
        <Line label="Robe" value={hunt.coat} />
        <Line label="Rareté" value={hunt.rarity} />
      </Block>

      <Block title="Tir" values={[...Object.values(tir), hunt.weather]}>
        <Line label="Type de munitions" value={tir.type} />
        <Line label="Munition" value={tir.munition} />
        <Line label="Heure de la mort" value={tir.heure} />
        <Line label="Distance de traque" value={tir.traque} />
        <Line label="Temps de traque" value={tir.temps} />
        <Line label="Énergie à l'impact" value={tir.energie} />
        <Line label="Vent" value={tir.vent} />
        <Line label="Météo" value={hunt.weather} />
        <Line label="Chasseur détecté" value={tir.detecte} />
        <Line label="Chien utilisé" value={tir.chien} />
      </Block>

      {hunt.huntRating && (ratingMeaning(hunt.huntRating) || ratingNotes.length) ? (
        <Card style={{ gap: 6 }}>
          <Text style={styles.strong}>Classement de chasse {hunt.huntRating}</Text>
          {ratingMeaning(hunt.huntRating) ? <Text style={styles.muted}>{ratingMeaning(hunt.huntRating)}</Text> : null}
          {ratingNotes.map((t) => (
            <Text key={t} style={[styles.text, { color: colors.accent }]}>
              • {t}
            </Text>
          ))}
        </Card>
      ) : null}

      {(() => {
        const zone = hunt.shotZone ? SHOT_ZONE_ADVICE[hunt.shotZone] : undefined;
        const warnings = organWarnings(organShots(hunt));
        if (!zone && !warnings.length) return null;
        return (
          <Card style={{ gap: 6, borderColor: zone?.good && !warnings.length ? colors.olive : colors.danger }}>
            {zone ? (
              <Text style={[styles.text, { color: zone.good ? colors.olive : colors.danger }]}>
                {zone.good ? "✓ " : "⚠ "}
                {zone.text}
              </Text>
            ) : null}
            {warnings.map((t) => (
              <Text key={t} style={[styles.text, { color: colors.danger }]}>
                ⚠ {t}
              </Text>
            ))}
          </Card>
        );
      })()}

      {shots.some((o) => o.length) ? (
        <>
          <SectionTitle>Dégâts aux organes</SectionTitle>
          {shots.map((organs, i) =>
            organs.length ? (
              <Card key={i} style={{ gap: 8 }}>
                {shots.length > 1 ? (
                  <Text style={[styles.strong, { color: colors.accent }]}>
                    Tir {i + 1}
                  </Text>
                ) : null}
                {organs.map((o) => (
                  <View key={o.id} style={{ gap: 4 }}>
                    <View
                      style={[styles.row, { justifyContent: "space-between" }]}
                    >
                      <Text style={styles.text}>{o.label}</Text>
                      <Text
                        style={[styles.text, { fontFamily: fonts.semibold }]}
                      >
                        {n(o.pct, " %", 1)}
                      </Text>
                    </View>
                    <View
                      style={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: colors.surfaceAlt,
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          width: `${Math.min(100, o.pct)}%`,
                          height: "100%",
                          backgroundColor:
                            o.pct >= 80
                              ? colors.danger
                              : o.pct >= 30
                                ? colors.accent
                                : colors.olive,
                        }}
                      />
                    </View>
                  </View>
                ))}
              </Card>
            ) : null,
          )}
        </>
      ) : null}

      <Block title="Poids et prix" values={Object.values(prix)}>
        <Line label="Poids brut" value={animal.poids} />
        <Line label="Dégradation due au temps" value={prix.tps} />
        <Line label="Dégradation due au tir" value={prix.tirDeg} />
        <Line label="Déchets de découpe" value={prix.dechets} />
        <Line label="Poids après découpe" value={prix.net} />
        <Line label="Prix à l'unité" value={prix.kg} />
        <Line label="Prix de vente" value={prix.vente} />
      </Block>

      {hunt.measurements?.length ? (
        <>
          <SectionTitle>Mesures du trophée</SectionTitle>
          <Card>
            {hunt.measurements.map((m, i) => (
              <Line key={i} label={m.label} value={`${n(m.value, " cm", 1)}`} />
            ))}
          </Card>
        </>
      ) : null}

      {hunt.notes ? (
        <>
          <SectionTitle>Notes</SectionTitle>
          <Card>
            <Text style={styles.text}>{hunt.notes}</Text>
          </Card>
        </>
      ) : null}

      <View style={{ gap: 8, marginTop: 16 }}>
        {hunt.toPlace ? (
          <Button
            label="Marquer comme exposé"
            kind="secondary"
            onPress={() => setPlaced(hunt.id)}
          />
        ) : null}
        <Button
          label="Modifier"
          onPress={() =>
            router.push({
              pathname: "/chasse/edition",
              params: { id: hunt.id },
            })
          }
        />
        {confirmDelete ? (
          <Card style={{ gap: 8, borderColor: colors.danger }}>
            <Text style={styles.text}>
              Supprimer définitivement cette chasse ?
            </Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Annuler"
                  kind="secondary"
                  onPress={() => setConfirmDelete(false)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Supprimer"
                  kind="danger"
                  onPress={() => {
                    deleteHunt(hunt.id);
                    router.back();
                  }}
                />
              </View>
            </View>
          </Card>
        ) : (
          <Button
            label="Supprimer"
            kind="danger"
            onPress={() => setConfirmDelete(true)}
          />
        )}
      </View>
    </Screen>
  );
}
