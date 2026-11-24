// « La Cavale » : l’histoire principale de NeonCell, dans l’État fictif de Solenne.
// Un couple en fuite, des alliés douteux, des choix qui comptent. Personnages et lieux inventés.

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

export const CHAPTERS = ['', 'La sortie', 'Les Îles', 'Le gros coup', 'Les vautours', 'La dernière nuit'];

export type Ending = { id: string; title: string; text: string; emoji: string };

export const ENDINGS: Ending[] = [
  { id: 'large', emoji: '🌊', title: 'Le grand large', text: 'Port Corail disparaît à l’horizon. Mara pose sa tête sur ton épaule. Plus d’avis de recherche, plus de dettes : juste l’océan, et vous deux.' },
  { id: 'rois', emoji: '👑', title: 'Les nouveaux rois de Port Corail', text: 'Le motel de Bellerive affiche complet. Véra Lenz a tenu parole, et votre argent est devenu propre. Personne ne pose de questions aux propriétaires.' },
  { id: 'route', emoji: '🛣️', title: 'Les fantômes de la route', text: 'Une décapotable, un sac de billets, la route côtière à perte de vue. Vous ne vous arrêtez jamais deux nuits au même endroit. C’est ça, la liberté ?' },
  { id: 'prison', emoji: '⛓️', title: 'Derrière les barreaux', text: 'Les gyrophares, puis le silence. Au pénitencier de Canneville, une lettre de Mara arrive chaque semaine. Elle finit toujours par : « On recommencera. »' },
  { id: 'lessives', emoji: '💸', title: 'Lessivés', text: 'Véra Lenz a disparu avec tout l’argent. Vous revoilà à zéro, sur un banc de la marina. Mara rit : « Au moins, on est ensemble. »' },
];

export const STORY_CONTACTS = ['mara', 'boyd', 'santos', 'vera', 'dussart'];

const m = (from: string, text: string, wait?: number): Beat => ({ t: 'msg', from, text, wait });

