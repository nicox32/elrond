# Orvia — compte adossé à l'or, à l'argent et au platine

<img src="assets/logo.png" width="160" alt="Logo Orvia : louis d'or" />

Application mobile (Expo / React Native) : un compte dont le solde est détenu en métaux précieux,
aux **cours réels** de l'or, de l'argent et du platine.

<p>
  <img src="docs/compte.png" width="220" alt="Écran du compte" />
  <img src="docs/operations.png" width="220" alt="Achat en onces" />
  <img src="docs/virement.png" width="220" alt="Virement à un membre" />
</p>
<p>
  <img src="docs/confirmation.png" width="220" alt="Confirmation par code" />
  <img src="docs/coffre.png" width="220" alt="Coffre or" />
  <img src="docs/verrouillage.png" width="220" alt="Code d'accès" />
</p>

## Utiliser l'appli dans le navigateur

Version web, sans installation : **https://nicox32.github.io/elrond/**
Dans Chrome, menu ⋮ → **Ajouter à l'écran d'accueil** pour l'ouvrir comme une appli.
(Publiée par `.github/workflows/web.yml` ; GitHub Pages doit être réglé sur la source « GitHub Actions ».)

## Installer sur Android

Téléchargez l'APK depuis votre téléphone :
**https://github.com/nicox32/elrond/releases/latest/download/orvia.apk**

Chaque version publie aussi le même fichier sous le nom `orvia-1.1.<n>.apk` (numéro affiché en bas du Profil),
visible sur https://github.com/nicox32/elrond/releases/latest.

Il est reconstruit automatiquement à chaque modification, numéroté 1.1.<n° de construction> (affiché en bas du
Profil) (voir `.github/workflows/android-apk.yml`), puis ouvert sur
un téléphone Android virtuel (`.github/workflows/test-apk.yml`) : il n'est publié que s'il démarre sans plantage.

Signature : avec la clé Orvia (`plugins/withReleaseSigning.js`) quand les secrets GitHub `ORVIA_KEYSTORE_B64` et
`ORVIA_KEYSTORE_PASSWORD` sont définis, sinon avec la clé de test d'Android. La clé et son mot de passe ne sont
jamais dans Git (dossier `signing/` ignoré).

## Fonctionnalités

- **Cours réels** (source principale gold-api.com, secours Swissquote dans l'appli et le serveur d'alertes) de l'or, de l'argent et du platine (au comptant, en dollars par once, convertis en
  euros par gramme). Actualisés à l'ouverture de l'appli, au retour dans l'appli, à sa fermeture et
  d'un appui sur la barre des cours. Hors ligne, l'appli garde les derniers cours connus et le signale.
- **Cours en direct** des trois métaux sur l'écran du compte, actualisés toutes les 30 s, avec leur
  variation et leur courbe sur les dernières 24 h (voir `docs/cours-en-direct.png`).
- **Trois coffres** : or, argent, platine, avec leur valeur et le détail des mouvements.
- **Achat et vente en euros, en grammes ou en onces troy** (1 oz = 31,1035 g). Affichage au choix
  en grammes ou en onces.
- **Conversion** d'un métal à l'autre.
- **Virements**, sur le modèle des comptes adossés aux métaux :
  - **à un membre** (identifiant, e-mail ou téléphone) : le métal passe de coffre à coffre, immédiat et sans frais ;
  - **vers un IBAN** : le métal est vendu puis les euros partent par virement SEPA (IBAN vérifié).
- **Sécurité** : code à 4 chiffres à chaque ouverture et pour valider chaque virement, déverrouillage
  par empreinte en option, blocage de 30 s après 5 codes faux. Seule une empreinte salée du code est
  conservée, dans le trousseau sécurisé du téléphone.
- **Graphique d'évolution du solde** (24 h, 7 j, 30 j, tout) et **plus-value latente**.
- **Plus-value et impôts** (lien « Détail » sous le solde, ou Profil ; `src/logic/tax.ts`, `docs/plus-value-impots.png`) :
  plus-value latente en euros et en %, avant et après impôt, par métal. Règles françaises 2026 : taxe forfaitaire
  de 11,5 % du prix de vente, ou sur option 37,6 % de la plus-value (19 % + 18,6 % de prélèvements sociaux, taux appliqué par les professionnels depuis 2026) avec
  un abattement de 5 % par an à partir de la 3e année de détention (exonération après 22 ans). Le régime le moins
  cher est retenu pour chaque métal ; durée de détention calculée en premier entré, premier sorti. Estimation
  indicative, sans valeur de conseil fiscal.
