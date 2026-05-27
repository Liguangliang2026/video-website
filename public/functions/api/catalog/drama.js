import { makeSignedDramaQuery } from '../drama/utils.js';

function parsePositiveInt(v, fallback, max = Infinity) {
  const n = parseInt(String(v ?? '').trim(), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, n);
}

export function hasDramaEnv(env) {
  return Boolean(
    String(env.DRAMA_APP_ID ?? '').trim() &&
      String(env.DRAMA_APP_SECRET ?? '').trim() &&
      String(env.DRAMA_BASE_URL ?? '').trim(),
  );
}

export async function fetchDramaListFromApi(env, { page, page_size, video_id }) {
  const extra = { page, page_size };
  if (video_id && /^\d+$/.test(String(video_id).trim())) {
    extra.video_id = String(video_id).trim();
  }

  const signed = await makeSignedDramaQuery(env, extra);
  if (signed.error) return { error: signed.error };

  const apiUrl = `${signed.base}/api/open/video/list?${signed.queryString}`;
  const res = await fetch(apiUrl);
  return { data: await res.json() };
}

export function mapDramaToCatalogItem(it, opts = {}) {
  const item = {
    source: 'drama',
    video_id: String(it.video_id),
    video_title: it.video_title,
    video_total: it.video_total,
    logo_img: it.logo_img,
  };
  if (opts.withDescription !== false) {
    item.recommendation = it.recommendation;
    item.introduce = it.introduce;
  }
  return item;
}
