import { episodeLabel, episodeTitle, pickPlayUrl } from './drama';

export function normalizeEpisodes(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((ep, idx) => ({
      index: idx,
      num: episodeLabel(ep, idx),
      title: episodeTitle(ep, idx),
      url: pickPlayUrl(ep),
    }))
    .filter((ep) => ep.url);
}
