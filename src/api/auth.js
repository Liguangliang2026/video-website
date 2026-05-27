async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.code) {
    throw new Error(data.msg || `HTTP ${res.status}`);
  }
  return data;
}

export async function fetchAuthConfig() {
  const res = await fetch('/api/auth/config');
  return parseJson(res);
}

export async function loginWithGoogleCredential(credential) {
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });
  return parseJson(res);
}

export async function sendEmailVerificationCode(email) {
  const res = await fetch('/api/auth/send-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return parseJson(res);
}

export async function verifyEmailCode(email, code) {
  const res = await fetch('/api/auth/verify-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  return parseJson(res);
}
