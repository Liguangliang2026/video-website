const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_TTL_SECONDS = 600;
const OTP_KEY_PREFIX = 'otp:';
const USER_BY_EMAIL_PREFIX = 'user:email:';
const USER_BY_ID_PREFIX = 'user:id:';

const USERNAME_WORDS = [
  'swift', 'bright', 'calm', 'bold', 'keen', 'nova', 'pixel', 'orbit',
  'amber', 'coral', 'frost', 'ember', 'lynx', 'comet', 'prism', 'delta',
];

export function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return EMAIL_RE.test(normalizeEmail(email));
}

export function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function otpKey(email) {
  return `${OTP_KEY_PREFIX}${normalizeEmail(email)}`;
}

export function userByEmailKey(email) {
  return `${USER_BY_EMAIL_PREFIX}${normalizeEmail(email)}`;
}

export function userByIdKey(userId) {
  return `${USER_BY_ID_PREFIX}${userId}`;
}

export function generateUserId() {
  const part = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return `usr_${part}`;
}

export function generateUsername() {
  const word = USERNAME_WORDS[Math.floor(Math.random() * USERNAME_WORDS.length)];
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${word}_${suffix}`;
}

export function buildAvatarUrl(name) {
  const initial = String(name || 'U').charAt(0).toUpperCase();
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=ff6b35&color=fff&bold=true&size=128`;
}

export function assertUserDb(kv) {
  if (!kv) {
    throw new Error('USER_DB is not bound');
  }
  return kv;
}

export async function saveOtp(kv, email, code) {
  const payload = JSON.stringify({
    code,
    createdAt: Date.now(),
  });
  await kv.put(otpKey(email), payload, { expirationTtl: OTP_TTL_SECONDS });
}

export async function readOtp(kv, email) {
  const raw = await kv.get(otpKey(email));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearOtp(kv, email) {
  await kv.delete(otpKey(email));
}

export async function findUserByEmail(kv, email) {
  const raw = await kv.get(userByEmailKey(email));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function persistUser(kv, user) {
  const serialized = JSON.stringify(user);
  await kv.put(userByEmailKey(user.email), serialized);
  await kv.put(userByIdKey(user.userId), serialized);
}

export function publicUser(user) {
  return {
    userId: user.userId,
    email: user.email,
    name: user.name,
    picture: user.picture,
    provider: user.provider || 'email',
  };
}

export async function verifyGoogleIdToken(idToken, clientId) {
  const expectedClientId = String(clientId ?? '').trim();
  if (!expectedClientId) {
    throw new Error('AUTH_GOOGLE_CLIENT_ID is not configured');
  }

  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  if (!res.ok) {
    throw new Error('Invalid Google sign-in');
  }

  const payload = await res.json();
  if (payload.aud !== expectedClientId) {
    throw new Error('Google client ID mismatch');
  }

  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
  if (!emailVerified || !payload.email) {
    throw new Error('Google account email is not verified');
  }

  const now = Math.floor(Date.now() / 1000);
  if (Number(payload.exp) < now) {
    throw new Error('Google sign-in expired, try again');
  }

  return {
    googleId: String(payload.sub),
    email: normalizeEmail(payload.email),
    name: String(payload.name || payload.email.split('@')[0] || 'User').trim(),
    picture: typeof payload.picture === 'string' ? payload.picture.trim() : '',
  };
}

export async function upsertOAuthUser(kv, profile, provider) {
  const email = normalizeEmail(profile.email);
  let user = await findUserByEmail(kv, email);

  if (user) {
    user = {
      ...user,
      email,
      name: user.name || profile.name,
      picture: profile.picture || user.picture || buildAvatarUrl(user.name),
      provider: user.provider || provider,
      googleId: profile.googleId || user.googleId,
      updatedAt: new Date().toISOString(),
    };
  } else {
    user = {
      userId: generateUserId(),
      email,
      name: profile.name || generateUsername(),
      picture: profile.picture || buildAvatarUrl(profile.name),
      provider,
      googleId: profile.googleId,
      createdAt: new Date().toISOString(),
    };
  }

  await persistUser(kv, user);
  return user;
}

export async function sendVerificationEmail(env, email, code) {
  const apiKey = env.RESEND_API_KEY;
  const from = env.AUTH_FROM_EMAIL || 'onboarding@resend.dev';

  if (!apiKey) {
    return { sent: false, reason: 'RESEND_API_KEY is not configured' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Your verification code',
      html: `
        <p>Use this code to sign in. It expires in 10 minutes.</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${code}</p>
        <p style="color:#666;font-size:13px">If you did not request this, you can ignore this email.</p>
      `,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { sent: false, reason: detail || `Resend HTTP ${res.status}` };
  }

  return { sent: true };
}

export { OTP_TTL_SECONDS };
