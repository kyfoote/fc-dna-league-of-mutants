// Procedural name generation — footballers and clubs. No engine imports.
import { type Rng, pick, chance, randInt } from './rng.js';

const FIRST_NAMES = [
  'Bram', 'Zolt', 'Finn', 'Dez', 'Rocco', 'Milo', 'Gunnar', 'Otis', 'Pip', 'Wren',
  'Bodie', 'Cass', 'Nils', 'Fenn', 'Gus', 'Idris', 'Juno', 'Klaus', 'Lex', 'Moss',
  'Nash', 'Orin', 'Percy', 'Quill', 'Remy', 'Silas', 'Tobin', 'Ulf', 'Vance', 'Wolf',
  'Xander', 'Yuri', 'Zeke', 'Ambrose', 'Barnaby', 'Cosmo', 'Dashiell', 'Egon', 'Fitz', 'Gideon',
  'Hobbes', 'Ignatius', 'Jasper', 'Knox', 'Linden', 'Merrick', 'Nino', 'Ozzy', 'Piet', 'Quinlan',
];
const LAST_NAMES = [
  'Thistlewood', 'Boggins', 'Vandermeer', 'Snorkelfoot', 'O\'Brindle', 'Fumblebee', 'Krackenov', 'Higglesworth',
  'Von Toe', 'Mudflap', 'Gristlebone', 'Wobblesworth', 'Klanktoe', 'Pemberton', 'Ratchett', 'Blorbo',
  'Tunklebury', 'Fizzlethorn', 'McTackleface', 'Grimspoon', 'Bumbleforth', 'Skidmark', 'Quagmire', 'Thudpenny',
  'Barnaclefoot', 'Wretchley', 'Popplewell', 'Squelch', 'Danderfluff', 'Krinkle', 'Bellweather', 'Crumpington',
  'Von Kicker', 'Twizzle', 'Muttonchop', 'Snagglethorn', 'Puddlefoot', 'Rumblesnatch', 'Featherbottom', 'Yolkovic',
];

const CLUB_ADJECTIVES = [
  'Real', 'Athletic', 'Royal', 'United', 'FC', 'Wednesday', 'Flaming', 'Ancient', 'Mighty', 'Sovereign',
  'Wandering', 'Sizzling', 'Gilded', 'Rusty', 'Feral', 'Iron', 'Velvet', 'Thunder', 'Salty', 'Cosmic',
];
const CLUB_NOUNS = [
  'Meatball', 'Biscuit', 'Ferrets', 'Tax Evasion', 'Beetles', 'Anchovies', 'Warlocks', 'Pigeons', 'Turnips',
  'Gargoyles', 'Kettles', 'Herring', 'Wombats', 'Pretzels', 'Goblins', 'Waffles', 'Badgers', 'Pickles',
  'Sardines', 'Yetis', 'Cutlasses', 'Marmots', 'Gremlins', 'Cabbages', 'Weasels', 'Sprockets',
];

export function generatePersonName(rng: Rng): { first: string; last: string } {
  return { first: pick(rng, FIRST_NAMES), last: pick(rng, LAST_NAMES) };
}

export function generateClubName(rng: Rng): string {
  const adj = pick(rng, CLUB_ADJECTIVES);
  const noun = pick(rng, CLUB_NOUNS);
  if (chance(rng, 0.25)) return `${adj} ${noun} ${pick(rng, ['United', 'City', 'Rovers', 'Town'])}`;
  if (adj === 'FC') return `FC ${noun}`;
  return `${adj} ${noun}`;
}

export function generateClubColors(rng: Rng): { primary: string; secondary: string } {
  const hues = [
    ['#e0473e', '#1c1c2b'], ['#3e7de0', '#f2f2f2'], ['#f2c230', '#1b3a2b'], ['#7ac74f', '#1c1c2b'],
    ['#b98bff', '#20143a'], ['#38e1ff', '#0b2233'], ['#ff2fb0', '#1c0b1e'], ['#ff8a3d', '#241505'],
    ['#eef3ff', '#0b0e1a'], ['#7fd4c1', '#0b2a24'],
  ];
  const [primary, secondary] = pick(rng, hues);
  return { primary, secondary };
}

export function randomAge(rng: Rng): number {
  return randInt(rng, 17, 36);
}
