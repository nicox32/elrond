// « La Cavale » : l’histoire principale de NeonCell, dans l’État fictif de Solenne.
// 9 personnages importants (toi + 8), 5 chapitres, environ 60 heures en temps réel.
// Personnages, lieux et marques inventés.

export type Effects = { money?: number; wanted?: number; rep?: number; trust?: number; set?: string[] };

export type StoryVars = { flags: Record<string, true>; rep: number; trust: number; wanted: number };

export type MissionDef = {
  id: string;
  title: string;
  description: string;
  /** Lieu : carte de la ville (`city`) ou de l’État (`state`). */
  map: 'city' | 'state';
  poi: string;
  durationSec: number;
  /** Risque de base (0 à 1) ; le niveau de recherche l’augmente. */
  risk: number;
  reward: number;
  /** Étoiles de recherche gagnées, même en cas de réussite. */
  wanted: number;
  win: string;
  fail: string;
};

export type Beat =
  | { t: 'msg'; from: string; text: string; wait?: number }
  | { t: 'choice'; from: string; options: { label: string; go: string; effects?: Effects }[] }
  | { t: 'mission'; mission: MissionDef }
  | { t: 'gate'; from: string; money: number; objective: string; label: string }
  | { t: 'call'; from: string; lines: string[]; wait?: number }
  | { t: 'effects'; effects: Effects }
  | { t: 'chapter'; n: number }
  | { t: 'if'; test: (v: StoryVars) => boolean; then: string; else: string }
  | { t: 'goto'; go: string; wait?: number }
  | { t: 'end'; ending: string };

/** Version du scénario : une sauvegarde d’une autre version recommence l’histoire. */
export const STORY_VERSION = 2;

export const CHAPTERS = ['', 'Sortie de cellule', 'Les Îles', 'Néons et Sirènes', 'Le coup', 'La dernière marée'];

/** Les 9 personnages importants : toi, et ces 8 contacts. */
export const CAST: { id: string; role: string }[] = [
  { id: 'mara', role: 'Ta partenaire, tout juste sortie du pénitencier' },
  { id: 'teo', role: 'Ton meilleur ami, persuadé que les extraterrestres existent' },
  { id: 'boyd', role: 'Contrebandier des Îles Coquillages, ton logeur… et ton patron' },
  { id: 'santos', role: 'Braqueur méthodique : dix-sept banques, zéro arrestation' },
  { id: 'momo', role: 'Propriétaire de la moitié du Vieux Port et figure du quartier' },
  { id: 'kenzo', role: 'Producteur qui veut faire du label des Sirènes un empire' },
  { id: 'nina', role: 'Rappeuse, une moitié du duo les Sirènes' },
  { id: 'jojo', role: 'Rappeuse, l’autre moitié des Sirènes (la plus drôle)' },
];

export type Ending = { id: string; title: string; text: string; emoji: string };

export const ENDINGS: Ending[] = [
  { id: 'large', emoji: '🌊', title: 'Le grand large', text: 'Port Corail disparaît à l’horizon. Mara pose sa tête sur ton épaule. Quelque part, la radio passe « Les Amoureux en cavale » des Sirènes. Plus d’avis de recherche : juste l’océan, et vous deux.' },
  { id: 'rois', emoji: '👑', title: 'Les nouveaux rois de Port Corail', text: 'Les Sirènes sont numéro un, le label de Kenzo vous verse votre part et Big Momo vous a fait une place à sa table. Votre argent est propre. Teo, lui, cherche toujours ses extraterrestres.' },
  { id: 'route', emoji: '🛣️', title: 'Les fantômes de la route', text: 'Une voiture, un sac de billets, la route côtière à perte de vue. Vous ne dormez jamais deux nuits au même endroit. Mara conduit, toi tu choisis la musique. C’est ça, la liberté.' },
  { id: 'prison', emoji: '⛓️', title: 'Derrière les barreaux', text: 'Les gyrophares, puis le silence. Au pénitencier de Canneville, une lettre de Mara arrive chaque semaine. Elle finit toujours par : « On recommencera. »' },
  { id: 'seul', emoji: '💔', title: 'Seul', text: 'Un matin, le côté du lit de Mara est vide. Un mot sur la table : « Tu as choisi l’argent. Moi, je choisis la mer. » Tu es riche, et tu n’as jamais été aussi seul.' },
];

