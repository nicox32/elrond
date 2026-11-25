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
export const STORY_VERSION = 3;

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

type Opt = [label: string, go: string, effects?: Effects];
const ch = (from: string, ...options: Opt[]): Beat => ({ t: 'choice', from, options: options.map(([label, go, effects]) => ({ label, go, effects })) });
const go = (node: string, wait?: number): Beat => ({ t: 'goto', go: node, wait });
const mission = (def: MissionDef): Beat => ({ t: 'mission', mission: def });

// Chaque choix mène d’abord à une courte réaction du personnage (passages « _a », « _b », « _c »),
// puis à la suite commune. Les voix : Mara directe et piquante ; Teo en MAJUSCULES et en théories ;
// Boyd sec, en règles ; Santos froid et précis ; Big Momo paternel, parle de lui à la 3e personne ;
// Kenzo enthousiaste (« c’est lourd ») ; Nina posée ; Jojo en minuscules et en emojis.
export const NODES: Record<string, Beat[]> = {
  // ─────────────── Chapitre 1 : Sortie de cellule (≈ 13 h) ───────────────
  start: [
    { t: 'chapter', n: 1 },
    m('mara', '{name}. C’est Mara.', 2),
    m('mara', 'Ils me relâchent demain. 8 h, devant le pénitencier de Canneville.'),
    m('mara', 'Trois ans à compter les fissures du plafond. Tu viens me chercher ?'),
    ch('mara',
      ['Je serai devant la porte à 7 h. Avec des fleurs. Et des tacos. ❤️', 'c1_a', { trust: 1 }],
      ['Tu crois que je laisserais quelqu’un d’autre te ramener ? Jamais.', 'c1_b', { trust: 1 }],
      ['Je vais essayer. J’ai des trucs à régler demain matin.', 'c1_c', { trust: -1 }]),
  ],
  c1_a: [m('mara', 'Des fleurs ET des tacos ? Attention, je vais finir par croire que tu m’as attendue.'), m('mara', '…Merci. Vraiment.'), go('c1_teo')],
  c1_b: [m('mara', 'Bonne réponse. La seule, en fait.'), go('c1_teo')],
  c1_c: [m('mara', '« Essayer ». D’accord.', 8), m('mara', 'Trois ans, {name}. Je te demande une matinée.'), go('c1_teo')],

  c1_teo: [
    m('teo', 'FRÈRE. C’est vrai ce qu’on raconte ??? Mara sort DEMAIN ?? 🛸', 25 * MIN),
    m('teo', 'Prends ma décapotable. Le réservoir est à moitié plein. Ou à moitié vide. Ça dépend si t’es optimiste.'),
    ch('teo',
      ['T’es le meilleur, Teo. Je te dois une bière.', 'c1_teo_a', { set: ['teo_ami'] }],
      ['Elle démarre au moins, ta poubelle ?', 'c1_teo_b'],
      ['Garde-la. Je ne veux pas t’attirer d’ennuis.', 'c1_teo_c', { rep: 1 }]),
  ],
  c1_teo_a: [m('teo', 'UNE bière ? Minimum un pack. Et tu écoutes ENFIN ma théorie sur le Lac Miroir. 👽'), go('c1_nuit')],
  c1_teo_b: [m('teo', 'Elle démarre. Elle s’arrête aussi, parfois. Toute seule. À mon avis c’est un signal.'), go('c1_nuit')],
  c1_teo_c: [m('teo', 'Trop tard, les clés sont déjà sous ton paillasson. On est frères ou pas ?'), go('c1_nuit')],

  c1_nuit: [
    m('mara', 'Je n’arrive pas à dormir.', 3 * H),
    m('mara', 'La fille de la cellule d’à côté ronfle comme un hors-bord.'),
    m('mara', 'Dis-moi un truc qui me fait sourire.'),
    ch('mara',
      ['Demain soir : plage, coucher de soleil, et toi qui voles mes frites.', 'c1_nuit_a', { trust: 1 }],
      ['Teo s’est acheté un détecteur d’extraterrestres. Le troisième.', 'c1_nuit_b', { trust: 1 }],
      ['Dors. Demain, il faudra être lucides.', 'c1_nuit_c']),
  ],
  c1_nuit_a: [m('mara', 'Je ne vole pas tes frites. Je les libère.'), m('mara', 'Bonne nuit, {name}.'), go('c1_matin')],
  c1_nuit_b: [m('mara', 'Le TROISIÈME ?! Ok. J’ai ri. Tu as gagné.'), go('c1_matin')],
  c1_nuit_c: [m('mara', 'Toujours le soldat. « Repos. Garde-à-vous. »'), m('mara', '…T’as raison. À demain.'), go('c1_matin')],

  c1_matin: [
    m('teo', 'DEBOUT. Clés sous le paillasson. J’ai fait le plein. Enfin, à moitié.', 3 * H),
    mission({
      id: 'sortie', title: 'Chercher Mara', description: 'Traverser les champs de canne jusqu’au pénitencier de Canneville avant 8 h. Elle compte sur toi.',
      map: 'state', poi: 'penitencier', durationSec: 40 * MIN, risk: 0.05, reward: 0, wanted: 0, win: 'c1_retrouvailles', fail: 'c1_retard',
    }),
  ],
  c1_retard: [
    m('mara', 'Une heure, {name}. Une heure sous le soleil devant un pénitencier.'),
    { t: 'effects', effects: { trust: -1 } },
    m('mara', 'Le garde m’a proposé un café. Le GARDE.', 6),
    go('c1_retrouvailles'),
  ],
  c1_retrouvailles: [
    m('mara', 'Libre. Pour de vrai.', MIN),
    m('mara', 'Roule. Et ne t’arrête pas avant la mer.'),
    m('teo', 'Bienvenue dehors, Mara !!! Mon canapé est à vous. Il grince, mais il est sincère. 🛋️', 2 * H),
    m('mara', 'Teo est adorable.', 20 * MIN),
    m('mara', 'Mais on ne va pas vivre sur un canapé qui grince, {name}.'),
    go('c2', 2 * H),
  ],

  // ─────────────── Chapitre 2 : Les Îles (≈ 14 h) ───────────────
  c2: [
    { t: 'chapter', n: 2 },
    m('mara', 'Bilan : zéro dollar, pas d’appart, et une agente de probation qui m’appelle tous les mardis.'),
    m('teo', 'J’ai PEUT-ÊTRE une idée. Mon cousin bosse pour un certain Boyd, aux Îles Coquillages. Il loge des gens. Contre des « services ».', 10 * MIN),
    m('teo', 'Je mets des guillemets parce que je ne veux pas savoir.'),
    ch('mara',
      ['On va voir ce Boyd. On n’a pas le luxe de choisir.', 'c2_a', { set: ['boyd'] }],
      ['Pas de « services ». Je trouve un vrai boulot.', 'c2_propre', { rep: 1 }],
      ['Ton avis, Mara ? Tu connais ce monde mieux que moi.', 'c2_c', { trust: 1, set: ['boyd'] }]),
  ],
  c2_a: [m('mara', 'Pragmatique. J’aime bien.'), go('c2_boyd')],
  c2_c: [m('mara', 'Tu me demandes mon avis ? Trois ans que personne ne l’a fait.'), m('mara', 'Allons voir Boyd. Mais c’est moi qui parle.'), go('c2_boyd')],
  c2_propre: [
    m('mara', 'D’accord, monsieur l’honnête homme.'),
    m('mara', 'Une caution, c’est 1 500 $. L’Agence Soleil paie à la tâche.'),
    { t: 'gate', from: 'mara', money: 1500, objective: 'Réunir 1 500 $ pour la caution (appli Boulots)', label: 'Caution d’un studio' },
    m('mara', 'On a un toit ! 14 m², une fenêtre qui donne sur un mur. Le paradis. 🏠'),
    m('boyd', 'On m’a parlé de vous deux.', 4 * H),
    m('boyd', 'Les gens honnêtes m’intéressent. Personne ne les soupçonne.'),
    go('c2_boyd'),
  ],
  c2_boyd: [
    m('boyd', 'Ponton n°9, au bout des Îles Coquillages. Ce soir, 22 h. Seuls.'),
    mission({
      id: 'ponton', title: 'Rendez-vous chez Boyd', description: 'Prendre le long pont des Îles Coquillages jusqu’au ponton n°9, chez Boyd « le Pélican ».',
      map: 'state', poi: 'ponton', durationSec: H, risk: 0.05, reward: 0, wanted: 0, win: 'c2_offre', fail: 'c2_offre',
    }),
  ],
  c2_offre: [
    m('boyd', 'Règle numéro un : chez Boyd, on ne pose pas de questions sur les caisses.'),
    m('boyd', 'Règle numéro deux : voir règle numéro un.'),
    m('boyd', 'Le bungalow du fond est à vous. En échange, un service : un bateau à ramener du Marais des Sauriens.'),
    ch('boyd',
      ['Marché conclu.', 'c2_of_a'],
      ['Mara pilote. Moi je couvre, j’ai l’habitude.', 'c2_of_b', { trust: 1 }],
      ['Loger, c’est bien. Payer, c’est mieux.', 'c2_of_c', { rep: 1, set: ['negocie'] }]),
  ],
  c2_of_a: [m('boyd', 'Bien. Ceux qui ne discutent pas vivent vieux.'), go('c2_bateau')],
  c2_of_b: [m('boyd', 'Un ancien militaire, hein. Ça se voit à ta façon de te tenir.'), m('mara', 'Et je pilote mieux que lui. Notez-le.'), go('c2_bateau')],
  c2_of_c: [m('boyd', '…', 8), m('boyd', '900 $. Et ne me reparlez plus jamais d’argent sur ce ton.'), go('c2_bateau')],
  c2_bateau: [
    mission({
      id: 'bateau', title: 'Le bateau du Marais', description: 'Remonter les mangroves de nuit et ramener le bateau de Boyd sans croiser les garde-côtes.',
      map: 'state', poi: 'cabane', durationSec: 2 * H, risk: 0.25, reward: 900, wanted: 2, win: 'c2_ok', fail: 'c2_ko',
    }),
  ],
  c2_ok: [
    m('boyd', 'Pas une rayure. Le Pélican est content.'),
    m('mara', 'Il parle de lui à la troisième personne. C’est bon signe ou mauvais signe ?'),
    { t: 'effects', effects: { rep: 1 } },
    go('c2_momo', 4 * H),
  ],
  c2_ko: [
    m('mara', 'Les garde-côtes ! On a dû tout lâcher dans les mangroves…'),
    m('boyd', 'Mon bateau est au fond du Marais. Vous me devez un bateau.'),
    m('boyd', 'Le Pélican n’oublie jamais une dette.'),
    { t: 'effects', effects: { set: ['boyd_dette'] } },
    go('c2_momo', 4 * H),
  ],
  c2_momo: [
    m('momo', 'Bonjour, mes enfants. On m’appelle Big Momo.'),
    m('momo', 'La moitié des immeubles du Vieux Port sont à moi. L’autre moitié me doit de l’argent.'),
    m('momo', 'Le Club Néon 23 a trois mois de loyer en retard. Allez parler au gérant. Momo préfère la douceur… mais Momo n’est pas patient.'),
    ch('momo',
      ['On va trouver un arrangement. Gentiment.', 'c2_mo_a', { rep: 1 }],
      ['On va lui rappeler qui est le propriétaire.', 'c2_mo_b', { set: ['dur'] }],
      ['Désolé, on n’est pas des huissiers.', 'c2_refus', { trust: 1, rep: -1 }]),
  ],
  c2_mo_a: [
    m('momo', 'Voilà ce que Momo aime entendre.'),
    mission({
      id: 'loyer_doux', title: 'Le loyer du Club Néon', description: 'Trouver un arrangement avec le gérant du Club Néon 23, dans le Quartier Néon.',
      map: 'city', poi: 'club', durationSec: 45 * MIN, risk: 0.1, reward: 600, wanted: 0, win: 'c2_kenzo', fail: 'c2_kenzo',
    }),
  ],
  c2_mo_b: [
    m('momo', 'Pas de casse. Le mobilier aussi est à Momo.'),
    mission({
      id: 'loyer_dur', title: 'Le loyer du Club Néon (manière forte)', description: 'Faire comprendre au gérant du Club Néon 23 que Big Momo n’attend plus.',
      map: 'city', poi: 'club', durationSec: 30 * MIN, risk: 0.25, reward: 900, wanted: 1, win: 'c2_kenzo', fail: 'c2_kenzo',
    }),
  ],
  c2_refus: [
    m('momo', 'Des principes. C’est rare, à Port Corail. Momo respecte.'),
    m('mara', 'Bien joué. On ne devient les chiens de garde de personne.'),
    go('c2_kenzo'),
  ],
  c2_kenzo: [
    m('kenzo', 'Yo ! Kenzo, producteur, label Néon Records. Momo m’a filé ton numéro.', H),
    m('kenzo', 'Il dit que vous êtes réglos. Momo ne dit JAMAIS ça.'),
    m('kenzo', 'Je produis les Sirènes. Retiens bien ce nom, frérot : c’est lourd.'),
    go('c3', 3 * H),
  ],

  // ─────────────── Chapitre 3 : Néons et Sirènes (≈ 13 h) ───────────────
  c3: [
    { t: 'chapter', n: 3 },
    m('nina', 'Bonsoir. Nina, des Sirènes.'),
    m('jojo', 'et moi c jojo 💅 l’autre moitié. la plus drôle. la plus belle aussi mais nina va dire que non', MIN),
    m('nina', 'Kenzo dit que vous êtes de confiance. Showcase samedi au Flamingo Club. On vous veut au premier rang.'),
    ch('nina',
      ['On sera là. Premier rang, promis.', 'c3_a'],
      ['Si Mara danse, je danse.', 'c3_b', { trust: 1 }],
      ['Une boîte pleine de monde ? Je préfère surveiller l’entrée.', 'c3_c', { rep: 1 }]),
  ],
  c3_a: [m('jojo', 'YESSS 🫶 nina a souri. elle sourit jamais'), go('c3_avant')],
  c3_b: [m('jojo', 'mara si tu lis ça : il a dit qu’il dansait. on a des preuves 📸'), go('c3_avant')],
  c3_c: [m('nina', 'Un garde du corps gratuit ? Kenzo va pleurer de joie.'), go('c3_avant')],
  c3_avant: [
    m('mara', 'Je n’ai pas dansé depuis trois ans.', H),
    m('mara', 'Prépare tes jambes. Et tes excuses pour quand tu me marcheras sur les pieds.'),
    m('teo', 'JE VIENS AUSSI. J’ai ressorti la chemise à flamants. Les vrais savent. 🦩', 2 * H),
    mission({
      id: 'showcase', title: 'La nuit des Sirènes', description: 'Assurer la soirée des Sirènes au Flamingo Club, sur l’Île aux Flamants.',
      map: 'city', poi: 'flamingo', durationSec: 2 * H, risk: 0.1, reward: 0, wanted: 0, win: 'c3_vol', fail: 'c3_vol',
    }),
  ],
  c3_vol: [
    m('jojo', 'ALERTE ALERTE 😭😭😭'),
    m('jojo', 'le disque dur avec TOUT l’album a disparu de la loge'),
    m('kenzo', 'Sans ce disque, pas d’album. Sans album, pas de contrat. Sans contrat… je retourne vendre des glaces sur la plage.'),
    m('teo', 'J’ai vu un mec filer vers la marina avec un sac à dos. Je dis ça, je dis rien. (Je dis ça.)'),
    mission({
      id: 'poursuite', title: 'Retrouver l’album', description: 'Rattraper le voleur avant qu’il quitte la marina en bateau. Tes réflexes de soldat reviennent d’un coup.',
      map: 'city', poi: 'marina', durationSec: H, risk: 0.3, reward: 0, wanted: 1, win: 'c3_trouve', fail: 'c3_perdu',
    }),
  ],
  c3_perdu: [
    m('nina', 'Il a filé en bateau. Tout est à refaire.'),
    m('kenzo', 'Six mois de studio envolés. C’est pas lourd, ça. C’est très, très léger.'),
    { t: 'effects', effects: { set: ['album_perdu'] } },
    go('c3_investir', 2 * H),
  ],
  c3_trouve: [
    m('mara', 'On l’a !'),
    m('mara', 'Et devine qui a payé le voleur ? Un homme de Boyd.'),
    m('mara', 'Boyd veut l’album pour tenir Kenzo par le cou. On en fait quoi ?'),
    ch('mara',
      ['On le rend aux Sirènes. C’est leur travail.', 'c3_tr_a', { trust: 1, set: ['loyal_sirenes'] }],
      ['On le confie à Big Momo. Personne ne vole Momo.', 'c3_tr_b', { rep: 1, set: ['momo_album'] }],
      ['On le donne à Boyd. On dort sous son toit.', 'c3_tr_c', { trust: -1, set: ['boyd_album'] }]),
  ],
  c3_tr_a: [
    m('nina', 'Vous nous avez rendu notre album.'),
    m('nina', 'On ne l’oubliera jamais.'),
    m('jojo', 'je pleure. c’est mon mascara qui coule mais je pleure 😭💖'),
    go('c3_investir'),
  ],
  c3_tr_b: [m('momo', 'Momo le met au coffre. Boyd peut toujours essayer.'), go('c3_investir')],
  c3_tr_c: [m('mara', 'Si tu le dis.', 6), m('mara', 'Je ne suis pas sûre de reconnaître le {name} que j’attendais derrière les barreaux.'), go('c3_investir')],
  c3_investir: [
    m('kenzo', 'Écoute-moi bien, frérot.', 3 * H),
    m('kenzo', '3 000 $ et vous devenez associés de Néon Records. Quand les Sirènes exploseront, vous toucherez votre part. Légalement.'),
    ch('kenzo',
      ['On investit. Je crois en elles.', 'c3_inv_a', { set: ['investi'] }],
      ['Légal ? Ça me changera. J’en suis.', 'c3_inv_b', { rep: 1, set: ['investi'] }],
      ['Pas maintenant, Kenzo.', 'c3_inv_c']),
  ],
  c3_inv_a: [m('kenzo', 'C’est LOURD. Bienvenue dans la famille.'), go('c3_gate')],
  c3_inv_b: [m('kenzo', 'Légal à 100 %. Bon, à 92 %. Les 8 % restants, c’est de l’artistique.'), go('c3_gate')],
  c3_inv_c: [m('kenzo', 'Je comprends. La porte reste ouverte, frérot.'), go('c4', 3 * H)],
  c3_gate: [
    { t: 'gate', from: 'kenzo', money: 3000, objective: 'Réunir 3 000 $ pour entrer dans Néon Records', label: 'Parts de Néon Records' },
    m('kenzo', 'Parts reçues. Associés officiels. 🎶'),
    m('jojo', 'on vous écrit une chanson. titre provisoire : « les amoureux en cavale ». nina dit que c’est nul. nina a tort', 2 * MIN),
    go('c4', 3 * H),
  ],

  // ─────────────── Chapitre 4 : Le coup (≈ 15 h) ───────────────
  c4: [
    { t: 'chapter', n: 4 },
    m('boyd', 'Vous jouez dans la cour des grands, maintenant.'),
    m('boyd', 'J’ai quelqu’un à vous présenter.'),
    { t: 'if', test: (v) => !!v.flags.boyd_album, then: 'c4_boyd_merci', else: 'c4_santos' },
  ],
  c4_boyd_merci: [m('boyd', 'Merci pour l’album, au fait. Kenzo mange dans ma main, maintenant.'), go('c4_santos')],
  c4_santos: [
    m('santos', 'Santos Vidal.', 30 * MIN),
    m('santos', 'Dix-sept banques. Zéro arrestation. Zéro blessé.'),
    m('santos', 'Boyd dit que tu es un ancien militaire. Bien. Les militaires savent suivre un plan.'),
    m('santos', 'Cible : la Banque Flamant. Matériel : 4 000 $. Je ne fais pas crédit.'),
    ch('santos',
      ['Comme à l’armée : on repère, on planifie, on exécute.', 'c4_sa_a', { rep: 1 }],
      ['Personne ne doit être blessé. C’est ma seule condition.', 'c4_sa_b', { trust: 1, set: ['sans_blesse'] }],
      ['Combien pour nous ?', 'c4_sa_c']),
  ],
  c4_sa_a: [m('santos', 'Exactement.'), go('c4_gate')],
  c4_sa_b: [m('santos', 'C’est aussi la mienne. Nous allons bien nous entendre.'), m('mara', 'Merci. Je n’aurais pas pu vivre avec ça.'), go('c4_gate')],
  c4_sa_c: [m('santos', 'Un tiers. Comme tout le monde.'), m('santos', 'La cupidité est la première cause d’arrestation, au fait.'), go('c4_gate')],
  c4_gate: [
    { t: 'gate', from: 'santos', money: 4000, objective: 'Réunir 4 000 $ pour le matériel de Santos', label: 'Matériel pour Santos' },
    m('santos', 'Reçu.'),
    m('santos', 'Il me faut une diversion. Qui ?'),
    ch('santos',
      ['Teo. Il est maladroit, mais loyal à la mort.', 'c4_eq_a', { trust: 1, set: ['equipe_teo'] }],
      ['Les Sirènes : un concert surprise devant la banque.', 'c4_eq_b', { set: ['equipe_sirenes'] }],
      ['Les gars de Big Momo. Des pros.', 'c4_eq_c', { rep: 1, set: ['equipe_momo'] }]),
  ],
  c4_eq_a: [m('teo', 'MOI ?!? Je suis dans le COUP ?!? Je mets la chemise à flamants ou c’est trop voyant ?'), m('santos', 'C’est trop voyant.'), go('c4_reperage')],
  c4_eq_b: [m('jojo', 'un concert surprise devant une banque à 3 h du mat ? plus beau jour de ma vie'), m('nina', 'On ne pose pas de questions. Mais on en pense beaucoup.'), go('c4_reperage')],
  c4_eq_c: [m('momo', 'Mes garçons seront là. Momo prend 10 %. Pour le dérangement.'), go('c4_reperage')],
  c4_reperage: [
    m('santos', 'D’abord, le repérage. Gardes, fourgons, caméras.', 2 * H),
    mission({
      id: 'reperage', title: 'Repérage à la Banque Flamant', description: 'Tes réflexes de soldat reviennent : noter les rondes des gardes, l’heure des fourgons et l’angle des caméras.',
      map: 'city', poi: 'banque', durationSec: 90 * MIN, risk: 0.1, reward: 0, wanted: 0, win: 'c4_vehicule', fail: 'c4_vehicule',
    }),
  ],
  c4_vehicule: [
    m('santos', 'Deux gardes à 2 h. Fourgon à 4 h 15. Il nous faut un véhicule sans histoire.', 2 * H),
    m('rico', 'Une voiture « discrète » ? Je ne veux RIEN savoir.', 30 * MIN),
    m('rico', 'Les clés seront sur le pneu avant gauche. Et ramène-la propre, frérot.'),
    mission({
      id: 'vehicule', title: 'La voiture fantôme', description: 'Récupérer au garage de Rico une voiture sans histoire, et la garer près de la banque.',
      map: 'city', poi: 'garage', durationSec: H, risk: 0.15, reward: 0, wanted: 0, win: 'c4_plan', fail: 'c4_plan',
    }),
  ],
  c4_plan: [
    m('santos', 'Tout est prêt. Dernière décision : le plan.', 2 * H),
    ch('santos',
      ['Discret. De nuit, par les sous-sols.', 'c4_pl_a', { set: ['discret'] }],
      ['Rapide. Deux minutes chrono.', 'c4_pl_b']),
  ],
  c4_pl_a: [
    m('santos', 'Lent, silencieux, propre. Mon préféré.'),
    mission({
      id: 'coffre_d', title: 'Le coffre (plan discret)', description: 'Une longue nuit sous la Banque Flamant. Lent, mais silencieux.',
      map: 'city', poi: 'banque', durationSec: 3 * H, risk: 0.3, reward: 15000, wanted: 2, win: 'c4_reussi', fail: 'c4_rate',
    }),
  ],
  c4_pl_b: [
    m('santos', 'Plus d’argent. Plus de bruit. Plus de sirènes.'),
    m('mara', 'Ça me rappelle pourquoi j’ai fait trois ans.'),
    mission({
      id: 'coffre_r', title: 'Le coffre (plan rapide)', description: 'Deux minutes chrono à la Banque Flamant. Gros butin, grosses sirènes.',
      map: 'city', poi: 'banque', durationSec: 45 * MIN, risk: 0.4, reward: 20000, wanted: 4, win: 'c4_reussi', fail: 'c4_rate',
    }),
  ],
  c4_rate: [
    m('santos', 'Annulé. Sirènes. Dispersion.'),
    m('mara', 'On fait profil bas. Santos dit qu’on peut retenter.', MIN),
    go('c4_plan', 3 * H),
  ],
  c4_reussi: [
    m('santos', 'Coffre vide. Personne de blessé. Vos parts sont sur le bateau de Boyd.'),
    m('santos', 'Je disparais. Ce fut un plaisir de travailler avec un professionnel.'),
    m('mara', 'On l’a fait, {name}.', H),
    m('mara', 'On l’a vraiment fait.'),
    go('c5', 3 * H),
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
        'J’ai rien dit. Enfin… je leur ai expliqué ma théorie sur le Lac Miroir. Pendant quarante minutes.',
        'Ils sont partis. Faites attention à vous. Vraiment.',
      ],
    },
    m('boyd', 'Changement de programme, les amoureux.', 3 * H),
    m('boyd', 'Je garde 70 % du butin. Sinon, la police reçoit un appel anonyme.'),
    { t: 'if', test: (v) => !!v.flags.boyd_dette, then: 'c5_dette', else: 'c5_choix' },
  ],
  c5_dette: [m('boyd', 'Et n’oubliez pas mon bateau. Avec les intérêts.'), go('c5_choix')],
  c5_choix: [
    m('mara', 'Il nous fait chanter.', H),
    m('mara', 'Je te suis, {name}. Mais choisis bien.'),
    ch('mara',
      ['On le paie. Et on part avec son bateau.', 'c5_boyd'],
      ['On lui tient tête. Avec Big Momo.', 'c5_momo'],
      ['On prend la route cette nuit. Toi et moi.', 'c5_route'],
      ['On garde tout. Je ne lâche pas un dollar.', 'c5_argent', { trust: -2 }]),
  ],
  c5_boyd: [{ t: 'if', test: (v) => v.trust >= 2 && !v.flags.boyd_dette, then: 'c5_phare', else: 'c5_trahi' }],
  c5_phare: [
    m('boyd', 'Le bateau vous attend au phare. Minuit.', 30 * MIN),
    m('boyd', 'Ne soyez pas en retard. La marée n’attend personne.'),
    mission({
      id: 'phare', title: 'Le bateau de minuit', description: 'Traverser le Pont de la Baie jusqu’au phare de l’Île aux Flamants, sans se faire repérer.',
      map: 'city', poi: 'phare', durationSec: H, risk: 0.15, reward: 0, wanted: 0, win: 'fin_large', fail: 'fin_prison',
    }),
  ],
  c5_trahi: [
    m('boyd', 'Désolé, les amoureux. Les affaires sont les affaires.', H),
    m('mara', 'Des gyrophares tout autour du phare… Il nous a vendus.', MIN),
    { t: 'end', ending: 'prison' },
  ],
  c5_momo: [
    m('momo', 'Boyd ? Il doit plus d’argent à Momo que tout Port Corail réuni.', H),
    m('momo', 'Laissez faire Momo.'),
    { t: 'if', test: (v) => v.rep >= 2 && !!v.flags.investi, then: 'c5_rois', else: 'c5_confrontation' },
  ],
  c5_rois: [
    m('kenzo', 'LES SIRÈNES SONT NUMÉRO UN. Je répète : NUMÉRO UN.', 2 * H),
    m('kenzo', 'Néon Records vous verse votre part. Bienvenue dans le monde légal, associés 😎'),
    m('nina', '« Les Amoureux en cavale » passe sur toutes les radios de Solenne. C’est votre chanson.'),
    m('jojo', 'j’avais dit que c’était un bon titre. je dis ça. 💅'),
    { t: 'end', ending: 'rois' },
  ],
  c5_confrontation: [
    m('momo', 'Boyd ne veut rien entendre. Il faudra aller le voir.'),
    m('momo', 'Mes garçons vous couvrent. Ramenez son bateau.'),
    mission({
      id: 'confrontation', title: 'Régler ses comptes au ponton', description: 'Aller au ponton n°9 avec les gars de Big Momo, et repartir avec le bateau de Boyd.',
      map: 'state', poi: 'ponton', durationSec: 2 * H, risk: 0.35, reward: 0, wanted: 1, win: 'fin_large', fail: 'fin_prison',
    }),
  ],
  c5_route: [{ t: 'if', test: (v) => v.trust <= -1, then: 'fin_seul', else: 'c5_fuite' }],
  c5_argent: [{ t: 'if', test: (v) => v.trust >= 2, then: 'c5_fuite', else: 'fin_seul' }],
  c5_fuite: [
    m('mara', 'Phares éteints jusqu’à Bellerive. Comme dans les films.'),
    mission({
      id: 'route', title: 'La route côtière', description: 'Traverser tout l’État jusqu’à Bellerive avec le butin, en évitant les barrages.',
      map: 'state', poi: 'motel', durationSec: 3 * H, risk: 0.3, reward: 0, wanted: 1, win: 'fin_route', fail: 'fin_prison',
    }),
  ],
  fin_large: [{ t: 'end', ending: 'large' }],
  fin_route: [{ t: 'end', ending: 'route' }],
  fin_prison: [{ t: 'end', ending: 'prison' }],
  fin_seul: [m('mara', 'Je t’aime, {name}.', 2 * H), m('mara', 'Mais pas comme ça.'), { t: 'end', ending: 'seul' }],
};

