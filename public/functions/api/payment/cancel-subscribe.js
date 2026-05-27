import { airwallexApi, requireUserDb, errorResponse, jsonResponse } from './airwallex.js';
import {
  buildSubMeta,
  persistSubMeta,
  resolveUserEmail,
  sendCancelledEmail,
} from './subscription-mail.js';

function memberTtlFromData(data) {
  const raw = data?.current_period_end_at ?? data?.current_period_end;
  const end = raw ? Date.parse(raw) : NaN;
  if (Number.isFinite(end)) {
    return Math.max(3600, Math.ceil((end - Date.now()) / 1000) + 86400);
  }
  return 35 * 86400;
}

function httpStatus(code) {
  const n = Number(code);
  return n >= 400 && n < 600 ? n : 502;
}

export async function onRequestPost(context) {
  try {
    requireUserDb(context.env);

    const { userId } = await context.request.json().catch(() => ({}));
    const uid = String(userId ?? '').trim();
    if (!uid) {
      return jsonResponse({ code: 400, msg: 'userId is required' }, 400);
    }

    const subStr = await context.env.USER_DB.get(`sub:${uid}`);
    if (!subStr) {
      return jsonResponse({ code: 404, msg: 'No subscription found' }, 404);
    }

    const sub = JSON.parse(subStr);
    const subscriptionId = String(sub.id ?? '').trim();
    if (!subscriptionId) {
      return jsonResponse({ code: 404, msg: 'Invalid subscription record' }, 404);
    }

    const { ok, status, data } = await airwallexApi(
      context.env,
      `/api/v1/subscriptions/${subscriptionId}/cancel`,
      {
        method: 'POST',
        body: { cancel_at_period_end: true },
      },
    );

    if (!ok) {
      return jsonResponse({
        code: status,
        msg: data?.message || data?.msg || 'Failed to cancel subscription',
        detail: data,
      }, httpStatus(status));
    }

    const sec = data && typeof data === 'object' ? memberTtlFromData(data) : 35 * 86400;
    if (data && typeof data === 'object') {
      await context.env.USER_DB.put(`sub:${uid}`, JSON.stringify(data), { expirationTtl: sec });
      const email = await resolveUserEmail(context.env.USER_DB, uid, data);
      if (email) {
        const meta = buildSubMeta(uid, email, { ...data, cancel_at_period_end: true });
        await persistSubMeta(context.env.USER_DB, meta, sec);
        context.waitUntil(
          sendCancelledEmail(context.env, context.env.USER_DB, uid, meta).catch(() => {}),
        );
      }
    }

    return jsonResponse({
      code: 200,
      msg: 'Subscription cancelled. Access continues until the current billing period ends.',
      data,
    });
  } catch (e) {
    return errorResponse(e, 'Failed to cancel subscription');
  }
}
