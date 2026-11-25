// Univers fictif de NeonCell : la ville de Port Corail, sur une côte ensoleillée.
// Tous les noms, marques et personnages sont inventés.

export type Contact = {
  id: string;
  name: string;
  avatar: string;
  color: string;
  number: string;
  /** Premier message reçu au démarrage du téléphone. */
  opening: string;
  /** Réponses déclenchées par des mots clés (sans accents, en minuscules). */
  triggers: { words: string[]; replies: string[] }[];
  /** Réponses quand aucun mot clé ne correspond. */
  generic: string[];
  /** Messages spontanés envoyés de temps en temps. */
  spontaneous: string[];
  /** Répliques entendues pendant un appel. */
  call: string[];
  /** Personnage de l’histoire : n’apparaît qu’à son premier message. */
  story?: true;
};

export const CONTACTS: Contact[] = [
  {
    id: 'maman',
    name: 'Maman',
    avatar: '👩',
    color: '#FF8FB1',
    number: '555-0101',
    opening: 'Tu as bien mis de la crème solaire ? Il fait 34 degrés à Port Corail aujourd’hui 🌞',
    triggers: [
      { words: ['oui', 'ok', 'daccord', 'promis'], replies: ['Bien. Et mange des légumes, pas que des tacos.', 'Je te fais confiance… à moitié 😄'] },
      { words: ['argent', 'sous', 'thune', 'fric', '$'], replies: ['Encore ? Je t’ai fait un virement le mois dernier !', 'Demande à ton oncle Vince… non, en fait, ne lui demande rien.'] },
      { words: ['bisou', 'aime', 'love', '❤'], replies: ['Moi aussi mon cœur ❤️', 'Gros bisous, appelle-moi dimanche !'] },
    ],
    generic: ['Tu passes manger quand ?', 'Ton père demande si tu as réparé la clim.', 'D’accord. Sois prudent sur la route côtière.'],
    spontaneous: ['Tu as vu la météo ? Un orage arrive ce soir.', 'J’ai fait du flan, il t’en reste une part.', 'Ton cousin a eu son permis bateau 🚤'],
    call: ['Allô ? Ah, enfin tu décroches !', 'Je voulais juste savoir si tu allais bien.', 'Ne rentre pas trop tard, d’accord ?', 'Bon, je te laisse, bisous !'],
  },
  {
    id: 'rico',
    name: 'Rico',
    avatar: '🔧',
    color: '#FFB347',
    number: '555-0142',
    opening: 'Frérot, la décapotable est prête. J’ai changé les pneus et le néon sous le châssis 😎',
    triggers: [
      { words: ['voiture', 'caisse', 'auto', 'moteur', 'garage'], replies: ['Passe au garage quand tu veux, je t’ai fait un prix d’ami.', 'Elle ronronne comme un chat maintenant.'] },
      { words: ['merci', 'cool', 'top', 'genial'], replies: ['Tranquille, c’est pour la famille 🤙', 'Tu me revaudras ça !'] },
      { words: ['course', 'vitesse', 'rouler'], replies: ['Course ce soir sur le pont de la baie ? Juste pour l’honneur bien sûr.', 'Doucement, les flics de Port Corail ont des nouveaux radars.'] },
    ],
    generic: ['Haha grave', 'Je suis sous une voiture, je te réponds plus tard.', 'T’es où ? Viens au garage.'],
    spontaneous: ['Un client m’a ramené une voiture de sport toute rose 💗', 'J’ai besoin d’un coup de main samedi, t’es dispo ?', 'Regarde Palmfeed, Jade a posté une vidéo de malade.'],
    call: ['Yo !', 'Écoute, j’ai trouvé une pièce rare pour ta caisse.', 'Viens la voir avant que quelqu’un d’autre la prenne.', 'Allez, à plus !'],
  },
  {
    id: 'jade',
    name: 'Jade',
    avatar: '🎧',
    color: '#2DE2E6',
    number: '555-0177',
    opening: 'Je mixe au Flamingo Club samedi ! Je te mets sur la liste VIP ? 🎶',
    triggers: [
      { words: ['oui', 'grave', 'carrement', 'ok', 'vip'], replies: ['C’est fait ! Viens avant minuit 🪩', 'Trop bien, ramène Rico.'] },
      { words: ['non', 'pas dispo', 'occupe'], replies: ['Dommage… la prochaine alors !', 'Pff, tu rates la soirée de l’année 😤'] },
      { words: ['musique', 'son', 'mix', 'dj'], replies: ['J’ai un nouveau son synthwave, je te l’envoie.', 'Je prépare un set 100 % années 80 ✨'] },
    ],
    generic: ['Mdr', 'Attends, je suis en répétition.', 'Tu viens à la plage demain ?'],
    spontaneous: ['Le coucher de soleil à la marina, c’est fou ce soir 🌅', 'Quelqu’un a volé mon casque… non je l’ai retrouvé, il était sur ma tête.', 'Story Palmfeed dans 5 min, like stp !'],
    call: ['Heyyy !', 'Tu entends la musique derrière ? Je suis au club.', 'Viens, il y a une ambiance de fou !', 'Je dois y aller, bisous !'],
  },
  {
    id: 'vince',
    name: 'Tonton Vince',
    avatar: '🕶️',
    color: '#8A4DFF',
    number: '555-0199',
    opening: 'Neveu ! J’ai une idée de business en or. Des lunettes de soleil… pour chiens. Tu en penses quoi ?',
    triggers: [
      { words: ['nul', 'non', 'bof', 'idiot'], replies: ['Tu dis ça parce que tu n’as pas de vision.', 'Bon, et des glaces pour chats alors ?'] },
      { words: ['oui', 'genial', 'bonne idee', 'super'], replies: ['Je le savais ! On sera millionnaires 💸', 'Mets 500 $, je mets l’enthousiasme.'] },
      { words: ['argent', 'pret', 'dette'], replies: ['Je te rembourse lundi. Quel lundi, je ne sais pas encore.', 'L’argent, c’est une construction sociale.'] },
    ],
    generic: ['Ne le dis pas à ta mère.', 'J’ai acheté un bateau. Enfin, la moitié d’un bateau.', 'Fais-moi confiance.'],
    spontaneous: ['Nouvelle idée : un food-truck de sushis… sur un bateau.', 'Si quelqu’un demande, j’étais avec toi hier soir.', 'J’ai gagné au bingo du port ! 40 $ !'],
    call: ['Neveu ! Mon neveu préféré !', 'Écoute, j’ai une proposition à te faire…', 'Non, non, rien d’illégal, juste… original.', 'Je te rappelle, il y a quelqu’un à la porte !'],
  },
  {
    id: 'agence',
    name: 'Agence Soleil',
    avatar: '💼',
    color: '#3DDC97',
    number: '555-0123',
    opening: 'Bonjour ! De nouveaux petits boulots sont disponibles dans l’appli Boulots. Bonne journée ☀️',
    triggers: [
      { words: ['boulot', 'travail', 'job', 'mission'], replies: ['Ouvrez l’appli Boulots pour voir les offres du jour.', 'Nous avons des livraisons et du convoyage disponibles.'] },
    ],
    generic: ['Merci pour votre message. Un conseiller vous répondra rapidement.', 'L’Agence Soleil vous remercie de votre confiance.'],
    spontaneous: ['Nouvelle offre disponible : consultez l’appli Boulots.', 'Rappel : vos paiements sont versés sur votre compte Banque Flamant.'],
    call: ['Agence Soleil, bonjour.', 'Toutes nos offres sont visibles dans l’appli Boulots.', 'Merci de votre appel, bonne journée !'],
  },
  {
    id: 'inconnu',
    name: 'Numéro masqué',
    avatar: '❔',
    color: '#6B6385',
    number: '555-0000',
    opening: 'Je sais ce que tu as fait l’été dernier… tu as mis de l’ananas sur la pizza. 🍍',
    triggers: [
      { words: ['qui', 'toi', 'nom'], replies: ['Peu importe qui je suis.', 'Quelqu’un qui aime la pizza normale.'] },
    ],
    generic: ['…', 'Regarde derrière toi. Non, je rigole.', 'On se reverra.'],
    spontaneous: ['Le phare. Minuit. Apporte des chips.', 'Tu ne me connais pas, mais moi je connais ton historique Palmfeed.'],
    call: ['…', 'Respiration mystérieuse', 'Tu as faux pour la pizza.', 'Bip… bip… bip…'],
  },
  {
    id: 'mara',
    name: 'Mara',
    avatar: '💋',
    color: '#FF3D8B',
    number: '555-0313',
    story: true,
    opening: '',
    triggers: [
      { words: ['aime', 'love', '❤', 'coeur'], replies: ['Moi aussi. Même quand tu conduis mal.', 'Toi et moi, contre tout Solenne. ❤️'] },
      { words: ['argent', 'thune', 'fric', '$'], replies: ['L’argent, on va en trouver. Fais-moi confiance.', 'Regarde l’appli Boulots en attendant.'] },
      { words: ['peur', 'police', 'flic', 'dussart'], replies: ['Respire. Tant qu’on reste ensemble, on s’en sort.', 'Si les étoiles montent, on fait profil bas un moment.'] },
    ],
    generic: ['Je suis là.', 'On en parle ce soir ?', 'T’inquiète, j’ai un plan. Enfin, presque.'],
    spontaneous: ['Tu sais ce qui me manquait le plus en prison ? Le bruit de la mer.', 'J’ai vu une décapotable rouge… un jour, elle sera à nous.'],
    call: ['C’est moi.', 'Je voulais juste entendre ta voix.', 'Fais attention à toi, d’accord ?'],
  },
  {
    id: 'boyd',
    name: 'Boyd « le Pélican »',
    avatar: '🦅',
    color: '#4CC9F0',
    number: '555-0471',
    story: true,
    opening: '',
    triggers: [{ words: ['bateau', 'caisse', 'colis'], replies: ['On ne parle pas affaires par message.', 'Viens au ponton si tu veux parler.'] }],
    generic: ['Hmm.', 'Les Îles ont des oreilles.', 'Pas au téléphone.'],
    spontaneous: ['La marée est bonne ce soir.'],
    call: ['Boyd.', 'Les Îles sont calmes. Trop calmes.', 'Raccroche, et efface ce numéro.'],
  },
  {
    id: 'santos',
    name: 'Santos Vidal',
    avatar: '🎩',
    color: '#FFB347',
    number: '555-0644',
    story: true,
    opening: '',
    triggers: [{ words: ['plan', 'banque', 'coffre'], replies: ['Le plan est simple. Ce sont les gens qui sont compliqués.', 'Patience. Le bon moment arrive toujours.'] }],
    generic: ['Je n’aime pas les bavards.', 'On se voit quand tout est prêt.'],
    spontaneous: ['Un coup réussi, c’est 90 % de préparation et 10 % de chance.'],
    call: ['Santos.', 'Tout est prêt de mon côté.', 'Ne me décevez pas.'],
  },
  {
    id: 'teo',
    name: 'Teo',
    avatar: '👽',
    color: '#3DDC97',
    number: '555-0222',
    story: true,
    opening: '',
    triggers: [
      { words: ['alien', 'extraterrestre', 'ovni', 'ufo'], replies: ['Je TE DIS qu’il y a une base sous le Lac Miroir.', 'Les lumières au-dessus du Marais, c’était pas des hélicos.'] },
      { words: ['merci', 'frere', 'pote'], replies: ['Toujours là pour toi, frère.', 'C’est à ça que servent les amis. Et les canapés.'] },
    ],
    generic: ['Grave.', 'Je suis sur un truc énorme, je te raconte plus tard.', 'Tu crois aux coïncidences ? Moi non.'],
    spontaneous: ['J’ai capté un signal bizarre sur ma radio cette nuit.', 'Mara est trop bien pour toi. Je dis ça avec amour.'],
    call: ['Frère !', 'Je voulais juste prendre des nouvelles.', 'Et regarde le ciel ce soir. Fais-moi confiance.'],
  },
  {
    id: 'momo',
    name: 'Big Momo',
    avatar: '🏢',
    color: '#E8B04B',
    number: '555-0808',
    story: true,
    opening: '',
    triggers: [{ words: ['loyer', 'argent', 'immeuble'], replies: ['Tout le monde paie Big Momo. Tôt ou tard.', 'L’immobilier, c’est la seule chose qu’on ne peut pas voler.'] }],
    generic: ['Je t’écoute.', 'Passe au bureau, on parlera mieux.', 'Le Vieux Port, c’est ma famille.'],
    spontaneous: ['Un bon propriétaire connaît le prénom de tous ses locataires.'],
    call: ['Big Momo.', 'Le quartier est calme. J’aime quand c’est calme.', 'Passe me voir.'],
  },
  {
    id: 'kenzo',
    name: 'Kenzo',
    avatar: '🎛️',
    color: '#8A4DFF',
    number: '555-0456',
    story: true,
    opening: '',
    triggers: [{ words: ['album', 'son', 'musique', 'label'], replies: ['Le son des Sirènes va retourner tout Solenne.', 'Écoute ça au casque, pas sur ton téléphone.'] }],
    generic: ['Je suis en studio.', 'On fait de l’histoire, là.', 'Tu entends ça ? C’est le futur.'],
    spontaneous: ['Nouveau beat ce matin. Il est trop chaud pour la radio.'],
    call: ['Kenzo, studio Néon.', 'Les filles enregistrent, c’est magique.', 'Je te laisse, on reprend la prise.'],
  },
  {
    id: 'nina',
    name: 'Nina',
    avatar: '🎤',
    color: '#FF3D8B',
    number: '555-0661',
    story: true,
    opening: '',
    triggers: [{ words: ['chanson', 'concert', 'showcase'], replies: ['Viens au prochain concert, premier rang.', 'On écrit tous les soirs sur le toit du studio.'] }],
    generic: ['Haha', 'Jojo te passe le bonjour.', 'On répète, je te réponds après !'],
    spontaneous: ['Couplet écrit à 4 h du matin. Le meilleur de ma vie.'],
    call: ['C’est Nina !', 'On a fini le refrain, il est incroyable.', 'Bisous, Jojo crie derrière.'],
  },
  {
    id: 'jojo',
    name: 'Jojo',
    avatar: '💅',
    color: '#4CC9F0',
    number: '555-0662',
    story: true,
    opening: '',
    triggers: [{ words: ['drole', 'blague', 'rire'], replies: ['Je suis drôle ET talentueuse. C’est injuste pour les autres.', 'Nina dit que je ris trop fort. Elle a raison.'] }],
    generic: ['MDR', 'Attends je finis mon ongle.', 'C’est noté chef 🫡'],
    spontaneous: ['Un alligator a assisté à notre répète. Il avait l’air d’aimer.'],
    call: ['Jojo à l’appareil, star en devenir.', 'Nina dort, je m’ennuie.', 'Bon je raccroche, Kenzo me regarde mal.'],
  },
];

