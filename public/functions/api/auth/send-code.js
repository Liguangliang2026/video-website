import {
  assertUserDb,
  generateOtpCode,
  isValidEmail,
  jsonResponse,
  normalizeEmail,
  saveOtp,
  sendVerificationEmail,
  OTP_TTL_SECONDS,
} from './utils.js';

export async function onRequestPost(context) {
  try {
    const kv = assertUserDb(context.env.USER_DB);
    const body = await context.request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);

    if (!email) {
      return jsonResponse({ code: 400, msg: 'Email is required' }, 400);
    }
    if (!isValidEmail(email)) {
      return jsonResponse({ code: 400, msg: 'Please enter a valid email address' }, 400);
    }

    const code = generateOtpCode();
    await saveOtp(kv, email, code);

    const mailResult = await sendVerificationEmail(context.env, email, code);
    const exposeDevCode = context.env.AUTH_OTP_EXPOSE_IN_RESPONSE === '1';

    if (!mailResult.sent) {
      if (exposeDevCode) {
        return jsonResponse({
          code: 200,
          msg: 'Verification code generated (dev mode)',
          expiresIn: OTP_TTL_SECONDS,
          devCode: code,
          mailWarning: mailResult.reason,
        });
      }
      return jsonResponse({
        code: 503,
        msg: 'Unable to send verification email. Configure RESEND_API_KEY and AUTH_FROM_EMAIL.',
        detail: mailResult.reason,
      }, 503);
    }

    const payload = {
      code: 200,
      msg: 'Verification code sent',
      expiresIn: OTP_TTL_SECONDS,
    };
    if (exposeDevCode) payload.devCode = code;

    return jsonResponse(payload);
  } catch (e) {
    const msg = e?.message === 'USER_DB is not bound'
      ? 'USER_DB is not bound on this environment'
      : 'Failed to send verification code';
    return jsonResponse({ code: 500, msg, detail: e?.message }, 500);
  }
}
