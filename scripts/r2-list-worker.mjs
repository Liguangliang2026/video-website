export default {
  async fetch(request, env) {
    const id = new URL(request.url).searchParams.get('id') || '8';
    const prefix = `video/${id}/`;
    const all = [];
    let cursor;
    do {
      const page = await env.R2_VIDEOS.list({ prefix, cursor, limit: 500 });
      for (const o of page.objects || []) all.push(o.key);
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return Response.json({ id, count: all.length, keys: all });
  },
};
