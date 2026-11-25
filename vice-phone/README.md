# NeonCell — simulateur de téléphone

Application Android (Expo SDK 58) qui imite le smartphone d’un personnage de jeu en monde ouvert,
dans une ville fictive ensoleillée : **Port Corail**.

Application de fan **non officielle** : tous les personnages, lieux et marques sont inventés ; aucun nom,
logo, image ni son d’un jeu existant n’est utilisé.

## La Cavale : l’histoire

Une histoire en **5 chapitres** et **≈ 60 heures en temps réel**, jouée par SMS, appels et missions,
dans l’**État de Solenne** (fictif). Les messages arrivent au fil des heures, avec une notification
quand l’appli est fermée. Un rythme **rapide** (≈ 1 h) est proposé dans l’appli La Cavale.

**9 personnages importants** : toi, Mara (ta partenaire, tout juste libérée), Teo (ton meilleur ami
complotiste), Boyd « le Pélican » (contrebandier des Îles Coquillages), Santos Vidal (braqueur),
Big Momo (figure du Vieux Port), Kenzo (producteur) et les Sirènes, Nina et Jojo (duo de rappeuses).

Chapitres : 1. Sortie de cellule · 2. Les Îles · 3. Néons et Sirènes · 4. Le coup · 5. La dernière marée.
Choix qui comptent (confiance de Mara, réputation, alliances), missions chronométrées, avis de
recherche (0 à 5 étoiles), objectifs d’argent, **5 fins**. Tout est inventé.

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
| Radio | 5 stations (synthwave, lo-fi, latino, trap, plage) avec musique **originale**, animateurs et titres fictifs ; la musique continue d’une appli à l’autre et baisse pendant les appels |
| Appareil photo | Vraie caméra (avant/arrière) avec 7 filtres : coucher de soleil, néon, océan, noir & blanc, VHS 86, carte postale |
| Photos | Galerie, filtre modifiable après coup, publication sur Palmfeed, enregistrement dans la galerie du téléphone |
| La Cavale | Chapitre, objectif, mission en cours, étoiles de recherche, fins découvertes |
| Carte | Carte de l’État de Solenne et plan dessiné de Port Corail : 7 quartiers, route côtière, pont, 13 lieux, GPS qui suit les routes, zoom à deux doigts, lieu du boulot en cours |
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

APK (usage personnel) : le workflow GitHub **APK NeonCell** le construit à chaque modification de
`vice-phone/`. Il n'est pas publié en release : on le télécharge depuis la page du build
(onglet **Actions › APK NeonCell › le dernier build › Artifacts**), connecté à GitHub. Il est conservé 30 jours.

## Musique des radios

Les boucles de `assets/radio/` sont composées par synthèse (aucun échantillon, aucune musique existante) :

```bash
python3 scripts/make_radio.py assets/radio   # nécessite numpy et ffmpeg
```

## Structure

- `src/app/` — écrans (Expo Router)
- `src/state/PhoneProvider.tsx` — état du téléphone, sauvegarde et simulation
- `src/data/world.ts` — contacts, dialogues, publications, articles, boulots
- `src/logic/` — choix des réponses et mises en forme (testés dans `scripts/`)
