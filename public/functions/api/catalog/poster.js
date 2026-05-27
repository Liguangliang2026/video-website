/**
 * 剧星封面可能被防盗链；同源代理：GET /api/catalog/poster?url=https%3A%2F%2F...
 */
const ALLOWED_HOSTS = ['img.zjchjc.cn'];

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const raw = String(url.searchParams.get('url') ?? '').trim();
  if (!raw) {
    return Response.json({ code: -1, msg: 'url required' }, { status: 400 });
  }

  let target;
  try {
    target = new URL(raw);
  } catch {
    return Response.json({ code: -1, msg: 'invalid url' }, { status: 400 });
  }

  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.includes(target.hostname)) {
    return Response.json({ code: -1, msg: 'host not allowed' }, { status: 403 });
  }

  const res = await fetch(target.toString(), {
    headers: { Accept: 'image/*' },
  });

  if (!res.ok) {
    return new Response('Upstream error', { status: res.status });
  }

  const headers = new Headers();
  const ct = res.headers.get('Content-Type');
  if (ct) headers.set('Content-Type', ct);
  headers.set('Cache-Control', 'public, max-age=86400');

  return new Response(res.body, { status: 200, headers });
}
