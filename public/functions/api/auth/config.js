import { jsonResponse } from './utils.js';

export async function onRequestGet(context) {
  const googleClientId = String(context.env.AUTH_GOOGLE_CLIENT_ID ?? '').trim();
  const facebookAppId = String(context.env.AUTH_FACEBOOK_APP_ID ?? '').trim();

  return jsonResponse({
    code: 200,
    googleClientId,
    facebookAppId,
    providers: {
      google: Boolean(googleClientId),
      facebook: Boolean(facebookAppId),
      email: true,
    },
  });
}
