import {
  assertUserDb,
  buildAvatarUrl,
  clearOtp,
  findUserByEmail,
  generateUserId,
  generateUsername,
  isValidEmail,
  jsonResponse,
  normalizeEmail,
  persistUser,
  publicUser,
  readOtp,
} from './utils.js';

export async function onRequestPost(context) {
  try {
    const kv = assertUserDb(context.env.USER_DB);
    const body = await context.request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const code = String(body.code ?? '').trim();

    if (!email) {
      return jsonResponse({ code: 400, msg: 'Email is required' }, 400);
    }
    if (!isValidEmail(email)) {
      return jsonResponse({ code: 400, msg: 'Please enter a valid email address' }, 400);
    }
    if (!code) {
      return jsonResponse({ code: 400, msg: 'Verification code is required' }, 400);
    }
    if (!/^\d{6}$/.test(code)) {
      return jsonResponse({ code: 400, msg: 'Verification code must be 6 digits' }, 400);
    }

    const otp = await readOtp(kv, email);
    if (!otp?.code) {
      return jsonResponse({ code: 400, msg: 'Code expired or not found. Request a new one.' }, 400);
    }
    if (otp.code !== code) {
      return jsonResponse({ code: 400, msg: 'Incorrect verification code' }, 400);
    }

    await clearOtp(kv, email);

    let user = await findUserByEmail(kv, email);
    if (!user) {
      const name = generateUsername();
      user = {
        userId: generateUserId(),
        email,
        name,
        picture: buildAvatarUrl(name),
        provider: 'email',
        createdAt: new Date().toISOString(),
      };
      await persistUser(kv, user);
    }

    return jsonResponse({
      code: 200,
      msg: 'Signed in',
      user: publicUser(user),
    });
  } catch (e) {
    const msg = e?.message === 'USER_DB is not bound'
      ? 'USER_DB is not bound on this environment'
      : 'Verification failed';
    return jsonResponse({ code: 500, msg, detail: e?.message }, 500);
  }
}