export const contactById = (id: string) => CONTACTS.find((c) => c.id === id);

export type FeedAuthor = { name: string; handle: string; avatar: string; color: string };

export const FEED_AUTHORS: FeedAuthor[] = [
  { name: 'Jade', handle: '@jade.mix', avatar: '🎧', color: '#2DE2E6' },
  { name: 'Rico Garage', handle: '@ricogarage', avatar: '🔧', color: '#FFB347' },
  { name: 'Corail Info', handle: '@corailinfo', avatar: '📰', color: '#FF5C6C' },
  { name: 'Lola Fitness', handle: '@lola.fit', avatar: '💪', color: '#3DDC97' },
  { name: 'Chef Bruno', handle: '@chefbruno', avatar: '🌮', color: '#FF8FB1' },
  { name: 'Mairie de Port Corail', handle: '@portcorail', avatar: '🏛️', color: '#8A4DFF' },
];

export const FEED_SEED: { author: number; text: string; likes: number; minutesAgo: number }[] = [
  { author: 0, text: 'Samedi au Flamingo Club, set synthwave toute la nuit 🪩🌴 #PortCorail', likes: 842, minutesAgo: 12 },
  { author: 4, text: 'Nouveau taco « Coucher de soleil » : mangue, piment, et un peu de mystère 🌮', likes: 233, minutesAgo: 45 },
  { author: 2, text: 'ALERTE : un alligator aperçu au golf municipal. Il aurait fait un birdie.', likes: 5120, minutesAgo: 80 },
  { author: 3, text: 'Footing sur la plage à 6 h. Qui est motivé demain ? 🏃‍♀️', likes: 98, minutesAgo: 150 },
  { author: 5, text: 'Rappel : le pont de la baie est fermé dimanche pour la parade des bateaux.', likes: 61, minutesAgo: 300 },
];