const MIN = 60;
const H = 3600;

const m = (from: string, text: string, wait?: number): Beat => ({ t: 'msg', from, text, wait });

export const NODES: Record<string, Beat[]> = {
  // ─────────────── Chapitre 1 : Sortie de cellule (≈ 15 h) ───────────────
  start: [
    { t: 'chapter', n: 1 },
    m('mara', '{name}, c’est Mara. Ils me libèrent. Demain, 8 h, devant le pénitencier de Canneville.', 2),
    m('mara', 'Trois ans que je ne vois que des murs. Tu viens me chercher ?'),
    {
      t: 'choice',
      from: 'mara',
      options: [
        { label: 'Je serai le premier devant la porte. ❤️', go: 'c1_teo', effects: { trust: 1 } },
        { label: 'Je vais essayer… j’ai des trucs à régler.', go: 'c1_teo', effects: { trust: -1 } },
      ],
    },
  ],
  c1_teo: [
    m('teo', 'Frère !!! C’est vrai ce qu’on raconte ? Mara sort demain ?', 25 * MIN),
    m('teo', 'Je te prête ma vieille décapotable. Le réservoir est à moitié plein. Ou à moitié vide, ça dépend de ton humeur.'),
    {
      t: 'choice',
      from: 'teo',
      options: [
        { label: 'T’es le meilleur, Teo.', go: 'c1_nuit', effects: { set: ['teo_ami'] } },
        { label: 'Je me débrouille, merci.', go: 'c1_nuit' },
      ],
    },
  ],
  c1_nuit: [
    m('mara', 'Je n’arrive pas à dormir. Dans ma tête, je suis déjà sur la plage.', 3 * H),
    m('mara', 'Dis-moi un truc qui va me faire sourire.'),
    {
      t: 'choice',
      from: 'mara',
      options: [
        { label: 'Demain soir : tacos, coucher de soleil, toi et moi.', go: 'c1_matin', effects: { trust: 1 } },
        { label: 'Teo a acheté un détecteur d’extraterrestres. Encore.', go: 'c1_matin', effects: { trust: 1 } },
        { label: 'Dors. Demain sera long.', go: 'c1_matin' },
      ],
    },
  ],
  c1_matin: [
    m('teo', 'Debout ! Les clés sont sous le paillasson. Pas de folies sur la route de Canneville.', 3 * H),
    {
      t: 'mission',
      mission: {
        id: 'sortie', title: 'Chercher Mara', description: 'Traverser les champs de canne jusqu’au pénitencier de Canneville avant 8 h.',
        map: 'state', poi: 'penitencier', durationSec: 40 * MIN, risk: 0.05, reward: 0, wanted: 0, win: 'c1_retrouvailles', fail: 'c1_retard',
      },
    },
  ],
  c1_retard: [m('mara', 'Une heure que j’attends sous le soleil, {name}. Une heure.'), { t: 'effects', effects: { trust: -1 } }, { t: 'goto', go: 'c1_retrouvailles' }],
  c1_retrouvailles: [
    m('mara', 'Libre. Pour de vrai. Roule, et ne t’arrête pas avant la mer.', MIN),
    m('teo', 'Bienvenue dehors, Mara ! Mon canapé est à vous. Il grince, mais il est sincère.', 2 * H),
    m('mara', 'Teo est adorable. Mais on ne va pas vivre sur son canapé, {name}.', 20 * MIN),
    { t: 'goto', go: 'c2', wait: 2 * H },
  ],

  // ─────────────── Chapitre 2 : Les Îles (≈ 12 h) ───────────────
  c2: [
    { t: 'chapter', n: 2 },
    m('mara', 'Il nous faut de l’argent. Vite. Et un endroit à nous.'),
    m('teo', 'J’ai peut-être un plan. Mon cousin bosse pour un certain Boyd, aux Îles Coquillages. Il loge des gens… contre des services.', 10 * MIN),
    {
      t: 'choice',
      from: 'mara',
      options: [
        { label: 'On va voir Boyd.', go: 'c2_boyd', effects: { set: ['boyd'] } },
        { label: 'On fait les choses proprement : je trouve du boulot.', go: 'c2_propre', effects: { rep: 1 } },
      ],
    },
  ],
  c2_propre: [
    m('mara', 'D’accord, monsieur l’honnête homme. Il faut 1 500 $ pour la caution d’un studio.'),
    { t: 'gate', from: 'mara', money: 1500, objective: 'Réunir 1 500 $ pour la caution (appli Boulots)', label: 'Caution d’un studio' },
    m('mara', 'On a un toit ! Minuscule, mais à nous. 🏠'),
    m('boyd', 'On m’a parlé de vous deux. Les gens honnêtes, ça m’intéresse : personne ne les soupçonne. Passez au ponton.', 4 * H),
    { t: 'goto', go: 'c2_boyd' },
  ],
  c2_boyd: [
    m('boyd', 'Mon ponton, au bout des Îles Coquillages. Ce soir, 22 h. Venez seuls.'),
    {
      t: 'mission',
      mission: {
        id: 'ponton', title: 'Rendez-vous chez Boyd', description: 'Prendre le long pont des Îles Coquillages jusqu’au ponton de Boyd « le Pélican ».',
        map: 'state', poi: 'ponton', durationSec: H, risk: 0.05, reward: 0, wanted: 0, win: 'c2_offre', fail: 'c2_offre',
      },
    },
  ],
  c2_offre: [
    m('boyd', 'Règle n°1 : chez Boyd, on ne pose pas de questions sur les caisses.'),
    m('boyd', 'Je vous loge dans le bungalow du fond. En échange, vous me rendez des services. Le premier : ramener un bateau caché dans le Marais des Sauriens.'),
    {
      t: 'choice',
      from: 'boyd',
      options: [
        { label: 'Marché conclu.', go: 'c2_bateau' },
        { label: 'Mara pilote, moi je surveille.', go: 'c2_bateau', effects: { trust: 1 } },
        { label: 'On veut être payés, pas juste logés.', go: 'c2_bateau', effects: { rep: 1, set: ['negocie'] } },
      ],
    },
  ],
  c2_bateau: [
    {
      t: 'mission',
      mission: {
        id: 'bateau', title: 'Le bateau du Marais', description: 'Remonter les mangroves de nuit et ramener le bateau de Boyd sans croiser les garde-côtes.',
        map: 'state', poi: 'cabane', durationSec: 2 * H, risk: 0.25, reward: 900, wanted: 2, win: 'c2_ok', fail: 'c2_ko',
      },
    },
  ],
  c2_ok: [m('boyd', 'Pas une rayure. Le bungalow est à vous.'), { t: 'effects', effects: { rep: 1 } }, { t: 'goto', go: 'c2_momo', wait: 4 * H }],
  c2_ko: [
    m('mara', 'Les garde-côtes ! On a dû tout abandonner dans les mangroves…'),
    m('boyd', 'Vous me devez un bateau. Je n’oublie jamais une dette.'),
    { t: 'effects', effects: { set: ['boyd_dette'] } },
    { t: 'goto', go: 'c2_momo', wait: 4 * H },
  ],
  c2_momo: [
    m('momo', 'Salut. On m’appelle Big Momo. La moitié des immeubles du Vieux Port sont à moi, et l’autre moitié me doit de l’argent.'),
    m('momo', 'Boyd dit que vous êtes fiables. Le Club Néon 23 a trois mois de loyer en retard. Allez parler au gérant.'),
    {
      t: 'choice',
      from: 'momo',
      options: [
        { label: 'On va discuter… gentiment.', go: 'c2_loyer_doux', effects: { rep: 1 } },
        { label: 'On va lui faire un peu peur.', go: 'c2_loyer_dur', effects: { set: ['dur'] } },
        { label: 'Ce n’est pas notre genre.', go: 'c2_refus', effects: { trust: 1, rep: -1 } },
      ],
    },
  ],
  c2_loyer_doux: [
    {
      t: 'mission',
      mission: {
        id: 'loyer_doux', title: 'Le loyer du Club Néon', description: 'Trouver un arrangement avec le gérant du Club Néon 23, dans le Quartier Néon.',
        map: 'city', poi: 'club', durationSec: 45 * MIN, risk: 0.1, reward: 600, wanted: 0, win: 'c2_kenzo', fail: 'c2_kenzo',
      },
    },
  ],
  c2_loyer_dur: [
    {
      t: 'mission',
      mission: {
        id: 'loyer_dur', title: 'Le loyer du Club Néon (manière forte)', description: 'Faire comprendre au gérant du Club Néon 23 que Big Momo n’attend plus.',
        map: 'city', poi: 'club', durationSec: 30 * MIN, risk: 0.25, reward: 900, wanted: 1, win: 'c2_kenzo', fail: 'c2_kenzo',
      },
    },
  ],
  c2_refus: [m('momo', 'Dommage. Mais je respecte les gens qui ont des principes. Ils sont rares.'), { t: 'goto', go: 'c2_kenzo' }],
  c2_kenzo: [
    m('kenzo', 'Yo, c’est Kenzo. Momo m’a filé ton numéro. Je produis les Sirènes, le duo le plus chaud de Port Corail.', H),
    m('kenzo', 'Le Club Néon reste ouvert, donc mes filles peuvent y répéter. Je vous dois une fière chandelle.'),
    { t: 'goto', go: 'c3', wait: 3 * H },
  ],

  // ─────────────── Chapitre 3 : Néons et Sirènes (≈ 12 h) ───────────────
  c3: [
    { t: 'chapter', n: 3 },
    m('nina', 'Salut ! Nina, des Sirènes 🎤. Kenzo dit que vous êtes nos anges gardiens maintenant.'),
    m('jojo', 'Et moi c’est Jojo. L’autre moitié. La plus drôle.', MIN),
    m('nina', 'Showcase samedi au Flamingo Club. On veut que vous soyez là.'),
    {
      t: 'choice',
      from: 'nina',
      options: [
        { label: 'On ne raterait ça pour rien au monde.', go: 'c3_avant' },
        { label: 'Si Mara vient, je viens.', go: 'c3_avant', effects: { trust: 1 } },
      ],
    },
  ],
  c3_avant: [
    m('mara', 'Je n’ai pas dansé depuis trois ans. Prépare tes jambes.', H),
    m('teo', 'Je viens aussi ! J’ai sorti ma chemise à flamants. Les vrais savent.', 2 * H),
    {
      t: 'mission',
      mission: {
        id: 'showcase', title: 'La nuit des Sirènes', description: 'Assurer la soirée des Sirènes au Flamingo Club, sur l’Île aux Flamants.',
        map: 'city', poi: 'flamingo', durationSec: 2 * H, risk: 0.1, reward: 0, wanted: 0, win: 'c3_vol', fail: 'c3_vol',
      },
    },
  ],
  c3_vol: [
    m('jojo', 'CATASTROPHE. Quelqu’un a volé le disque dur avec tout l’album !!! 😭'),
    m('kenzo', 'Sans ce disque, pas d’album. Sans album, pas de contrat. Sans contrat… je retourne vendre des glaces.'),
    m('teo', 'J’ai vu un type filer vers la marina avec un sac à dos. Je dis ça, je dis rien.'),
    {
      t: 'mission',
      mission: {
        id: 'poursuite', title: 'Retrouver l’album', description: 'Rattraper le voleur avant qu’il quitte la marina en bateau.',
        map: 'city', poi: 'marina', durationSec: H, risk: 0.3, reward: 0, wanted: 1, win: 'c3_trouve', fail: 'c3_perdu',
      },
    },
  ],
  c3_perdu: [
    m('nina', 'Il s’est envolé… Kenzo va devoir tout réenregistrer. Ça va coûter cher.'),
    { t: 'effects', effects: { set: ['album_perdu'] } },
    { t: 'goto', go: 'c3_investir', wait: 2 * H },
  ],
  c3_trouve: [
    m('mara', 'On l’a ! Et devine qui avait payé le voleur ? Un homme de Boyd.'),
    m('mara', 'Boyd veut l’album pour tenir Kenzo. On en fait quoi ?'),
    {
      t: 'choice',
      from: 'mara',
      options: [
        { label: 'On le rend aux Sirènes.', go: 'c3_investir', effects: { trust: 1, set: ['loyal_sirenes'] } },
        { label: 'On le confie à Big Momo, il saura quoi en faire.', go: 'c3_investir', effects: { rep: 1, set: ['momo_album'] } },
        { label: 'On le donne à Boyd. On vit chez lui, après tout.', go: 'c3_investir', effects: { trust: -1, set: ['boyd_album'] } },
      ],
    },
  ],
  c3_investir: [
    m('kenzo', 'J’ai une proposition. 3 000 $ et vous devenez associés du label. Quand les Sirènes exploseront, vous toucherez votre part.', 3 * H),
    {
      t: 'choice',
      from: 'kenzo',
      options: [
        { label: 'On investit.', go: 'c3_gate', effects: { set: ['investi'] } },
        { label: 'Pas maintenant.', go: 'c4', effects: {} },
      ],
    },
  ],
  c3_gate: [
    { t: 'gate', from: 'kenzo', money: 3000, objective: 'Réunir 3 000 $ pour entrer dans le label des Sirènes', label: 'Parts du label des Sirènes' },
    m('kenzo', 'Bienvenue dans la famille, associés. 🎶'),
    m('jojo', 'On vous écrit une chanson. Titre provisoire : « Les Amoureux en cavale ».', 2 * MIN),
    { t: 'goto', go: 'c4', wait: 3 * H },
  ],

  // ─────────────── Chapitre 4 : Le coup (≈ 14 h) ───────────────
  c4: [
    { t: 'chapter', n: 4 },
    m('boyd', 'Vous jouez dans la cour des grands, maintenant. J’ai quelqu’un à vous présenter.'),
    { t: 'if', test: (v) => !!v.flags.boyd_album, then: 'c4_boyd_merci', else: 'c4_santos' },
  ],
  c4_boyd_merci: [m('boyd', 'Merci pour l’album, au fait. Kenzo va me manger dans la main.'), { t: 'goto', go: 'c4_santos' }],
  c4_santos: [
    m('santos', 'Santos Vidal. Dix-sept banques, zéro arrestation. On m’a dit que vous saviez garder votre sang-froid.', 30 * MIN),
    m('santos', 'Cible : le coffre de la Banque Flamant. Il me faut du matériel. 4 000 $. Je ne fais pas crédit.'),
    { t: 'gate', from: 'santos', money: 4000, objective: 'Réunir 4 000 $ pour le matériel de Santos', label: 'Matériel pour Santos' },
    m('santos', 'Reçu. Il me faut une équipe. Qui fait diversion pendant qu’on travaille ?'),
    {
      t: 'choice',
      from: 'santos',
      options: [
        { label: 'Teo. Il conduit mal, mais il est loyal.', go: 'c4_reperage', effects: { trust: 1, set: ['equipe_teo'] } },
        { label: 'Les Sirènes : un concert surprise devant la banque.', go: 'c4_reperage', effects: { set: ['equipe_sirenes'] } },
        { label: 'Les gars de Big Momo. Des pros.', go: 'c4_reperage', effects: { rep: 1, set: ['equipe_momo'] } },
      ],
    },
  ],
  c4_reperage: [
    m('santos', 'D’abord, le repérage. Je veux les horaires des gardes et des fourgons.', 2 * H),
    {
      t: 'mission',
      mission: {
        id: 'reperage', title: 'Repérage à la Banque Flamant', description: 'Noter discrètement les rondes des gardes et l’heure des fourgons blindés.',
        map: 'city', poi: 'banque', durationSec: 90 * MIN, risk: 0.1, reward: 0, wanted: 0, win: 'c4_vehicule', fail: 'c4_vehicule',
      },
    },
  ],
  c4_vehicule: [
    m('santos', 'Il nous faut une voiture que personne ne connaît.', 2 * H),
    m('rico', 'Une voiture « discrète » ? Je ne veux rien savoir. Passe au garage, les clés seront sur le pneu avant gauche.', 30 * MIN),
    {
      t: 'mission',
      mission: {
        id: 'vehicule', title: 'La voiture fantôme', description: 'Récupérer au garage de Rico une voiture sans histoire, et la garer près de la banque.',
        map: 'city', poi: 'garage', durationSec: H, risk: 0.15, reward: 0, wanted: 0, win: 'c4_plan', fail: 'c4_plan',
      },
    },
  ],
  c4_plan: [
    m('santos', 'Tout est prêt. Dernière question : le plan.', 2 * H),
    {
      t: 'choice',
      from: 'santos',
      options: [
        { label: 'Discret : de nuit, par les sous-sols.', go: 'c4_coffre_d', effects: { set: ['discret'] } },
        { label: 'Rapide : deux minutes chrono.', go: 'c4_coffre_r' },
      ],
    },
  ],
  c4_coffre_d: [
    {
      t: 'mission',
      mission: {
        id: 'coffre_d', title: 'Le coffre (plan discret)', description: 'Une longue nuit sous la Banque Flamant. Lent, mais silencieux.',
        map: 'city', poi: 'banque', durationSec: 3 * H, risk: 0.3, reward: 15000, wanted: 2, win: 'c4_reussi', fail: 'c4_rate',
      },
    },
  ],
  c4_coffre_r: [
    {
      t: 'mission',
      mission: {
        id: 'coffre_r', title: 'Le coffre (plan rapide)', description: 'Deux minutes chrono à la Banque Flamant. Gros butin, grosses sirènes.',
        map: 'city', poi: 'banque', durationSec: 45 * MIN, risk: 0.4, reward: 20000, wanted: 4, win: 'c4_reussi', fail: 'c4_rate',
      },
    },
  ],
  c4_rate: [
    m('santos', 'Annulé ! Les sirènes, partout. On se disperse.'),
    m('mara', 'On fait profil bas quelques heures. Santos est prêt à retenter.', MIN),
    { t: 'goto', go: 'c4_plan', wait: 3 * H },
  ],
  c4_reussi: [
    m('santos', 'Le coffre est vide, et nous sommes riches. Je disparais quelque temps. C’était un plaisir.'),
    m('mara', 'On l’a fait, {name}. On l’a vraiment fait.', H),
    { t: 'goto', go: 'c5', wait: 3 * H },
  ],

  // ─────────────── Chapitre 5 : La dernière marée (≈ 6 h) ───────────────
  c5: [
    { t: 'chapter', n: 5 },
    {
      t: 'call',
      from: 'teo',
      lines: [
        'Frère, c’est Teo.',
        'La police est passée chez moi. Ils posaient des questions sur ma décapotable.',
        'J’ai rien dit. Enfin… je leur ai parlé de mes extraterrestres. Ils sont partis vite.',
        'Faites attention à vous. Vraiment.',
      ],
    },
    m('boyd', 'Changement de programme. Je prends 70 % du butin. Sinon, la police reçoit un appel anonyme.', 3 * H),
    { t: 'if', test: (v) => !!v.flags.boyd_dette, then: 'c5_dette', else: 'c5_choix' },
  ],
  c5_dette: [m('boyd', 'Et n’oubliez pas mon bateau. Avec les intérêts.'), { t: 'goto', go: 'c5_choix' }],
  c5_choix: [
    m('mara', 'Il nous fait chanter. On fait quoi ?', H),
    {
      t: 'choice',
      from: 'mara',
      options: [
        { label: 'On le paie, et on part avec son bateau.', go: 'c5_boyd' },
        { label: 'On lui tient tête, avec Big Momo.', go: 'c5_momo' },
        { label: 'On prend la route cette nuit, toi et moi.', go: 'c5_route' },
        { label: 'On garde tout. Même si ça doit te faire peur.', go: 'c5_argent', effects: { trust: -2 } },
      ],
    },
  ],
  c5_boyd: [{ t: 'if', test: (v) => v.trust >= 2 && !v.flags.boyd_dette, then: 'c5_phare', else: 'c5_trahi' }],
  c5_phare: [
    m('boyd', 'Le bateau vous attend au phare. Minuit. Ne soyez pas en retard.', 30 * MIN),
    {
      t: 'mission',
      mission: {
        id: 'phare', title: 'Le bateau de minuit', description: 'Traverser le Pont de la Baie jusqu’au phare de l’Île aux Flamants, sans se faire repérer.',
        map: 'city', poi: 'phare', durationSec: H, risk: 0.15, reward: 0, wanted: 0, win: 'fin_large', fail: 'fin_prison',
      },
    },
  ],
  c5_trahi: [
    m('boyd', 'Désolé, les amoureux. Les affaires sont les affaires.', H),
    m('mara', 'Des gyrophares partout autour du phare… Il nous a vendus.', MIN),
    { t: 'end', ending: 'prison' },
  ],
  c5_momo: [
    m('momo', 'Boyd ? Il me doit plus d’argent que tout Port Corail réuni. Laissez-moi faire.', H),
    { t: 'if', test: (v) => v.rep >= 2 && !!v.flags.investi, then: 'c5_rois', else: 'c5_confrontation' },
  ],
  c5_rois: [
    m('kenzo', 'Les Sirènes sont numéro un ! Le label vous verse votre part. Bienvenue dans le monde légal 😎', 2 * H),
    m('nina', '« Les Amoureux en cavale » passe sur toutes les radios. C’est votre chanson. 💖'),
    { t: 'end', ending: 'rois' },
  ],
  c5_confrontation: [
    m('momo', 'Boyd ne veut rien entendre. Il faudra aller le voir. Je vous couvre.'),
    {
      t: 'mission',
      mission: {
        id: 'confrontation', title: 'Régler ses comptes au ponton', description: 'Aller au ponton de Boyd avec les gars de Big Momo, et repartir avec son bateau.',
        map: 'state', poi: 'ponton', durationSec: 2 * H, risk: 0.35, reward: 0, wanted: 1, win: 'fin_large', fail: 'fin_prison',
      },
    },
  ],
  c5_route: [{ t: 'if', test: (v) => v.trust <= -1, then: 'fin_seul', else: 'c5_fuite' }],
  c5_fuite: [
    {
      t: 'mission',
      mission: {
        id: 'route', title: 'La route côtière', description: 'Traverser tout l’État jusqu’à Bellerive avec le butin, en évitant les barrages.',
        map: 'state', poi: 'motel', durationSec: 3 * H, risk: 0.3, reward: 0, wanted: 1, win: 'fin_route', fail: 'fin_prison',
      },
    },
  ],
  c5_argent: [{ t: 'if', test: (v) => v.trust >= 2, then: 'c5_fuite', else: 'fin_seul' }],
  fin_large: [{ t: 'end', ending: 'large' }],
  fin_route: [{ t: 'end', ending: 'route' }],
  fin_prison: [{ t: 'end', ending: 'prison' }],
  fin_seul: [m('mara', 'Je t’aime, {name}. Mais pas comme ça.', 2 * H), { t: 'end', ending: 'seul' }],
};
