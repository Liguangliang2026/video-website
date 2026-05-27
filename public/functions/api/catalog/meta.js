import { findR2Drama, mapR2ToCatalogItem, r2PublicBase } from './r2.js';
import { fetchDramaListFromApi, hasDramaEnv, mapDramaToCatalogItem } from './drama.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const source = String(url.searchParams.get('source') ?? '').trim().toLowerCase();
  const id = String(url.searchParams.get('id') ?? '').trim();

  if (!source || !id) {
    return Response.json({ code: -1, msg: 'source and id required' });
  }

  if (source === 'r2') {
    const drama = await findR2Drama(env, id);
    if (!drama) {
      return Response.json({ code: -1, msg: 'R2 series not found' }, { status: 404 });
    }
    const item = mapR2ToCatalogItem(drama, 0);
    return Response.json({
      code: 0,
      data: {
        source: 'r2',
        ...item,
        r2_public_configured: Boolean(r2PublicBase(env)),
      },
    });
  }

  if (source === 'drama' && /^\d+$/.test(id)) {
    if (!hasDramaEnv(env)) {
      return Response.json({ code: -1, msg: 'DRAMA_* not configured' });
    }
    const { error, data } = await fetchDramaListFromApi(env, {
      page: 1,
      page_size: 1,
      video_id: id,
    });
    if (error) return error;
    const item = data?.data?.list?.[0];
    if (!item) {
      return Response.json({ code: -1, msg: 'Series not found' }, { status: 404 });
    }
    return Response.json({ code: 0, data: mapDramaToCatalogItem(item) });
  }

  return Response.json({ code: -1, msg: 'invalid source or id' });
}
