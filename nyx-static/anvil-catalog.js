// The seven-title catalog carried over from the original Anvil Anime Center.
// All metadata is bundled locally; posters are optional remote images.
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
  'Accomplices'
]);

export const ANVIL_CATALOG = Object.freeze([
  {
    id: 'anime:113415', name: 'Jujutsu Kaisen', year: 2020, score: 86,
    genre: 'Action · Supernatural', type: 'anime', format: 'TV',
    episodes: JJK_EPISODES.length, episodeTitles: JJK_EPISODES,
    description: 'Yuji Itadori enters the dangerous world of jujutsu sorcerers and curses.',
    cover: 'https://images.entertainment.ie/media/season/k3LNFvoLJidIinXkvmahCpShL12.jpg'
  },
  {
    id: 'anvil:pokemon', name: 'Pokémon', year: 1997, score: 80,
    genre: 'Adventure · Fantasy', type: 'anime', format: 'TV',
    description: 'A journey through the world of Pokémon, filled with discovery and friendship.',
    cover: 'https://m.media-amazon.com/images/M/MV5BNGI1NTgzNTUtOWY5My00YjhkLTliOGUtMmUzYmEzMTgzMzU1XkEyXkFqcGc%40._V1_.jpg'
  },
  {
    id: 'anvil:onepiece', name: 'One Piece', year: 1999, score: 88,
    genre: 'Adventure · Fantasy', type: 'anime', format: 'TV',
    description: 'Monkey D. Luffy and his crew sail the Grand Line in search of the legendary treasure.',
    cover: 'https://m.media-amazon.com/images/M/MV5BYzNjOTZlNDMtZWNlNC00YzMyLTkwNzEtZGE5MmJkMTg1NjJjXkEyXkFqcGc%40._V1_.jpg'
  },
  {
    id: 'anvil:doraemon', name: 'Doraemon', year: 2005, score: 81,
    genre: 'Comedy · Sci-Fi', type: 'anime', format: 'TV',
    description: 'A futuristic robotic cat brings remarkable gadgets into Nobita’s everyday life.',
    cover: 'https://media.animeoshi.com/anime/images/tmdb/1194773989.jpg'
  },
  {
    id: 'anvil:maruko', name: 'Chibi Maruko-chan', year: 1990, score: 76,
    genre: 'Comedy · Slice of Life', type: 'anime', format: 'TV',
    description: 'The amusing everyday adventures of Maruko, her family, and her classmates.',
    cover: 'https://image.tmdb.org/t/p/original/yXVou9PrKpdtXoAmYzg54lvEnaH.jpg'
  },
  {
    id: 'anvil:conan', name: 'Detective Conan', year: 1996, score: 80,
    genre: 'Mystery · Adventure', type: 'anime', format: 'TV',
    description: 'A brilliant young detective tackles baffling mysteries while hiding his identity.',
    cover: 'https://m.media-amazon.com/images/M/MV5BNGNjMjVmODYtMGMzZi00MWUyLTk1ZDQtYzI2ZTk2MmYzYTZiXkEyXkFqcGc%40._V1_.jpg'
  },
  {
    id: 'anvil:rantaro', name: 'Ninja Boy Rantaro', year: 1993, score: 69,
    genre: 'Comedy · Adventure', type: 'anime', format: 'TV',
    description: 'Young ninja students navigate friendship, training, and mischievous adventures.',
    cover: 'https://peliculas.lavanguardia.com/imagenes/w1280/raKlXyICQBeTxYavErIRybR6g8d.jpg'
  }
]);

export function searchAnvilCatalog(search = '') {
  const words = search.toLocaleLowerCase().trim().split(/\s+/u).filter(Boolean);
  return ANVIL_CATALOG.filter(item => {
    const haystack = `${item.name} ${item.genre} ${item.description} ${item.year}`.toLocaleLowerCase();
    return words.every(word => haystack.includes(word));
  });
}