- **Impôt retenu automatiquement** à chaque cession, au régime le moins cher (`docs/impots-par-operation.png`) :
  vente (« Tout vendre » en un geste ; en euros, montant reçu après impôt), virement vers un IBAN, paiement ou retrait
  par carte (le commerçant reçoit le montant exact) et conversion entre métaux. L'aperçu de chaque opération indique
  l'impôt et le régime retenu, l'historique aussi. Virement de métal à un membre ou versement sur un compte enfant :
  pas une vente, donc pas d'impôt sur la plus-value ; règles des dons rappelées (présent d'usage, abattements,
  formulaire 2735).
- **Comptes enfants dans le calcul des impôts** (`docs/impots-compte-enfant.png`) : sur la fiche de l'enfant et dans
  « Plus-value et impôts », plus-value latente avant et après impôt, détail par métal et perspective jusqu'à
  l'exonération. Le métal versé est un don : prix de revient = valeur le jour du versement, durée de détention à partir
  de cette date.
- **L'or s'appelle Gold Spot** dans l'appli. (Le jeton maison Gold Oria a été arrêté : un éventuel solde est
  converti en Gold Spot sans frais, avec son prix de revient d'origine.)
- **Société Orvia** (Profil, protégé par un code ; `src/logic/company.ts`) : tableau de bord de ce que la société
  aurait gagné (frais réellement prélevés) et dépensé (garde, assurance, vérification d'identité, fidélité, parrainage)
  avec ce compte, sur 12 mois ou depuis l'ouverture, et nombre de clients semblables pour couvrir les frais fixes.
- **L'or fractionné** (`src/app/or-fractionne.tsx`, `docs/or-fractionne.png`) : page explicative (or dès 1 €, sans
  stockage à gérer, assuré et audité) et rappel sur l'accueil et chaque coffre : tous les métaux sont gardés par Orvia
  en coffre-fort en port franc, mais appartiennent au client, inscrits à son nom et séparés des biens d'Orvia.
