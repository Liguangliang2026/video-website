/**
 * R2 分集：文件名不固定，但须含 ep + 集号（如 reelshort-ep03-Episode 3 - Title.mp4）
 */

/** @param {string} filename */
export function parseEpisodeNumberFromFilename(filename) {
  const base = String(filename || '')
    .split('/')
    .pop()
    .replace(/\.mp4$/i, '');
  if (!base) return null;

  const patterns = [
    /(?:^|[-_.])ep0*(\d{1,4})(?:[-_.\s]|$)/i,
    /ep0*(\d{1,4})/i,
  ];
  for (const re of patterns) {
    const m = base.match(re);
    if (m) {
      const n = Number.parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 1 && n <= 9999) return n;
    }
  }
  return null;
}

/** @param {string} filename @param {number} epNum */
export function episodeTitleFromFilename(filename, epNum) {
  const base = decodeURIComponent(String(filename || '').split('/').pop() || '')
    .replace(/\.mp4$/i, '')
    .trim();
  const m = base.match(/(?:Episode|エピソード)\s*\d+\s*[-–—:]\s*(.+)$/i);
  if (m?.[1]?.trim()) return m[1].trim();
  return `Episode ${epNum}`;
}

function humanizeSlug(slug) {
  return String(slug || '')
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** 从第 1 集文件名解析整部剧名（reelshort-ep01-Episode 1 - Series Name.mp4） */
export function parseSeriesTitleFromFilename(filename) {
  const base = decodeURIComponent(String(filename || '').split('/').pop() || '')
    .replace(/\.mp4$/i, '')
    .trim();
  if (!base) return '';

  const rest = base.replace(/^.*?ep\d{1,4}[-_.\s]*/i, '').trim();
  const m = rest.match(/(?:Episode|エピソード)\s*\d+\s*[-–—:]\s*(.+)$/i);
  if (m?.[1]?.trim()) return m[1].trim();

  const dash = rest.match(/[-–—:]\s*(.+)$/);
  if (dash?.[1]?.trim()) return dash[1].trim();

  const slugEp = base.match(/^(.+?)-ep\d{1,4}$/i);
  if (slugEp?.[1]?.trim()) {
    const title = humanizeSlug(slugEp[1]);
    if (title) return title;
  }

  return rest || '';
}

/** @param {string} base @param {string} dramaId @param {string} filename */
export function buildR2PublicMp4Url(base, dramaId, filename) {
  const name = String(filename || '')
    .split('/')
    .pop();
  const encoded = encodeURIComponent(name).replace(/%2F/g, '/');
  return `${base}/video/${dramaId}/${encoded}`;
}

/**
 * @param {{ key?: string; name?: string }[]} objects
 * @returns {{ episode_index: number; episode_title: string; file: string; play_url: string }[]}
 */
export function episodesFromR2Objects(objects, base, dramaId) {
  /** @type {Map<number, { episode_index: number; file: string; episode_title: string }>} */
  const byEp = new Map();

  for (const obj of objects) {
    const key = String(obj.key ?? obj.name ?? '').trim();
    if (!key || !/\.mp4$/i.test(key)) continue;
    const file = key.split('/').pop() || key;
    const ep = parseEpisodeNumberFromFilename(file);
    if (!ep) continue;
    const prev = byEp.get(ep);
    if (!prev || file.length > prev.file.length) {
      byEp.set(ep, {
        episode_index: ep,
        file,
        episode_title: episodeTitleFromFilename(file, ep),
      });
    }
  }

  return [...byEp.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => ({
      episode_index: row.episode_index,
      episode_title: row.episode_title,
      play_url: buildR2PublicMp4Url(base, dramaId, row.file),
    }));
}

/**
 * @param {import('@cloudflare/workers-types').R2Bucket} bucket
 * @param {string} dramaId
 */
export async function listR2ObjectsForDrama(bucket, dramaId) {
  const prefix = `video/${dramaId}/`;
  const objects = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix, cursor, limit: 1000 });
    if (page.objects?.length) objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects;
}

/**
 * 扫描桶内 video/{id}/*.mp4，返回每部剧的集号与首集文件名（用于解析剧名）。
 * @param {import('@cloudflare/workers-types').R2Bucket} bucket
 * @returns {Promise<Map<string, { eps: Set<number>; sampleFile: string }>>}
 */
export async function discoverR2DramaEpisodeSets(bucket) {
  /** @type {Map<string, { eps: Set<number>; sampleFile: string }>} */
  const byId = new Map();
  let cursor;
  do {
    const page = await bucket.list({ prefix: 'video/', cursor, limit: 1000 });
    for (const obj of page.objects || []) {
      const key = String(obj.key ?? '').trim();
      const m = key.match(/^video\/([^/]+)\/(.+)$/i);
      if (!m || !/\.mp4$/i.test(m[2])) continue;
      const file = m[2];
      const ep = parseEpisodeNumberFromFilename(file);
      if (!ep) continue;
      const id = m[1];
      if (!byId.has(id)) byId.set(id, { eps: new Set(), sampleFile: '' });
      const row = byId.get(id);
      row.eps.add(ep);
      if (ep === 1 || !row.sampleFile) row.sampleFile = file;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return byId;
}

/**
 * @param {Record<string, { file: string; episode_index?: number; episode_title?: string }[] | string[]>} manifests
 * @param {string} dramaId
 * @param {string} base
 */
export function episodesFromManifest(manifests, dramaId, base) {
  const raw = manifests?.[String(dramaId)];
  if (!raw?.length) return [];

  /** @type {Map<number, { episode_index: number; episode_title: string; play_url: string }>} */
  const byEp = new Map();

  for (const item of raw) {
    let file;
    let ep;
    let title;
    if (typeof item === 'string') {
      file = item.trim();
      ep = parseEpisodeNumberFromFilename(file);
      title = ep ? episodeTitleFromFilename(file, ep) : '';
    } else {
      file = String(item?.file ?? '').trim();
      ep = item?.episode_index ?? parseEpisodeNumberFromFilename(file);
      title = item?.episode_title || (ep ? episodeTitleFromFilename(file, ep) : '');
    }
    if (!file || !ep) continue;
    byEp.set(ep, {
      episode_index: ep,
      episode_title: title || `Episode ${ep}`,
      play_url: buildR2PublicMp4Url(base, dramaId, file),
    });
  }

  return [...byEp.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row);
}
