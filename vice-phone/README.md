# NeonCell — simulateur de téléphone

Application Android (Expo SDK 58) qui imite le smartphone d’un personnage de jeu en monde ouvert,
dans une ville fictive ensoleillée : **Port Corail**.

Application de fan **non officielle** : tous les personnages, lieux et marques sont inventés ; aucun nom,
logo, image ni son d’un jeu existant n’est utilisé.

## Applis du téléphone

| Appli | Ce qu’elle fait |
| --- | --- |
| Écran de verrouillage | Heure, notifications en attente, glisser vers le haut pour ouvrir |
| Messages | Conversations avec 6 contacts qui répondent selon les mots clés (« en train d’écrire… ») |
| Téléphone / Contacts | Clavier, appels sortants et **entrants**, répliques en sous-titres, appels manqués |
| Palmfeed | Réseau social parodique : publier, aimer, nouvelles publications en direct |
| Corail Info | Actualités parodiques de Port Corail |
| Banque Flamant | Solde, opérations, virements aux contacts (qui réagissent) |
| Boulots | Petits boulots chronométrés, payés sur le compte en banque |
| Réglages | Prénom, fond d’écran, vibrations, verrouillage, réinitialisation |

Le téléphone « vit » tout seul : messages spontanés, publications et appels entrants arrivent
toutes les 40 à 90 secondes, avec une notification qui glisse depuis le haut. Tout est enregistré sur l’appareil.

## Commandes

```bash
cd vice-phone
npm install
npx expo start        # puis « a » pour Android (Expo Go) ou « w » pour le web
npm test              # tests de la logique (réponses, formats)
npm run typecheck
npm run lint
```

APK : le workflow GitHub **APK NeonCell** le construit à chaque modification de `vice-phone/`
et le publie dans une release `neoncell-v1.0.<n>`.

## Structure

- `src/app/` — écrans (Expo Router)
- `src/state/PhoneProvider.tsx` — état du téléphone, sauvegarde et simulation
- `src/data/world.ts` — contacts, dialogues, publications, articles, boulots
- `src/logic/` — choix des réponses et mises en forme (testés dans `scripts/`)
