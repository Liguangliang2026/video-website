import { jsonResponse } from '../auth/utils.js';
import { airwallexApi } from '../payment/airwallex.js';
import {
  activateMemberKv,
  isActiveSubscriptionStatus,
  objPeriodEnd,
} from '../payment/member-kv.js';

function requireUserDb(env) {
  if (!env?.USER_DB) {
    const err = new Error('USER_DB KV binding is not configured');
    err.code = 500;
    throw err;
  }
  return env.USER_DB;
}

/** POST — 支付成功后主动从 Airwallex 同步订阅并开通 VIP（Webhook 延迟时的兜底） */
export async function onRequestPost(context) {
  try {
    const kv = requireUserDb(context.env);
    const { userId } = await context.request.json().catch(() => ({}));
    const uid = String(userId ?? '').trim();
    if (!uid) {
      return jsonResponse({ code: 400, msg: 'userId is required' }, 400);
    }

    const existing = await kv.get(`member:${uid}`);
    if (existing === 'active') {
      const subStr = await kv.get(`sub:${uid}`);
      let expireAt = null;
      if (subStr) {
        try {
          expireAt = objPeriodEnd(JSON.parse(subStr));
        } catch {
          /* ignore */
        }
      }
      return jsonResponse({
        code: 200,
        isMember: true,
        synced: false,
        source: 'kv',
        expireAt: expireAt ? new Date(expireAt).toISOString() : null,
      });
    }

    const billingCustomerId = await kv.get(`customer:${uid}`);
    if (!billingCustomerId) {
      return jsonResponse({
        code: 200,
        isMember: false,
        msg: 'No billing customer. Complete checkout after sign-in.',
      });
    }

    const { ok, status, data } = await airwallexApi(
      context.env,
      `/api/v1/subscriptions?billing_customer_id=${encodeURIComponent(billingCustomerId)}&page_size=20`,
    );

    if (!ok) {
      return jsonResponse({
        code: status,
        isMember: false,
        msg: data?.message || 'Could not list subscriptions from Airwallex',
        detail: data,
      }, status >= 400 && status < 600 ? status : 502);
    }

    const items = data?.items ?? data?.data ?? [];
    const activeSub = items.find((s) => isActiveSubscriptionStatus(s?.status));

    if (!activeSub) {
      return jsonResponse({
        code: 200,
        isMember: false,
        synced: true,
        msg: 'No active subscription found yet. Wait a moment and refresh.',
        subscriptionStatuses: items.map((s) => s?.status).filter(Boolean),
      });
    }

    await activateMemberKv(context.env, uid, activeSub);

    const end = objPeriodEnd(activeSub);
    return jsonResponse({
      code: 200,
      isMember: true,
      synced: true,
      source: 'airwallex',
      subscriptionId: activeSub.id,
      status: activeSub.status,
      expireAt: end ? new Date(end).toISOString() : null,
    });
  } catch (e) {
    return jsonResponse(
      { code: 500, msg: e?.message || 'Failed to sync membership' },
      500,
    );
  }
}