export const FEED_POOL: { author: number; text: string }[] = [
  { author: 1, text: 'Avant / après : une vieille décapotable remise à neuf 🔥 #garage' },
  { author: 0, text: 'Le studio est enfin insonorisé. Les voisins disent merci 🙏' },
  { author: 2, text: 'Embouteillage géant sur l’autoroute côtière : un flamant rose refuse de traverser.' },
  { author: 3, text: 'Séance abdos face à l’océan. La vue aide à oublier la douleur 😅' },
  { author: 4, text: 'Le food-truck est garé au port aujourd’hui. Premier arrivé, premier servi !' },
  { author: 5, text: 'Feu d’artifice ce soir à 22 h sur la marina 🎆' },
  { author: 2, text: 'Météo : 35 °C, humidité 90 %. Bref, une journée normale à Port Corail.' },
  { author: 1, text: 'Quelqu’un a laissé une moto dorée devant le garage. Si c’est la tienne, viens la chercher.' },
];

export type Article = { id: string; category: string; title: string; summary: string; body: string; emoji: string };

export const ARTICLES: Article[] = [
  {
    id: 'alligator',
    category: 'Insolite',
    emoji: '🐊',
    title: 'Un alligator élu « employé du mois » au golf municipal',
    summary: 'Le reptile surveille le trou n°7 depuis trois semaines.',
    body: 'Les joueurs l’ont surnommé Gérard. Personne n’ose récupérer les balles qui tombent dans son étang, ce qui a fait chuter le score moyen du parcours. La direction du golf assure que Gérard « fait partie du décor » et envisage de lui offrir une casquette.',
  },
  {
    id: 'pont',
    category: 'Circulation',
    emoji: '🌉',
    title: 'Le pont de la baie fermé pour la grande parade des bateaux',
    summary: 'Plus de 200 embarcations décorées sont attendues dimanche.',
    body: 'La parade traditionnelle partira de la marina à 15 h. La mairie conseille d’éviter la route côtière et de privilégier le tramway, ou mieux encore, de venir en bateau. Un concours récompensera le navire le plus lumineux.',
  },
  {
    id: 'chaleur',
    category: 'Météo',
    emoji: '🌡️',
    title: 'Canicule : les habitants dorment dans les rayons surgelés',
    summary: 'Les supermarchés de Port Corail débordés par les amateurs de fraîcheur.',
    body: 'Avec 38 °C à l’ombre, certains habitants ont trouvé refuge dans les allées réfrigérées. Le gérant d’un magasin témoigne : « Un monsieur est venu acheter une glace il y a trois heures. Il est toujours là. » La fraîcheur est attendue pour… octobre.',
  },
  {
    id: 'startup',
    category: 'Économie',
    emoji: '💸',
    title: 'Une start-up lève 3 millions pour des lunettes de soleil pour chiens',
    summary: 'Le fondateur, un homme moustachu, refuse de donner son nom.',
    body: 'Le projet aurait séduit plusieurs investisseurs de la marina. « Les chiens aussi ont droit au style », a déclaré le fondateur, avant de partir précipitamment sur un demi-bateau. Toute ressemblance avec un oncle existant serait fortuite.',
  },
  {
    id: 'club',
    category: 'Sorties',
    emoji: '🪩',
    title: 'Le Flamingo Club rouvre avec une DJ locale aux commandes',
    summary: 'La soirée de samedi affiche déjà complet.',
    body: 'Après six mois de travaux, la boîte de nuit la plus rose de la côte rouvre ses portes. La DJ Jade promet « un voyage dans les années 80, avec des basses de 2030 ». Tenue colorée exigée.',
  },
];

