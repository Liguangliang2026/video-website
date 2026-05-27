const TINTS = [
  'linear-gradient(135deg, rgba(255,107,53,0.5), rgba(124,92,255,0.4))',
  'linear-gradient(135deg, rgba(124,92,255,0.5), rgba(255,107,53,0.35))',
  'linear-gradient(135deg, rgba(80,200,255,0.35), rgba(124,92,255,0.45))',
  'linear-gradient(135deg, rgba(255,107,53,0.45), rgba(255,200,80,0.25))',
  'linear-gradient(135deg, rgba(200,120,255,0.4), rgba(255,107,53,0.3))',
];

export function pickTint(i) {
  return TINTS[i % TINTS.length];
}

/** @deprecated use mapCatalogItem */
export function mapApiItem(it, i) {
  return mapCatalogItem(it, i);
}

export function resolveCoverUrl(it, source) {
  const raw = String(it.logo_img || it.cover || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/')) return raw;
  if (source === 'drama' && /^https:\/\/img\.zjchjc\.cn\//i.test(raw)) {
    return `/api/catalog/poster?url=${encodeURIComponent(raw)}`;
  }
  return raw;
}

/** @param {object} it @param {number} i @param {{ withDescription?: boolean }} [opts] */
export function mapCatalogItem(it, i, opts = {}) {
  const source = it.source === 'r2' ? 'r2' : 'drama';
  let tagline = '';
  if (opts.withDescription) {
    const tag = (it.recommendation || it.introduce || it.tagline || '').trim();
    tagline = tag.length > 140 ? `${tag.slice(0, 137)}…` : tag || '—';
  }
  return {
    source,
    video_id: String(it.video_id ?? ''),
    title: it.video_title || 'Untitled',
    tagline,
    episodes: it.video_total ?? 0,
    image: resolveCoverUrl(it, source),
    tint: pickTint(i),
    sourceLabel: source === 'r2' ? 'Library' : 'Partner',
  };
}

export function seriesRoute(item) {
  return {
    name: 'series-detail',
    params: { source: item.source, id: String(item.video_id) },
  };
}

export function pickPlayUrl(ep) {
  const keys = [
    'play_url',
    'video_url',
    'url',
    'm3u8_url',
    'hls_url',
    'playUrl',
    'videoUrl',
  ];
  for (const k of keys) {
    const v = ep[k];
    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) return v.trim();
  }
  return '';
}

export function episodeLabel(ep, idx) {
  const n =
    ep.episode_index ??
    ep.episode_num ??
    ep.sort ??
    ep.episode_no ??
    ep.num ??
    idx + 1;
  return Number.isFinite(Number(n)) ? Number(n) : idx + 1;
}

export function episodeTitle(ep, idx) {
  const t = ep.episode_title ?? ep.title ?? ep.episode_name ?? ep.name;
  if (typeof t === 'string' && t.trim()) return t.trim();
  return `Episode ${episodeLabel(ep, idx)}`;
}

export function extractEpisodeList(body) {
  if (!body || typeof body !== 'object') return [];
  const d = body.data;
  return (
    (Array.isArray(d?.list) && d.list) ||
    (Array.isArray(d?.episode_list) && d.episode_list) ||
    (Array.isArray(body.list) && body.list) ||
    []
  );
}

export function coverStyle(url) {
  if (!url) return { background: '#1a1a24' };
  return {
    backgroundImage: `url('${String(url).replace(/'/g, "\\'")}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}
