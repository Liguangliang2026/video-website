import {
  airwallexApi,
  requireUserDb,
  newRequestId,
  errorResponse,
  isAirwallexConfigured,
  jsonResponse,
} from './airwallex.js';

function httpStatus(code) {
  const n = Number(code);
  return n >= 400 && n < 600 ? n : 502;
}

export async function onRequestPost(context) {
  try {
    requireUserDb(context.env);

    const { email, name, userId } = await context.request.json().catch(() => ({}));
    const uid = String(userId ?? '').trim();
    const userEmail = String(email ?? '').trim().toLowerCase();
    const userName = String(name ?? userEmail ?? 'User').trim();

    if (!uid || !userEmail) {
      return jsonResponse({ code: 400, msg: 'userId and email are required' }, 400);
    }

    if (!isAirwallexConfigured(context.env)) {
      return jsonResponse({
        code: 200,
        skipped: true,
        msg: 'Airwallex secrets not configured; billing profile deferred until subscribe.',
      });
    }

    const existing = await context.env.USER_DB.get(`customer:${uid}`);
    if (existing && String(existing).startsWith('bcus_')) {
      return jsonResponse({ code: 200, customer_id: existing, reused: true });
    }

    const { ok, status, data } = await airwallexApi(context.env, '/api/v1/billing_customers/create', {
      method: 'POST',
      body: {
        request_id: newRequestId(),
        name: userName,
        email: userEmail,
        type: 'INDIVIDUAL',
        metadata: { user_id: uid },
      },
    });

    if (!ok) {
      return jsonResponse({
        code: status,
        msg: data?.message || data?.msg || 'Failed to create billing customer',
        detail: data,
      }, httpStatus(status));
    }

    const customerId = data.id;
    if (!customerId) {
      return jsonResponse({ code: 502, msg: 'Airwallex returned no billing customer id', detail: data }, 502);
    }

    await context.env.USER_DB.put(`customer:${uid}`, customerId);

    return jsonResponse({ code: 200, customer_id: customerId });
  } catch (e) {
    return errorResponse(e, 'Failed to create payment customer');
  }
}