- **Compte d'attente** (`src/app/attente.tsx`) : euros crédités par virement (IBAN Orvia) ou carte bancaire,
  investis ensuite selon la répartition (« Investir … selon ma répartition », « Payer avec : compte d'attente ») ;
  retrait vers la banque avec le code. Créditer compte comme une opération (pas de frais d'oxydation).
- **Fidélité : les louis (LOU)** (`src/logic/loyalty.ts`, `docs/fidelite.png`) : programme modeste qui récompense
  l'épargne régulière — 1 LOU par mois avec au moins 50 € investis (+5 LOU tous les 12 mois consécutifs), 1 LOU par
  500 € achetés, 1 LOU par mois avec au moins 25 € versés à un compte enfant, 1 LOU par anniversaire du compte
  et 5 LOU tous les 5 ans ; rien sur les paiements par carte (qui vendent du métal), les ventes,
  conversions ou virements. 1 LOU s'échange contre 1 € de métal sans frais, dès 10 LOU.
- **Relevés PDF** (`src/logic/statement.ts`, `docs/exemple-releve.pdf`) : une ligne par opération avec grammes, prix
  au gramme, frais d'achat, autres frais et impôt ; soldes de début et de fin avec prix moyen payé (frais compris) ;
  adresse du titulaire (Profil → Relevés), aussi sur les relevés des comptes enfants. Relevé par période (ce mois, mois
  dernier, 12 mois, tout) pour le compte principal (Historique), chaque coffre, chaque compte enfant et le compte
  d'attente, avec soldes de début et de fin ; avis d'opération en touchant une opération. Téléphone : PDF partagé ou
  enregistré (expo-print, expo-sharing) ; navigateur : impression « Enregistrer au format PDF ».
- **Achats programmés** (Profil ou Répartition → `src/app/programme.tsx`, `src/logic/plan.ts`) : montant par semaine
  (partagé sur les jours choisis) ou par mois, payé par carte ou par le compte d'attente, réparti selon votre objectif.
  Les achats dus passent au cours réel à l'ouverture de l'appli, pendant son utilisation et en arrière-plan (rattrapage
  jusqu'à 31 jours) ; un achat impossible (compte d'attente insuffisant) est sauté et notifié.
- **Bot d'achat sur baisse** (Profil → Bot d'achat sur baisse, `src/app/bot.tsx`, `src/logic/dipBot.ts`) : en plus de
  l'achat régulier, achat d'un métal sous son prix fixe (€/g) ou sous sa moyenne 30 jours (Gold Spot −5 %, argent −8 %,
  platine −7 %), double en baisse forte (−10 %, argent −15 %) ; un achat par métal sur 7 jours, plafond mensuel (300 € par défaut) ; prix
  fixes remis à jour chaque mois (moyenne 30 jours −7 % / −10 %) ; comparaison du prix moyen payé par gramme avec
  l'achat régulier. Paiement par le compte d'attente ou la carte. Chaque achat notifié dans l'appli et sur le canal
  ntfy choisi (`src/logic/ntfyClient.ts`). Inactif tant qu'il n'est pas enregistré.
- **Sauvegarde** (Profil → Sauvegarde, `src/logic/backup.ts`) : export du compte dans un fichier JSON (Google Drive,
  e-mail…) et restauration sur un autre téléphone, confirmée par le code ; le code d'accès n'est jamais exporté.
- **Historique allégé** (`src/logic/compact.ts`) : au-delà de 600 opérations, les achats de plus de 12 mois sont
  regroupés par mois et par métal (mêmes montants, frais et grammes ; date du dernier achat du mois, donc impôt jamais
  sous-estimé).
- **Reprise de l'épargne depuis 2019** (Profil → Historique, `src/logic/history2019.ts`) : compte ouvert le 4 janvier
  2019, 25 € par semaine en 4 achats (lundi, mercredi, vendredi, dimanche), 50 % Gold Spot, 25 % argent, 25 % platine,
  frais d'achat Orvia compris ; une seule fois. Chaque achat au cours moyen réel de son mois en €/once
  (`src/logic/monthlyPrices.ts`, calculé par `.github/workflows/cours-mensuels.yml` à partir des cours quotidiens et du
  taux BCE du jour) ; une reprise faite avec les anciennes moyennes annuelles peut être recalculée en un geste.
- **Relevé d'épargne d'un compte enfant** (écran du compte enfant, `src/logic/childStatement.ts`,
  `docs/exemple-releve-epargne-enfant.pdf`) : PDF avec logo, valeur au cours du jour, total versé, plus-value,
  versements par année, règles de protection, fiscalité et derniers mouvements ; présenté comme un relevé de suivi
  (ni certificat de dépôt, ni preuve de détention).
- **Notifications ntfy** (Profil → Notifications ntfy, `src/app/notifications.tsx`) : tout ce qui arrive sur le canal
  ntfy du compte (alertes du serveur, achats du bot, tests), filtrable, mis à jour toutes les 30 s ; gardé sur le
  téléphone (ntfy.sh ne garde les messages que 12 h). Les alertes du serveur apparaissent aussi dans l'écran Alertes
  et la dernière (moins de 24 h) sur l'écran du compte.
- **Actualités** (écran du compte → « Tout voir », `src/app/actualites.tsx`, `src/logic/news.ts`) : titres, résumés
  et images des flux RSS publics d'Or.fr, Gold.fr, BullionVault (France) et AuCOFFRE (blog « L'or et l'argent »),
  les plus récents d'abord, filtre par site, lecture de l'article sur son site ; gardées en cache (hors connexion),
  rechargées toutes les 30 min. Ces sites n'autorisant pas la lecture depuis un navigateur, la section sert dans
  l'appli Android (la version web propose les liens vers les sites). Diagnostic : `.github/workflows/sources-actus.yml`.
- **Déclaration des dons** (compte enfant → Déclaration des dons, `src/logic/giftRecap.ts`,
  `docs/exemple-recapitulatif-dons-2735.pdf`) : récapitulatif PDF par trimestre ou par année pour le formulaire 2735
  (donateur, bénéficiaire, acceptation par le représentant légal, dons avec grammes et valeur au jour du don, total,
  abattement de 100 000 € sur 15 ans utilisé et restant), trimestres marqués comme déclarés, rappel au début de chaque
  trimestre ; section « Donations à vos enfants » dans Plus-value et impôts.
- **Don mensuel à un enfant** (écran du compte enfant, `src/logic/childGiftPlan.ts`) : montant, jour du mois et
  répartition ; le jour prévu, rappel par notification et don en un geste (« Faire le don », ou « Pas ce mois-ci »),
  ou don automatique si vous le choisissez. Le métal est acheté sur le compte du parent puis versé gratuitement.
- **Dons à un enfant depuis 2022** (Profil → Historique, sous la reprise 2019, `src/logic/childGifts.ts`) : 50 € le 5
  de chaque mois depuis le 5 janvier 2022, 50 % Gold Spot et 50 % argent, au cours moyen réel de chaque mois, frais
  d'achat compris, ajoutés au compte de l'enfant choisi (le compte principal ne change pas) ; une seule fois.
- **Lien en lecture seule d'un compte enfant** (écran du compte enfant → « Partager le compte de … »,
  `src/logic/shareView.ts`) : lien vers la version web, sans appli ni code, qui montre la valeur aux cours du moment,
  les coffres, les règles de protection et les derniers mouvements, sans aucune opération possible. Les données sont
  après le « # » du lien (jamais envoyées au serveur) ; c'est une photo du compte au moment du partage.
