import { onRequestPost as googleSignIn } from './auth/google.js';

/** @deprecated 兼容旧路径，请使用 POST /api/auth/google */
export async function onRequestPost(context) {
  const body = await context.request.json().catch(() => ({}));
  const credential = body.credential || body.googleToken || body.idToken;
  if (!credential) {
    return Response.json({ code: 400, msg: 'Missing Google credential' }, 400);
  }

  const req = new Request(context.request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });

  return googleSignIn({ ...context, request: req });
}
