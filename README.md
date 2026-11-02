# Orvia — compte adossé à l'or, à l'argent et au platine (démo)

<img src="assets/logo.png" width="160" alt="Logo Orvia : pépite d'or" />

Application mobile (Expo / React Native) qui simule un compte dont le solde est détenu en
métaux précieux. **Les cours sont réels**, mais les achats, ventes et virements sont fictifs :
aucun argent ni métal réel n'est échangé.

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

Télécharge l'APK depuis ton téléphone :
**https://github.com/nicox32/elrond/releases/latest/download/orvia.apk**

Il est reconstruit automatiquement à chaque modification (voir `.github/workflows/android-apk.yml`).

## Fonctionnalités

- **Cours réels** de l'or, de l'argent et du platine (au comptant, en dollars par once, convertis en
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
- Écart achat/vente de 0,5 % sur le cours réel.

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
- `scripts/brand/make_logo.py` : génère le logo (pépite d'or) et toutes les icônes
- `src/components/`, `src/features/` : composants, ouverture de compte et déverrouillage
