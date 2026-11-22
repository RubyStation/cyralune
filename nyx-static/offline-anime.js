// An additional offline discovery index. These are title-only entries, NOT
// recovered Anvil records, episodes, artwork, or playable video sources.
// Keeping the original seven Anvil records separate preserves their IDs.
const DISCOVERY_TITLES = [
  'Naruto', 'Naruto: Shippuden', 'Boruto: Naruto Next Generations',
  'Dragon Ball', 'Dragon Ball Z', 'Dragon Ball Super',
  'Bleach', 'Bleach: Thousand-Year Blood War', 'Attack on Titan',
  'Demon Slayer: Kimetsu no Yaiba', 'My Hero Academia',
  'Fullmetal Alchemist: Brotherhood', 'Hunter x Hunter', 'Death Note',
  'Cowboy Bebop', 'Samurai Champloo', 'Code Geass', 'Steins;Gate',
  'Mob Psycho 100', 'One-Punch Man', 'Chainsaw Man', 'Spy x Family',
  'Frieren: Beyond Journey’s End', 'Solo Leveling', 'Dandadan',
  'Blue Lock', 'Haikyu!!', 'Kuroko’s Basketball', 'Slam Dunk',
  'Vinland Saga', 'Tokyo Ghoul', 'Tokyo Revengers', 'Black Clover',
  'Fairy Tail', 'The Seven Deadly Sins', 'JoJo’s Bizarre Adventure',
  'Gintama', 'Re:Zero', 'Sword Art Online', 'KonoSuba',
  'Mushoku Tensei: Jobless Reincarnation', 'Overlord',
  'That Time I Got Reincarnated as a Slime', 'Dr. Stone',
  'The Promised Neverland', 'Food Wars!', 'Your Lie in April',
  'Clannad', 'Toradora!', 'Horimiya', 'Kaguya-sama: Love Is War',
  'Fruits Basket', 'Violet Evergarden', 'Your Name', 'A Silent Voice',
  'Spirited Away', 'Princess Mononoke', 'My Neighbor Totoro',
  'Howl’s Moving Castle', 'Weathering with You', 'Suzume',
  'Neon Genesis Evangelion', 'Ghost in the Shell', 'Akira',
  'Psycho-Pass', 'Made in Abyss', 'Kill la Kill', 'Gurren Lagann',
  'Erased', 'Parasyte: The Maxim', 'Hellsing Ultimate', 'Trigun',
  'Initial D', 'Berserk', 'Hajime no Ippo', 'Bungo Stray Dogs',
  'Assassination Classroom', 'Noragami', 'The Rising of the Shield Hero',
  'Blue Exorcist', 'Soul Eater', 'Fire Force', 'Black Butler',
  'Death Parade', 'Durarara!!', 'Beastars', 'Nana', 'Bocchi the Rock!',
  'Oshi no Ko', 'The Apothecary Diaries', 'Delicious in Dungeon',
  'My Dress-Up Darling', 'Komi Can’t Communicate',
  'Little Witch Academia', 'Sailor Moon', 'Cardcaptor Sakura',
  'Inuyasha', 'Yu Yu Hakusho', 'Rurouni Kenshin'
];

const slug = name => name.toLocaleLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const OFFLINE_ANIME = Object.freeze(DISCOVERY_TITLES.map(name => Object.freeze({
  id: `offline:${slug(name)}`, name, type: 'anime', format: 'Offline discovery',
  episodes: 0, description: 'Title-only discovery entry. Episode details and video sources are not included.'
})));

export function searchOfflineAnime(search = '') {
  const words = search.toLocaleLowerCase().trim().split(/\s+/u).filter(Boolean);
  return OFFLINE_ANIME.filter(item => words.every(word => item.name.toLocaleLowerCase().includes(word)));
}