export type Job = { id: string; title: string; description: string; emoji: string; durationSec: number; reward: number; client: string; /** Lieu sur la carte. */ poi: string };

export const JOBS: Job[] = [
  { id: 'tacos', title: 'Livraison de tacos', description: 'Livrer 12 tacos encore chauds au port avant qu’ils refroidissent.', emoji: '🌮', durationSec: 20, reward: 80, client: 'Chef Bruno', poi: 'tacos' },
  { id: 'chien', title: 'Promener les chiens', description: 'Promener trois caniches (avec leurs lunettes de soleil) sur la plage.', emoji: '🐩', durationSec: 30, reward: 120, client: 'Tonton Vince', poi: 'plage' },
  { id: 'convoyage', title: 'Convoyage de décapotable', description: 'Ramener une décapotable du garage de Rico jusqu’à la marina, sans une rayure.', emoji: '🚗', durationSec: 45, reward: 250, client: 'Rico Garage', poi: 'marina' },
  { id: 'club', title: 'Installer la sono', description: 'Aider Jade à monter les enceintes du Flamingo Club.', emoji: '🔊', durationSec: 60, reward: 320, client: 'Jade', poi: 'flamingo' },
  { id: 'bateau', title: 'Décorer un bateau', description: 'Accrocher 300 guirlandes lumineuses pour la parade de dimanche.', emoji: '🛥️', durationSec: 90, reward: 500, client: 'Mairie de Port Corail', poi: 'marina' },
];

export const START_BALANCE = 1500;
