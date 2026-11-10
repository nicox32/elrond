# Carnet de chasse — Way of the Hunter 2

Appli Android compagnon (Expo SDK 58) pour noter ses chasses dans Way of the Hunter 2, suivre ses trophées et
choisir son arme. Tout reste sur le téléphone, hors ligne.

## V1
- **Journal** : saisie rapide d'une chasse (réserve, espèce, arme, distance, zone touchée, score, photo, notes),
  liste filtrable par réserve, statistiques (prélèvements, espèces chassées, plus long tir).
- **Trophées** : meilleur score par espèce, progression sur les 29 espèces, liste des trophées à exposer au pavillon.
- **Armurerie** : armes du jeu avec leur calibre, armes possédées, statistiques par arme, ajout d'armes manquantes.
- **Espèces** : réserves et animaux (v1.4), gibier dangereux, calibres indicatifs et armes adaptées parmi les vôtres.
- **Sauvegarde** : export / import des données en texte JSON.

Données du jeu dans `src/data/game.ts` (patch notes Nine Rocks Games et wikis de joueurs) : à mettre à jour après
chaque patch.

## Commandes
```bash
npm install
npx expo start       # développement (Expo Go)
npm test             # tests de la logique
npm run typecheck
npm run lint
```

## APK
Le workflow GitHub `APK Carnet de chasse` construit l'APK à chaque modification de ce dossier et le publie dans une
release `carnet-chasse-v1.0.<n>` (onglet Releases du dépôt).
