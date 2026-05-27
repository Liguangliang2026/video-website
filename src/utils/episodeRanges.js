export const EP_RANGE_SIZE = 10;

/** @param {{ num: number }[]} episodes */
export function buildEpisodeRanges(episodes) {
  if (!episodes?.length) return [];
  const ranges = [];
  for (let start = 0; start < episodes.length; start += EP_RANGE_SIZE) {
    const end = Math.min(start + EP_RANGE_SIZE, episodes.length) - 1;
    const a = episodes[start].num;
    const b = episodes[end].num;
    const label = a === b ? String(a) : `${a}-${b}`;
    ranges.push({ from: start, to: end, label });
  }
  return ranges;
}

export function rangeIndexForEpisode(ranges, episodeIndex) {
  for (let r = 0; r < ranges.length; r++) {
    if (episodeIndex >= ranges[r].from && episodeIndex <= ranges[r].to) return r;
  }
  return 0;
}
