import catalog from '../../data/r2-catalog.json';
import manifests from '../../data/r2-episode-manifests.json';
import {
  episodesFromManifest,
  episodesFromR2Objects,
  listR2ObjectsForDrama,
  discoverR2DramaEpisodeSets,
  parseEpisodeNumberFromFilename,
  parseSeriesTitleFromFilename,
  buildR2PublicMp4Url,
  episodeTitleFromFilename,
} from './r2-episodes.js';

export function r2PublicBase(env) {
  const base = String(env.R2_PUBLIC_BASE ?? '').trim().replace(/\/$/, '');
  return base;
}

export function getR2Dramas() {
  return Array.isArray(catalog.dramas) ? catalog.dramas : [];
}

function sortDramaList(dramas) {
  return [...dramas].sort((a, b) => {
    const na = Number(a.id);
    const nb = Number(b.id);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a.id).localeCompare(String(b.id));
  });
}

function defaultDiscoveredDrama(id, episodeCount, maxEp, sampleFile = '') {
  const sid = String(id);
  const parsed = parseSeriesTitleFromFilename(sampleFile);
  const title = parsed && parsed !== sid ? parsed : sid;
  return {
    id: sid,
    title,
    start: 1,
    end: maxEp || 1,
    tagline: 'Hosted on Cloudflare R2',
    cover: `/image/${sid}.jpg`,
    episode_count: episodeCount || 1,
  };
}

function applyParsedTitleIfPlaceholder(drama, sampleFile) {
  const sid = String(drama.id);
  const current = String(drama.title ?? '').trim();
  if (current && current !== sid) return drama;
  const parsed = parseSeriesTitleFromFilename(sampleFile);
  if (parsed && parsed !== sid) drama.title = parsed;
  return drama;
}

/**
 * 合并 r2-catalog.json 与 R2 桶内实际存在的 video/{id}/（自动发现 11、12…）。
 * @param {Record<string, unknown>} env
 */
export async function getR2DramasLive(env) {
  const staticList = getR2Dramas();
  /** @type {Map<string, object>} */
  const byId = new Map(staticList.map((d) => [String(d.id), { ...d }]));

  const bucket = env?.R2_VIDEOS;
  if (!bucket) {
    return sortDramaList([...byId.values()]);
  }

  try {
    const discovered = await discoverR2DramaEpisodeSets(bucket);
    for (const [id, row] of discovered) {
      const count = row.eps.size;
      if (!count) continue;
      const maxEp = Math.max(...row.eps);
      const sampleFile = row.sampleFile || '';
      if (byId.has(id)) {
        const d = byId.get(id);
        d.episode_count = count;
        d.end = maxEp;
        d.start = 1;
        if (!d.cover) d.cover = `/image/${id}.jpg`;
        applyParsedTitleIfPlaceholder(d, sampleFile);
      } else {
        byId.set(id, defaultDiscoveredDrama(id, count, maxEp, sampleFile));
      }
    }
  } catch (err) {
    console.error('R2 catalog discover failed:', err?.message || err);
  }

  return sortDramaList([...byId.values()]);
}

export async function findR2Drama(env, dramaId) {
  const dramas = await getR2DramasLive(env);
  return dramas.find((d) => String(d.id) === String(dramaId)) ?? null;
}

/** R2 封面与 Cloudflare / public/image 一致：{id}.jpg，如 1.jpg → 第 1 部 */
export function r2CoverPath(d) {
  const explicit = String(d?.cover ?? '').trim();
  if (explicit) return explicit;
  const id = String(d?.id ?? '').trim();
  return id ? `/image/${id}.jpg` : '';
}

function dramaEpisodeCount(d) {
  const n = Number(d.episode_count);
  if (Number.isFinite(n) && n > 0) return n;
  const start = Number(d.start) || 1;
  const end = Number(d.end) || start;
  return Math.max(0, end - start + 1);
}

/** R2 剧目简介：写入 r2-catalog.json 的 description 或 tagline */
export function r2SeriesDescription(d) {
  const text = String(d?.description ?? d?.tagline ?? d?.introduce ?? '').trim();
  return text || 'Self-hosted on R2';
}

export function mapR2ToCatalogItem(d, index, opts = {}) {
  const item = {
    source: 'r2',
    video_id: String(d.id),
    video_title: d.title || `Series ${d.id}`,
    video_total: dramaEpisodeCount(d),
    logo_img: r2CoverPath(d),
    _index: index,
  };
  if (opts.withDescription !== false) {
    item.recommendation = r2SeriesDescription(d);
  }
  return item;
}

/** @deprecated 仅旧版固定 prefix+两位集号 上传方式 */
function buildLegacyPrefixEpisodeList(drama, base) {
  const start = Number(drama.start) || 1;
  const end = Number(drama.end) || start;
  const prefix = String(drama.prefix || '');
  if (!prefix) return [];

  const list = [];
  for (let n = start; n <= end; n++) {
    const ep = String(n).padStart(2, '0');
    const file = `${prefix}${ep}.mp4`;
    list.push({
      episode_index: n,
      episode_title: `Episode ${n}`,
      play_url: buildR2PublicMp4Url(base, drama.id, file),
    });
  }
  return list;
}

export async function buildR2EpisodeList(env, dramaId) {
  const base = r2PublicBase(env);
  if (!base) {
    return {
      error: Response.json(
        {
          code: -1,
          msg: 'Server misconfiguration: set R2_PUBLIC_BASE (public bucket URL, no trailing slash)',
        },
        { status: 500 },
      ),
    };
  }

  const drama = await findR2Drama(env, dramaId);
  if (!drama) {
    return { error: Response.json({ code: -1, msg: 'R2 series not found' }, { status: 404 }) };
  }

  let list = [];
  let source = '';

  const bucket = env.R2_VIDEOS;
  if (bucket) {
    try {
      const objects = await listR2ObjectsForDrama(bucket, dramaId);
      list = episodesFromR2Objects(objects, base, dramaId);
      if (list.length) source = 'r2-list';
    } catch (err) {
      console.error('R2_VIDEOS list failed:', err?.message || err);
    }
  }

  if (!list.length && manifests && typeof manifests === 'object') {
    list = episodesFromManifest(manifests, dramaId, base);
    if (list.length) source = 'manifest';
  }

  if (!list.length && drama.prefix) {
    list = buildLegacyPrefixEpisodeList(drama, base);
    if (list.length) source = 'legacy-prefix';
  }

  if (list.length && source === 'legacy-prefix') {
    const probe = await fetch(list[0].play_url, { method: 'HEAD' });
    if (!probe.ok) {
      list = [];
      source = '';
    }
  }

  if (!list.length) {
    return {
      error: Response.json(
        {
          code: -1,
          msg:
            'No R2 episodes found. Bind R2_VIDEOS, run npm run sync:r2-episodes, or set prefix for legacy filenames.',
        },
        { status: 404 },
      ),
    };
  }

  return {
    data: {
      source: 'r2',
      video_id: String(drama.id),
      video_title: drama.title,
      video_total: list.length,
      episode_resolve: source,
      list,
    },
  };
}

export { parseEpisodeNumberFromFilename, episodeTitleFromFilename, buildR2PublicMp4Url };
