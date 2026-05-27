const API_BASE = 'https://api.airwallex.com';

export function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function isAirwallexConfigured(env) {
  const clientId = String(env?.AIRWALLEX_CLIENT_ID ?? '').trim();
  const apiKey = String(env?.AIRWALLEX_API_KEY ?? '').trim();
  return Boolean(clientId && apiKey);
}

export function requireUserDb(env) {
  if (!env?.USER_DB) {
    const err = new Error('USER_DB KV binding is not configured');
    err.code = 500;
    throw err;
  }
}

export function newRequestId() {
  return crypto.randomUUID();
}

export async function getAirwallexAccessToken(env) {
  if (!isAirwallexConfigured(env)) {
    const err = new Error(
      'Airwallex is not configured. Set AIRWALLEX_CLIENT_ID and AIRWALLEX_API_KEY via wrangler pages secret put.',
    );
    err.code = 503;
    throw err;
  }
  const clientId = String(env.AIRWALLEX_CLIENT_ID).trim();
  const apiKey = String(env.AIRWALLEX_API_KEY).trim();

  const res = await fetch(`${API_BASE}/api/v1/authentication/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-client-id': clientId,
      'x-api-key': apiKey,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || data?.msg || 'Airwallex authentication failed');
    err.code = res.status;
    err.detail = data;
    throw err;
  }

  const token = String(data.token ?? '').trim();
  if (!token) {
    const err = new Error('Airwallex login returned no token');
    err.code = 502;
    err.detail = data;
    throw err;
  }

  return token;
}

export async function airwallexApi(env, path, { method = 'GET', body } = {}) {
  const token = await getAirwallexAccessToken(env);
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export function billingCheckoutIds(env) {
  const legalEntityId = String(env.AIRWALLEX_LEGAL_ENTITY_ID ?? '').trim();
  const linkedPaymentAccountId = String(env.AIRWALLEX_LINKED_PAYMENT_ACCOUNT_ID ?? '').trim();
  return { legalEntityId, linkedPaymentAccountId };
}

/** linked_payment_account_id is required when the merchant has multiple Airwallex payment accounts. */
export function requireBillingCheckoutIds(env) {
  const { legalEntityId, linkedPaymentAccountId } = billingCheckoutIds(env);

  if (!linkedPaymentAccountId) {
    const err = new Error(
      'Missing AIRWALLEX_LINKED_PAYMENT_ACCOUNT_ID in wrangler.toml [vars]. '
      + 'Airwallex → Settings → Account details → copy Linked payment account ID (acct_…), then npm run deploy.',
    );
    err.code = 503;
    throw err;
  }

  const extra = { linked_payment_account_id: linkedPaymentAccountId };
  if (legalEntityId) extra.legal_entity_id = legalEntityId;
  return extra;
}

export function errorResponse(e, fallbackMsg) {
  const code = Number(e?.code) || 500;
  const status = code >= 400 && code < 600 ? code : 500;
  return jsonResponse(
    {
      code: status,
      msg: e?.message || fallbackMsg,
      detail: e?.detail ?? undefined,
    },
    status,
  );
}
