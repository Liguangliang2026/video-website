import {
  assertUserDb,
  jsonResponse,
  publicUser,
  upsertOAuthUser,
  verifyGoogleIdToken,
} from './utils.js';

export async function onRequestPost(context) {
  try {
    const kv = assertUserDb(context.env.USER_DB);
    const body = await context.request.json().catch(() => ({}));
    const credential = String(body.credential ?? body.idToken ?? '').trim();

    if (!credential) {
      return jsonResponse({ code: 400, msg: 'Google credential is required' }, 400);
    }

    const profile = await verifyGoogleIdToken(
      credential,
      context.env.AUTH_GOOGLE_CLIENT_ID,
    );
    const user = await upsertOAuthUser(kv, profile, 'google');

    return jsonResponse({
      code: 200,
      msg: 'Signed in with Google',
      user: publicUser(user),
    });
  } catch (e) {
    const msg = e?.message === 'USER_DB is not bound'
      ? 'USER_DB is not bound on this environment'
      : (e?.message || 'Google sign-in failed');
    const status = msg.includes('not configured') || msg.includes('Invalid') ? 400 : 500;
    return jsonResponse({ code: status, msg, detail: e?.message }, status);
  }
}
