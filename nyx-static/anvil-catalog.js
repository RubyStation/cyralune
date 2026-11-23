// The seven-title catalog carried over from the original Anvil Anime Center.
// All metadata is bundled locally; credited posters are cached from TVmaze.
// Video streams and the private Anvil source database are intentionally excluded.
export const JJK_EPISODES = Object.freeze([
  'Ryomen Sukuna', 'For Myself', 'Girl of Steel', 'Curse Womb Must Die',
  'Curse Womb Must Die -II-', 'After Rain', 'Assault', 'Boredom',
  'Small Fry and Reverse Retribution', 'Idle Transfiguration', 'Narrow-minded',
  'To You, Someday', 'Tomorrow',
  'Kyoto Sister School Exchange Event - Group Battle 0 -',
  'Kyoto Sister School Exchange Event - Group Battle 1 -',
  'Kyoto Sister School Exchange Event - Group Battle 2 -',
  'Kyoto Sister School Exchange Event - Group Battle 3 -',
  'Sage', 'Black Flash', 'Nonstandard', 'Jujutsu Koshien',
  'The Origin of Blind Obedience', 'The Origin of Blind Obedience - 2 -',
  'Accomplices',
  'Hidden Inventory', 'Hidden Inventory, Part 2', 'Hidden Inventory, Part 3',
  'Hidden Inventory, Part 4', 'Premature Death', "It's Like That",
  'Evening Festival', 'The Shibuya Incident', 'The Shibuya Incident - Gate Open',
  'Pandemonium', 'Summon', 'Dull Knife', 'Red Scale', 'Fluctuations',
  'Fluctuations II', 'Thunderclap', 'Thunderclap II', 'Right and Wrong',
  'Right and Wrong II', 'Right and Wrong III', 'Transformation',
  'Transformation II', 'The Shibuya Incident - Gate Closed'
]);

export const ANVIL_CATALOG = Object.freeze([
  {
    id: 'anime:113415', name: 'Jujutsu Kaisen', year: 2020, score: 86,
    genre: 'Action · Supernatural', type: 'anime', format: 'TV',
    episodes: JJK_EPISODES.length, episodeTitles: JJK_EPISODES,
    description: 'Yuji Itadori enters the dangerous world of jujutsu sorcerers and curses.',
    cover: './assets/posters/jujutsu-kaisen.jpg',
    detailCover: './assets/posters-hd/jujutsu-kaisen.webp',
    sourceUrl: 'https://www.tvmaze.com/shows/48450/jujutsu-kaisen'
  },
  {
    id: 'anvil:pokemon', name: 'Pokémon', year: 1997, score: 80,
    genre: 'Adventure · Fantasy', type: 'anime', format: 'TV',
    description: 'A journey through the world of Pokémon, filled with discovery and friendship.',
    cover: './assets/posters/pokemon.jpg',
    detailCover: './assets/posters-hd/pokemon.webp',
    sourceUrl: 'https://www.tvmaze.com/shows/590/pokemon'
  },
  {
    id: 'anvil:onepiece', name: 'One Piece', year: 1999, score: 88,
    genre: 'Adventure · Fantasy', type: 'anime', format: 'TV',
    description: 'Monkey D. Luffy and his crew sail the Grand Line in search of the legendary treasure.',
    cover: './assets/posters/one-piece.jpg',
    detailCover: './assets/posters-hd/one-piece.webp',
    sourceUrl: 'https://www.tvmaze.com/shows/1505/one-piece'
  },
  {
    id: 'anvil:doraemon', name: 'Doraemon', year: 2005, score: 81,
    genre: 'Comedy · Sci-Fi', type: 'anime', format: 'TV',
    description: 'A futuristic robotic cat brings remarkable gadgets into Nobita’s everyday life.',
    cover: './assets/posters/doraemon.jpg',
    detailCover: './assets/posters-hd/doraemon.webp',
    sourceUrl: 'https://www.tvmaze.com/shows/55578/doraemon'
  },
  {
    id: 'anvil:maruko', name: 'Chibi Maruko-chan', year: 1990, score: 76,
    genre: 'Comedy · Slice of Life', type: 'anime', format: 'TV',
    description: 'The amusing everyday adventures of Maruko, her family, and her classmates.',
    cover: './assets/posters/chibi-maruko-chan.jpg',
    detailCover: './assets/posters-hd/chibi-maruko-chan.webp',
    sourceUrl: 'https://www.tvmaze.com/shows/22517/chibi-maruko-chan'
  },
  {
    id: 'anvil:conan', name: 'Detective Conan', year: 1996, score: 80,
    genre: 'Mystery · Adventure', type: 'anime', format: 'TV',
    description: 'A brilliant young detective tackles baffling mysteries while hiding his identity.',
    cover: './assets/posters/detective-conan.jpg',
    detailCover: './assets/posters-hd/detective-conan.webp',
    sourceUrl: 'https://www.tvmaze.com/shows/5429/detective-conan'
  },
  {
    id: 'anvil:rantaro', name: 'Ninja Boy Rantaro', year: 1993, score: 69,
    genre: 'Comedy · Adventure', type: 'anime', format: 'TV',
    description: 'Young ninja students navigate friendship, training, and mischievous adventures.',
    cover: './assets/posters/ninja-boy-rantaro.jpg',
    detailCover: './assets/posters-hd/ninja-boy-rantaro.webp',
    sourceUrl: 'https://www.tvmaze.com/shows/88345/nintama-rantaro'
  }
]);

export function searchAnvilCatalog(search = '') {
  const words = search.toLocaleLowerCase().trim().split(/\s+/u).filter(Boolean);
  return ANVIL_CATALOG.filter(item => {
    const haystack = `${item.name} ${item.genre} ${item.description} ${item.year}`.toLocaleLowerCase();
    return words.every(word => haystack.includes(word));
  });
}
