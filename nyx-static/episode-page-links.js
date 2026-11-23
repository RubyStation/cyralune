// Public episode-detail pages, not playable media URLs. These are kept
// separate from PUBLISHED_SOURCES so Cryalune never treats a download page
// as a direct MP4/HLS stream or an embeddable player.
const JJK_TOKYO_INSIDER = 'https://www.tokyoinsider.com/anime/J/Jujutsu_Kaisen_(TV)/episode/';

export function externalEpisodePage(itemId, episode) {
  // The linked TokyoInsider series page lists Season 1 episodes 1–24 only.
  if (itemId !== 'anime:113415' || !Number.isInteger(episode) || episode < 1 || episode > 24) return '';
  return `${JJK_TOKYO_INSIDER}${episode}`;
}
