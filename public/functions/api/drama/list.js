import { makeSignedDramaQuery } from './utils.js';

function parsePositiveInt(v, fallback, max = Infinity) {
  const n = parseInt(String(v ?? '').trim(), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, n);
}

export async function onRequestGet(context) {
  try {
    const { env, request } = context;
    const url = new URL(request.url);

    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const page_size = parsePositiveInt(url.searchParams.get('page_size'), 10, 50);

    const extra = { page, page_size };

    const video_id = url.searchParams.get('video_id');
    if (video_id && /^\d+$/.test(String(video_id).trim())) {
      extra.video_id = String(video_id).trim();
    }
    const master_video_id = url.searchParams.get('master_video_id');
    if (master_video_id && /^\d+$/.test(String(master_video_id).trim())) {
      extra.master_video_id = String(master_video_id).trim();
    }
    const update_time_start = url.searchParams.get('update_time_start');
    if (update_time_start && /^\d+$/.test(String(update_time_start).trim())) {
      extra.update_time_start = String(update_time_start).trim();
    }
    const update_time_end = url.searchParams.get('update_time_end');
    if (update_time_end && /^\d+$/.test(String(update_time_end).trim())) {
      extra.update_time_end = String(update_time_end).trim();
    }

    const signed = await makeSignedDramaQuery(env, extra);
    if (signed.error) return signed.error;

    const apiUrl = `${signed.base}/api/open/video/list?${signed.queryString}`;
    const res = await fetch(apiUrl);
    const data = await res.json();

    return Response.json(data);
  } catch (err) {
    return Response.json({ code: -1, error: err.message });
  }
}
