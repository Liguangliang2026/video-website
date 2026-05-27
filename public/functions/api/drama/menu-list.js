import { makeSignedDramaQuery } from './utils.js';

export async function onRequestGet(context) {
  try {
    const { env } = context;
    const signed = await makeSignedDramaQuery(env, { page: 1, page_size: 20 });
    if (signed.error) return signed.error;

    const apiUrl = `${signed.base}/api/open/video/menu/list?${signed.queryString}`;
    const res = await fetch(apiUrl);
    const data = await res.json();

    return Response.json(data);
  } catch (err) {
    return Response.json({ code: -1, error: err.message });
  }
}