export const NODES: Record<string, Beat[]> = {
  start: [
    { t: 'chapter', n: 1 },
    m('mara', 'C’est moi. Mara. Ils me libèrent demain matin, 8 h, au pénitencier de Canneville.', 2),
    m('mara', 'Trois ans, {name}. Trois ans. J’ai pas envie de rentrer en bus.'),
    {
      t: 'choice',
      from: 'mara',
      options: [
        { label: 'J’y serai à 8 h pile. ❤️', go: 'sortie', effects: { trust: 1 } },
        { label: 'J’envoie Rico, j’ai un truc à régler.', go: 'rico', effects: { trust: -1 } },
      ],
    },
  ],
  sortie: [
    m('mara', 'T’as intérêt. Et ramène des tacos.'),
    {
      t: 'mission',
      mission: {
        id: 'sortie', title: 'Chercher Mara', description: 'Rouler jusqu’au pénitencier de Canneville et ramener Mara à la maison.',
        map: 'state', poi: 'penitencier', durationSec: 25, risk: 0, reward: 0, wanted: 0, win: 'apres_sortie', fail: 'apres_sortie',
      },
    },
  ],
  rico: [
    m('rico', 'J’ai récupéré ta copine… Elle m’a pas adressé un mot de tout le trajet 😬', 20),
    m('mara', 'Rico conduit comme ma grand-mère. On en reparlera.'),
    { t: 'goto', go: 'apres_sortie' },
  ],
  apres_sortie: [
    { t: 'chapter', n: 2 },
    m('mara', 'Bon. On a zéro dollar, pas d’appart à mon nom, et une agente de probation sur le dos.', 6),
    m('mara', 'Mon cousin connaît un type aux Îles Coquillages. Boyd « le Pélican ». Il loge des gens… contre des services.'),
    {
      t: 'choice',
      from: 'mara',
      options: [
        { label: 'On va voir Boyd.', go: 'boyd', effects: { set: ['boyd'] } },
        { label: 'On reste réglo : je bosse avec l’Agence Soleil.', go: 'reglo', effects: { rep: 1 } },
      ],
    },
  ],
  reglo: [
    m('mara', 'D’accord, monsieur l’honnête homme. Il nous faut 800 $ pour la caution d’un appart.'),
    { t: 'gate', from: 'mara', money: 800, objective: 'Réunir 800 $ pour la caution (appli Boulots)', label: 'Caution de l’appartement' },
    m('mara', '800 $, payés. On a un toit. Minuscule, mais à nous. 🏠'),
    m('boyd', 'On m’a parlé de vous deux. Si un jour vous voulez gagner plus vite… mon ponton, aux Îles.', 25),
    { t: 'goto', go: 'santos_intro' },
  ],
  boyd: [
    m('boyd', 'Alors c’est vous, les amoureux ? Mon ponton, aux Îles Coquillages, 22 h. Venez seuls.'),
    {
      t: 'mission',
      mission: {
        id: 'ponton', title: 'Rendez-vous au ponton', description: 'Traverser le pont des Îles et rejoindre Boyd sur son ponton.',
        map: 'state', poi: 'ponton', durationSec: 30, risk: 0.05, reward: 0, wanted: 0, win: 'boyd_offre', fail: 'boyd_offre',
      },
    },
  ],
  boyd_offre: [
    m('boyd', 'Règle n°1 : chez moi, on ne pose pas de questions sur les caisses.'),
    m('boyd', 'J’ai un bateau à ramener depuis le Marais des Sauriens. Discrètement. 600 $ pour vous.'),
    {
      t: 'choice',
      from: 'boyd',
      options: [
        { label: 'On le fait.', go: 'bateau' },
        { label: 'Mara pilote, moi je surveille.', go: 'bateau', effects: { trust: 1 } },
        { label: 'Non, trop risqué.', go: 'santos_intro', effects: { rep: 1, trust: -1 } },
      ],
    },
  ],
  bateau: [
    {
      t: 'mission',
      mission: {
        id: 'bateau', title: 'Le bateau de Boyd', description: 'Remonter les mangroves du Marais des Sauriens et ramener le bateau aux Îles sans croiser les garde-côtes.',
        map: 'state', poi: 'cabane', durationSec: 45, risk: 0.25, reward: 600, wanted: 2, win: 'bateau_ok', fail: 'bateau_ko',
      },
    },
  ],
  bateau_ok: [m('boyd', 'Pas une rayure. Vous me plaisez, vous deux.'), { t: 'effects', effects: { rep: 1 } }, { t: 'goto', go: 'santos_intro' }],
  bateau_ko: [
    m('mara', 'Les garde-côtes ! On a dû abandonner le bateau dans les mangroves…'),
    m('boyd', 'Vous me devez un bateau. On en reparlera.'),
    { t: 'effects', effects: { set: ['boyd_fache'] } },
    { t: 'goto', go: 'santos_intro' },
  ],
  santos_intro: [
    { t: 'chapter', n: 3 },
    m('mara', 'Quelqu’un veut nous voir. Santos Vidal. Il paraît qu’il n’a jamais raté un coup.', 30),
    m('santos', 'On m’a dit que vous saviez garder votre sang-froid. J’ai un projet : le coffre de la Banque Flamant.'),
    m('santos', 'Mais il faut du matériel. 2 000 $. Je ne fais pas crédit.'),
    { t: 'gate', from: 'santos', money: 2000, objective: 'Réunir 2 000 $ pour le matériel de Santos', label: 'Matériel pour Santos' },
    m('santos', 'Reçu. Maintenant, le plan.'),
    { t: 'goto', go: 'plan' },
  ],
  plan: [
    {
      t: 'choice',
      from: 'santos',
      options: [
        { label: 'Plan discret : de nuit, par les sous-sols.', go: 'coffre_discret', effects: { set: ['discret'] } },
        { label: 'Plan rapide : deux minutes, on entre, on sort.', go: 'coffre_rapide' },
      ],
    },
  ],
  coffre_discret: [
    {
      t: 'mission',
      mission: {
        id: 'coffre_d', title: 'Le coffre (plan discret)', description: 'Une longue nuit sous la Banque Flamant. Lent, mais silencieux.',
        map: 'city', poi: 'banque', durationSec: 75, risk: 0.3, reward: 6000, wanted: 2, win: 'vautours', fail: 'coffre_rate',
      },
    },
  ],
  coffre_rapide: [
    {
      t: 'mission',
      mission: {
        id: 'coffre_r', title: 'Le coffre (plan rapide)', description: 'Deux minutes chrono à la Banque Flamant. Gros butin, grosses sirènes.',
        map: 'city', poi: 'banque', durationSec: 40, risk: 0.4, reward: 9000, wanted: 4, win: 'vautours', fail: 'coffre_rate',
      },
    },
  ],
  coffre_rate: [
    m('santos', 'Annulé ! La police est arrivée trop vite. On se disperse.'),
    m('mara', 'On laisse retomber la pression, et on retente. Santos est prêt quand on l’est.', 8),
    { t: 'goto', go: 'plan', wait: 20 },
  ],
  vautours: [
    { t: 'chapter', n: 4 },
    { t: 'call', from: 'dussart', wait: 20, lines: ['Inspectrice Dussart, police d’État.', 'Un braquage à la Banque Flamant. Un couple, d’après les caméras.', 'Je ne dis pas que c’est vous. Je dis que je vous ai à l’œil.', 'Bonne soirée, {name}.'] },
    m('mara', 'C’était qui ? … Dussart ? Elle bluffe. Je crois.', 4),
    m('vera', 'Bonjour. Véra Lenz, Lenz Immobilier. J’ai une proposition pour… votre argent.', 15),
    m('vera', 'J’investis votre argent pour vous, contre la moitié. En échange : un motel à Bellerive, à votre nom, parfaitement en règle.'),
    { t: 'if', test: (v) => !!v.flags.boyd_fache, then: 'boyd_menace', else: 'boyd_ami' },
  ],
  boyd_menace: [m('boyd', 'Mon bateau. Je ne l’ai pas oublié.', 10), { t: 'goto', go: 'decision' }],
  boyd_ami: [m('boyd', 'Les amoureux, j’ai une sortie pour vous : un bateau, cette nuit, depuis le phare. Direction le large. Pour mes amis, c’est gratuit.', 10), { t: 'goto', go: 'decision' }],
  decision: [
    m('mara', 'À toi de choisir, {name}. Je te suis.'),
    {
      t: 'choice',
      from: 'mara',
      options: [
        { label: 'On fait confiance à Véra.', go: 'fin_vera' },
        { label: 'On part avec Boyd, par la mer.', go: 'fin_boyd' },
        { label: 'Personne. On garde tout et on prend la route.', go: 'fin_route' },
      ],
    },
  ],
  fin_vera: [
    { t: 'chapter', n: 5 },
    m('mara', 'Quoi qu’il arrive… je suis contente que ce soit toi.'),
    m('vera', 'Virement bien reçu. Signature demain, 9 h.', 15),
    { t: 'if', test: (v) => v.trust >= 1 && v.rep >= 1, then: 'fin_rois', else: 'fin_lessives' },
  ],
  fin_rois: [m('vera', 'Félicitations, propriétaires. Bienvenue à Bellerive.', 10), { t: 'end', ending: 'rois' }],
  fin_lessives: [m('mara', 'Son numéro ne répond plus. Le bureau est vide. Elle est partie avec tout.', 20), { t: 'end', ending: 'lessives' }],
  fin_boyd: [
    { t: 'chapter', n: 5 },
    m('mara', 'Quoi qu’il arrive… je suis contente que ce soit toi.'),
    { t: 'if', test: (v) => !!v.flags.boyd_fache, then: 'fin_piege', else: 'fin_phare' },
  ],
  fin_piege: [m('dussart', 'Un certain Boyd m’a donné rendez-vous au phare. Pour me parler de vous.', 15), { t: 'end', ending: 'prison' }],
  fin_phare: [
    {
      t: 'mission',
      mission: {
        id: 'phare', title: 'Rejoindre le bateau au phare', description: 'Traverser le Pont de la Baie jusqu’à l’Île aux Flamants sans se faire repérer.',
        map: 'city', poi: 'phare', durationSec: 40, risk: 0.15, reward: 0, wanted: 0, win: 'fin_large', fail: 'fin_prison',
      },
    },
  ],
  fin_large: [{ t: 'end', ending: 'large' }],
  fin_prison: [{ t: 'end', ending: 'prison' }],
  fin_route: [
    { t: 'chapter', n: 5 },
    m('mara', 'Quoi qu’il arrive… je suis contente que ce soit toi.'),
    {
      t: 'mission',
      mission: {
        id: 'route', title: 'Fuir par la route côtière', description: 'Traverser l’État jusqu’à Bellerive avec tout l’argent, en évitant les barrages.',
        map: 'state', poi: 'motel', durationSec: 50, risk: 0.35, reward: 0, wanted: 1, win: 'fin_route_ok', fail: 'fin_prison',
      },
    },
  ],
  fin_route_ok: [{ t: 'end', ending: 'route' }],
};
