// Stations de radio fictives de Port Corail. La musique est composée par scripts/make_radio.py.

export type Station = {
  id: string;
  name: string;
  freq: string;
  genre: string;
  host: string;
  colors: readonly [string, string];
  emoji: string;
  source: number;
  /** Titres fictifs affichés à tour de rôle (artiste — titre). */
  tracks: [string, string][];
  /** Interventions de l’animateur, affichées entre deux titres. */
  dj: string[];
};

export const STATIONS: Station[] = [
  {
    id: 'neon',
    name: 'Néon FM',
    freq: '88.7',
    genre: 'Synthwave',
    host: 'DJ Laser',
    colors: ['#F72585', '#3A0CA3'],
    emoji: '🌆',
    source: require('../../assets/radio/neon-fm.m4a'),
    tracks: [
      ['Les Néons Roses', 'Autoroute de minuit'],
      ['Vapor Kid', 'Coucher de soleil en VHS'],
      ['Lune Électrique', 'Port Corail 1986'],
      ['Chrome Hearts Club', 'Vitesse lumière'],
    ],
    dj: ['Vous écoutez Néon FM, la seule radio qui brille dans le noir.', 'Il est l’heure de rouler, vitres ouvertes, sur la route côtière.', 'Un message pour Rico : ton néon sous le châssis se voit depuis l’espace.'],
  },
  {
    id: 'palm',
    name: 'Palm Beats',
    freq: '92.1',
    genre: 'Lo-fi chill',
    host: 'Mila Doux',
    colors: ['#FFB347', '#C2447A'],
    emoji: '🌴',
    source: require('../../assets/radio/palm-beats.m4a'),
    tracks: [
      ['Hamac Sound', 'Sieste à la marina'],
      ['Café Corail', 'Pluie tropicale'],
      ['Les Flamants Lents', 'Dimanche matin'],
    ],
    dj: ['Palm Beats, pour réviser, travailler ou ne rien faire du tout.', 'Respirez. Il fait 33 degrés, personne ne court à Port Corail.'],
  },
  {
    id: 'caliente',
    name: 'Radio Caliente',
    freq: '97.5',
    genre: 'Latino · reggaeton',
    host: 'Don Pepe',
    colors: ['#FF5C6C', '#FFB347'],
    emoji: '🔥',
    source: require('../../assets/radio/caliente.m4a'),
    tracks: [
      ['La Brisa', 'Baila en la playa'],
      ['Corazón Neón', 'Noche caliente'],
      ['Los Tiburones', 'Calle Coral'],
    ],
    dj: ['¡Radio Caliente! Ça chauffe sur la côte !', 'Dédicace au Flamingo Club, ce soir on danse jusqu’au lever du soleil.'],
  },
  {
    id: 'bass',
    name: 'Bass Drive 99',
    freq: '99.0',
    genre: 'Trap · rap',
    host: 'MC Basse',
    colors: ['#8A4DFF', '#0B0716'],
    emoji: '🎤',
    source: require('../../assets/radio/bass-drive.m4a'),
    tracks: [
      ['Lil Corail', 'Quartier Néon'],
      ['Big Flamant', 'Sous-marin'],
      ['Yung Marina', '808 sur la plage'],
    ],
    dj: ['Bass Drive 99, montez le son, les vitres tremblent.', 'Si vos enceintes grésillent, c’est normal. C’est la basse.'],
  },
  {
    id: 'vagues',
    name: 'Les Vagues',
    freq: '104.3',
    genre: 'Ambiance plage',
    host: 'Capitaine Calme',
    colors: ['#02C39A', '#05668D'],
    emoji: '🌊',
    source: require('../../assets/radio/les-vagues.m4a'),
    tracks: [
      ['Océan Bleu', 'Marée haute'],
      ['Le Phare', 'Horizon'],
      ['Sable Chaud', 'Fin de journée'],
    ],
    dj: ['Les Vagues : fermez les yeux, vous êtes déjà sur la plage.', 'Bulletin marin : mer calme, alligators au repos.'],
  },
];
