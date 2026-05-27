import {
  dramaPlaybackExpireFromNow,
  dramaSkipExpireTime,
  makeSignedDramaQuery,
} from '../drama/utils.js';
import { buildR2EpisodeList } from './r2.js';

export async function onRequestGet(context) {
  try {
    const { env, request } = context;
    const url = new URL(request.url);
    const source = String(url.searchParams.get('source') ?? '').trim().toLowerCase();
    const id = String(url.searchParams.get('id') ?? url.searchParams.get('video_id') ?? '').trim();

    if (!source || !id) {
      return Response.json({
        code: -1,
        msg: 'source and id required (e.g. source=r2&id=1 or source=drama&id=32582)',
      });
    }

    if (source === 'r2') {
      const built = await buildR2EpisodeList(env, id);
      if (built.error) return built.error;
      return Response.json({ code: 0, msg: 'success', data: built.data });
    }

    if (source === 'drama') {
      if (!/^\d+$/.test(id)) {
        return Response.json({ code: -1, msg: 'drama id must be a positive integer' });
      }

      const extrasWithExpire = dramaSkipExpireTime(env)
        ? { video_id: id }
        : { video_id: id, expire_time: dramaPlaybackExpireFromNow() };

      let signed = await makeSignedDramaQuery(env, extrasWithExpire);
      if (signed.error) return signed.error;

      let apiUrl = `${signed.base}/api/open/video/episode/list?${signed.queryString}`;
      let res = await fetch(apiUrl);
      let data = await res.json();

      if (data.code === 10028 && !dramaSkipExpireTime(env) && 'expire_time' in extrasWithExpire) {
        signed = await makeSignedDramaQuery(env, { video_id: id });
        if (!signed.error) {
          apiUrl = `${signed.base}/api/open/video/episode/list?${signed.queryString}`;
          res = await fetch(apiUrl);
          data = await res.json();
        }
      }

      return Response.json(data);
    }

    return Response.json({ code: -1, msg: 'source must be r2 or drama' });
  } catch (err) {
    return Response.json({ code: -1, error: err.message });
  }
}
