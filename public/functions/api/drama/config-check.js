/** 仅用于排查部署：不返回密钥内容 */
export async function onRequestGet(context) {
  const env = context.env ?? {};
  const keys = ['DRAMA_BASE_URL', 'DRAMA_APP_ID', 'DRAMA_APP_SECRET', 'R2_PUBLIC_BASE'];
  const configured = Object.fromEntries(
    keys.map((k) => [k, Boolean(String(env[k] ?? '').trim())]),
  );
  const ok = keys.every((k) => configured[k]);
  return Response.json({
    code: ok ? 0 : -1,
    msg: ok
      ? 'DRAMA env vars are set'
      : 'Set DRAMA_* in Cloudflare Pages → Settings → Environment variables → Production, then Retry deployment',
    configured,
  });
}
