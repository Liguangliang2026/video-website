import {
  dramaPlaybackExpireFromNow,
  dramaSkipExpireTime,
  makeSignedDramaQuery
} from './utils.js';

export async function onRequestGet(context) {
  try {
    const { env, request } = context;
    const params = new URLSearchParams(request.url.split('?')[1] || '');
    const raw = params.get('video_id');
    const video_id = raw == null ? '' : String(raw).trim();

    if (!video_id || !/^\d+$/.test(video_id)) {
      return Response.json({ code: -1, msg: 'video_id required (positive integer)' });
    }

    const extrasWithExpire = dramaSkipExpireTime(env)
      ? { video_id }
      : { video_id, expire_time: dramaPlaybackExpireFromNow() };

    let signed = await makeSignedDramaQuery(env, extrasWithExpire);
    if (signed.error) return signed.error;

    let apiUrl = `${signed.base}/api/open/video/episode/list?${signed.queryString}`;
    let res = await fetch(apiUrl);
    let data = await res.json();

    // 部分环境对 expire_time 与 timestamp 联合校验会误报 10028；重试一次不传 expire_time（文档：不传默认 +1 天）
    if (data.code === 10028 && !dramaSkipExpireTime(env) && 'expire_time' in extrasWithExpire) {
      signed = await makeSignedDramaQuery(env, { video_id });
      if (!signed.error) {
        apiUrl = `${signed.base}/api/open/video/episode/list?${signed.queryString}`;
        res = await fetch(apiUrl);
        data = await res.json();
      }
    }

    return Response.json(data);
  } catch (err) {
    return Response.json({ code: -1, error: err.message });
  }
}
