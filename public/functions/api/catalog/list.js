import { fetchDramaListFromApi, hasDramaEnv, mapDramaToCatalogItem } from './drama.js';
import { getR2DramasLive, mapR2ToCatalogItem } from './r2.js';

function parsePositiveInt(v, fallback, max = Infinity) {
  const n = parseInt(String(v ?? '').trim(), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, n);
}

function parseNonNegativeInt(v, fallback, max = 10000) {
  const n = parseInt(String(v ?? '').trim(), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(max, n);
}

async function fetchAllDramaItems(env) {
  const page_size = 50;
  const { error, data } = await fetchDramaListFromApi(env, { page: 1, page_size });
  if (error || !data || data.code !== 0) return { items: [], error };

  const first = (data.data?.list ?? []).map((it) => mapDramaToCatalogItem(it, { withDescription: false }));
  const total = Number(data.data?.total) || first.length;
  const all = [...first];

  const pages = Math.max(1, Math.ceil(total / page_size));
  for (let p = 2; p <= pages; p++) {
    const next = await fetchDramaListFromApi(env, { page: p, page_size });
    if (next.error || !next.data || next.data.code !== 0) break;
    all.push(
      ...(next.data.data?.list ?? []).map((it) => mapDramaToCatalogItem(it, { withDescription: false })),
    );
  }

  return { items: all, error: null };
}

const listMapOpts = { withDescription: false };

async function getMergedCatalog(env) {
  const r2Dramas = await getR2DramasLive(env);
  const r2All = r2Dramas.map((d, i) => mapR2ToCatalogItem(d, i, listMapOpts));
  if (!hasDramaEnv(env)) return r2All;

  const { items, error } = await fetchAllDramaItems(env);
  if (error) return r2All;
  return [...r2All, ...items];
}

function paginateSlice(merged, { page, page_size, offset }) {
  const total = merged.length;
  const start = offset + (page - 1) * page_size;
  const list = merged.slice(start, start + page_size);
  const remaining = Math.max(0, total - offset);
  const pages = Math.max(1, Math.ceil(remaining / page_size));
  return {
    page,
    page_size,
    offset,
    total,
    pages,
    list,
  };
}

export async function onRequestGet(context) {
  try {
    const { env, request } = context;
    const url = new URL(request.url);
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const page_size = parsePositiveInt(url.searchParams.get('page_size'), 10, 50);
    const offset = parseNonNegativeInt(url.searchParams.get('offset'), 0);
    const sourceFilter = String(url.searchParams.get('source') ?? '').trim().toLowerCase();

    const r2Dramas = await getR2DramasLive(env);
    const r2All = r2Dramas.map((d, i) => mapR2ToCatalogItem(d, i, listMapOpts));

    if (sourceFilter === 'r2') {
      return Response.json({
        code: 0,
        msg: 'success',
        data: paginateSlice(r2All, { page, page_size, offset: 0 }),
      });
    }

    if (sourceFilter === 'drama') {
      if (!hasDramaEnv(env)) {
        return Response.json({
          code: -1,
          msg: 'DRAMA_* env not configured',
          data: { page, page_size, offset: 0, total: 0, pages: 0, list: [] },
        });
      }
      const { error, data } = await fetchDramaListFromApi(env, { page, page_size });
      if (error) return error;
      const body = data ?? {};
      const raw = body.data?.list ?? [];
      const dramaTotal = body.data?.total ?? raw.length;
      return Response.json({
        ...body,
        data: {
          ...(body.data || {}),
          offset: 0,
          list: raw.map((it) => mapDramaToCatalogItem(it, listMapOpts)),
          total: dramaTotal,
        },
      });
    }

    const merged = await getMergedCatalog(env);
    return Response.json({
      code: 0,
      msg: 'success',
      data: paginateSlice(merged, { page, page_size, offset }),
    });
  } catch (err) {
    return Response.json({ code: -1, error: err.message });
  }
}