/**
 * Réponses quand on écrit librement à un personnage de l’histoire, selon le chapitre (6 = après la fin).
 * Elles restent dans le ton de chacun et ne contredisent pas ce qui se passe.
 */
export const STORY_REPLIES: Record<string, Partial<Record<number, string[]>>> = {
  mara: {
    1: ['Plus que quelques heures. Je compte les minutes.', 'Garde tes mots doux pour demain. Je veux les entendre en vrai.'],
    2: ['On va s’en sortir. Il faut juste un toit et un peu d’argent.', 'Le canapé de Teo grince TOUTE la nuit, {name}.'],
    3: ['J’aime bien les Sirènes. Jojo surtout. Elle me fait rire.', 'Port Corail la nuit… j’avais oublié comme c’est beau.'],
    4: ['Santos me fait peur. Mais il est bon.', 'Encore un coup, et après on arrête. Promis ?'],
    5: ['Quoi qu’il arrive cette nuit, je suis contente que ce soit toi.', 'Garde ton téléphone chargé.'],
    6: ['On l’a vécue, notre histoire.', 'Tu veux recommencer ? Moi, je dis oui.'],
  },
  teo: {
    1: ['Demain c’est le grand jour, frère !!! 🛸', 'Tu savais que le pénitencier est construit sur un ancien site d’atterrissage ? Non ? Moi non plus. Mais j’y crois.'],
    2: ['Si Boyd te demande ce qu’il y a dans les caisses, ne réponds RIEN.', 'J’ai vu des lumières au-dessus du Marais. Encore.'],
    3: ['La chemise à flamants est repassée. Les vrais savent. 🦩', 'Jojo m’a dit que j’étais drôle. JOJO.'],
    4: ['Je suis né pour ce moment, frère. Enfin, je crois.', 'Si on me demande, j’étais chez moi à regarder le ciel.'],
    5: ['Faites attention à vous. Je suis sérieux, pour une fois.', 'Quoi qu’il arrive, mon canapé est là.'],
    6: ['Raconte-moi TOUT. Avec les détails.', 'Je l’ai toujours dit : vous deux, c’est écrit dans les étoiles. 🌌'],
  },
  boyd: {
    2: ['Pas par message.', 'Règle numéro un.'],
    3: ['Les Îles ont des oreilles.', 'Je n’aime pas les bavards.'],
    4: ['Santos est le meilleur. Écoutez-le.', 'Pas au téléphone.'],
    5: ['70 %. C’est mon dernier mot.', 'La marée monte, les amoureux.'],
    6: ['…', 'Le Pélican n’a rien à vous dire.'],
  },
  santos: {
    4: ['Pas de messages inutiles.', 'Le plan. Seulement le plan.'],
    5: ['Je n’existe plus.', 'Ce numéro ne sera plus attribué demain.'],
    6: ['Ce numéro n’est plus attribué.'],
  },
  momo: {
    2: ['Momo t’écoute.', 'Passe au bureau, mon enfant. On parle mieux autour d’un café.'],
    3: ['Le Vieux Port est calme. Momo aime quand c’est calme.', 'Un bon propriétaire connaît le prénom de tous ses locataires.'],
    4: ['Momo ne veut rien savoir de vos affaires. Mais Momo sait tout.', 'Mes garçons sont prêts si vous en avez besoin.'],
    5: ['Boyd a oublié une chose : à Port Corail, tout le monde doit quelque chose à Momo.', 'Courage, mes enfants.'],
    6: ['La porte de Momo vous reste ouverte.'],
  },
  kenzo: {
    2: ['Frérot, je suis en studio, c’est lourd ce qu’on fait.', 'Tu entends ce beat ? C’est le futur.'],
    3: ['Les filles vont exploser, je te le dis.', 'Néon Records, retiens bien ce nom.'],
    4: ['Je sais rien, je vois rien, je produis.', 'Prends soin de toi, frérot.'],
    5: ['Le single sort bientôt. Il faut que tu sois là pour l’entendre.', 'Ça sent la fin de quelque chose. Ou le début.'],
    6: ['Quelle histoire, frérot. Faudrait en faire un album.'],
  },
  nina: {
    3: ['On répète. Je te réponds plus tard.', 'Jojo te dit bonjour. Elle crie, en vrai.'],
    4: ['On ne pose pas de questions. Mais on en pense beaucoup.', 'On a écrit un couplet sur vous deux.'],
    5: ['On pense à vous.', 'Quoi qu’il arrive, cette chanson est à vous.'],
    6: ['Merci pour tout. Vraiment.'],
  },
  jojo: {
    3: ['mdr', 'attends je finis mon ongle 💅', 'nina dit que je parle trop. nina a raison'],
    4: ['je sais rien 🫡', 'si on me demande j’étais au studio. c vrai en plus'],
    5: ['je suis stressée pour vous 😭', 'envoyez des nouvelles svp'],
    6: ['on a fait une chanson sur vous. elle est trop bien. évidemment'],
  },
};

/** Quand le personnage attend une réponse à un choix, il le rappelle. */
export const STORY_NUDGE: Record<string, string> = {
  mara: 'Réponds d’abord à ma question, {name}.',
  teo: 'Frère. FRÈRE. Réponds à ma question d’abord.',
  boyd: 'J’attends une réponse. Pas une conversation.',
  santos: 'Une réponse. Pas un message.',
  momo: 'Momo attend ta réponse, mon enfant.',
  kenzo: 'Alors frérot, t’en dis quoi de ma proposition ?',
  nina: 'Tu viens, alors ?',
  jojo: 'réponds à nina 😤',
};