- **Carte Orvia** : carte de paiement virtuelle adossée aux métaux du compte ; chaque paiement
  ou retrait vend le métal choisi au cours du moment, sans frais ; plafonds de 3 000 € / 30 jours
  (paiements) et 500 € / 7 jours (retraits) ; gel en un geste (`docs/carte.png`).
- **Parrainage** : un code par compte à partager ; le filleul reçoit 10 € en or à son premier achat
  d'au moins 50 € (`docs/parrainage.png`).
- **Alertes de prix** (🔔 sur l'écran du compte) : seuil de prix, variation sur 24 h ou 7 jours, écart à la
  moyenne 30 jours, pour chaque métal ; notification une seule fois par franchissement (6 h minimum entre deux),
  historique avec raccourcis Acheter / Vendre (`docs/alertes.png`). Ce sont les conditions de l'utilisateur, pas
  des conseils d'investissement. Version web : vérifiées quand l'appli est ouverte (pas encore de serveur).
- **Alertes 24 h/24** : `.github/workflows/alertes.yml` vérifie les cours toutes les 15 minutes (GitHub lançant les tâches programmées avec retard, chaque lancement tourne en boucle 5 h 30) avec la même
  logique que l'appli (`server/alertServer.ts`) et envoie les alertes par [ntfy](https://ntfy.sh). Réglages :
  secret `NTFY_TOPIC` (canal secret généré dans l'appli), alertes dans `server/alerts.json` (export depuis l'écran
  Alertes). L'état (relevés, alertes déjà envoyées) est gardé dans le cache GitHub Actions.
- **Répartition** (« Répartition » sur l'écran du compte, l'écran Opérer ou le Profil) : objectif en % par métal
  (modèles 50/25/25, 60/20/20…), comparaison avec la répartition actuelle, et **achat réparti en euros** en un geste,
  « selon mes % » ou « vers mon objectif » (priorité aux métaux en retard, sans rien vendre) (`docs/repartition.png`).
- **Grille tarifaire** (voir `src/logic/fees.ts` et l'écran Tarifs, `docs/tarifs.png`) :
  achat 2,8 % (or), 6,8 % (argent, platine) ; revente par virement 0,8 % (+ 30 € hors de France) ;
  écart de 2,8 % en virement immédiat, aucun en différé (J+2) ; conversion 0,8 % + frais d'achat ;
  envois et réceptions entre membres gratuits.
- **Comptes enfants gratuits**, aux règles inspirées du droit français (à faire valider par un juriste) :
  - l'argent versé appartient à l'enfant (c'est un don) : le parent ne peut pas le reprendre pour lui-même ;
  - retrait seulement pour une **dépense faite pour l'enfant** (motif obligatoire), **validé par le second parent**
    avec son propre code quand l'autorité parentale est partagée (Cass. com., 12 juin 2025), ou par le parent seul
    s'il l'exerce seul ;
  - un versement fait par erreur peut être annulé seul dans les 24 h ;
  - **aucun frais avant 18 ans** ; à la majorité, le parent ne gère plus le compte et le **transfère à l'enfant**
    (code de rattachement) ; logique dans `src/logic/childRules.ts` (`docs/compte-enfant.png`).
- **Frais d'oxydation** : un compte (principal, ou enfant devenu majeur) laissé 6 mois calendaires sans opération éligible
  d'au moins 1 € (paiement ou retrait par carte, échange de louis, achat, parrainage) est facturé 0,02 % du solde par jour sur ces 6 mois (environ 3,6 %), en métal ; chaque nouvelle
  période de 6 mois d'inactivité est facturée de même. L'appli prévient un mois avant (`docs/oxydation.png`).

Sources des cours : [gold-api.com](https://gold-api.com) (métaux) et
[Frankfurter](https://frankfurter.dev) / [open.er-api.com](https://open.er-api.com) (taux USD → EUR).

## Développement

```bash
npm install
npx expo start      # puis scanne le QR code avec Expo Go
npm test            # tests de la logique du compte
npm run typecheck   # vérification TypeScript
npm run lint        # lint
```

## Organisation du code

- `src/app/` : écrans (Expo Router) — onglets Compte, Opérer, Virements, Historique, Profil, et `coffre/[metal]`
- `src/logic/` : logique pure (compte, cours, formatage), testée dans `scripts/ledger.test.ts`
- `src/state/BankProvider.tsx` : état du compte, actualisation des cours, verrouillage
- `src/security.ts` : code d'accès et empreinte
- `scripts/brand/make_logo.py` : génère le logo (louis d'or) et toutes les icônes
- `src/components/`, `src/features/` : composants, ouverture de compte et déverrouillage
