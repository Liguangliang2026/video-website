import {
  airwallexApi,
  requireUserDb,
  newRequestId,
  errorResponse,
  jsonResponse,
} from './airwallex.js';
import { activateMemberKv } from './member-kv.js';
import {
  configuredPlanIds,
  resolvePlanKey,
  targetPriceId,
} from './plan-utils.js';

function httpStatus(code) {
  const n = Number(code);
  return n >= 400 && n < 600 ? n : 502;
}

async function fetchSubscriptionItems(env, subscriptionId) {
  const { ok, data } = await airwallexApi(
    env,
    `/api/v1/subscriptions/${encodeURIComponent(subscriptionId)}/items`,
  );
  if (ok) {
    const items = data?.items ?? data?.data ?? [];
    if (items.length) return items;
  }

  const subRes = await airwallexApi(
    env,
    `/api/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
  );
  if (subRes.ok) {
    return subRes.data?.items ?? subRes.data?.subscription_items ?? [];
  }
  return [];
}

export async function onRequestPost(context) {
  try {
    requireUserDb(context.env);

    const { userId, plan_key: targetPlanKey } = await context.request.json().catch(() => ({}));
    const uid = String(userId ?? '').trim();
    const target = String(targetPlanKey ?? '').trim().toLowerCase();

    if (!uid) {
      return jsonResponse({ code: 400, msg: 'userId is required' }, 400);
    }
    if (target !== 'monthly') {
      return jsonResponse({ code: 400, msg: 'Only upgrade to monthly is supported' }, 400);
    }

    const monthlyPriceId = targetPriceId(context.env, 'monthly');
    if (!monthlyPriceId) {
      return jsonResponse({
        code: 503,
        msg: 'Monthly plan is not configured (AIRWALLEX_PLAN_MONTHLY)',
      }, 503);
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

    const currentKey = resolvePlanKey(sub, context.env);
    if (currentKey === 'monthly') {
      return jsonResponse({ code: 400, msg: 'You are already on the monthly plan' }, 400);
    }

    const status = String(sub.status ?? '').toUpperCase();
    if (status === 'CANCELLED' || status === 'CANCELED') {
      return jsonResponse({ code: 400, msg: 'Subscription is cancelled. Subscribe again from the VIP page.' }, 400);
    }

    const existingItems = await fetchSubscriptionItems(context.env, subscriptionId);
    if (!existingItems.length) {
      return jsonResponse({ code: 502, msg: 'Could not load subscription items from Airwallex' }, 502);
    }

    const updateItems = existingItems
      .filter((it) => String(it?.id ?? '').trim())
      .map((it) => ({ id: it.id, deleted: true }));
    updateItems.push({ price_id: monthlyPriceId, quantity: 1 });

    const body = {
      request_id: newRequestId(),
      items: updateItems,
      cancel_at_period_end: false,
      metadata: {
        ...(sub.metadata && typeof sub.metadata === 'object' ? sub.metadata : {}),
        user_id: uid,
        plan_key: 'monthly',
      },
      default_invoice_template: {
        invoice_memo:
          'TeamShort VIP monthly subscription. Recurring until cancelled at teamshort.net/vip',
      },
    };

    if (status === 'IN_TRIAL' || status === 'TRIALING') {
      body.trial_ends_at = 'NOW';
      body.billing_action = 'IMMEDIATE_CHARGE_AND_RESET_CYCLE';
      body.default_proration_mode = 'NONE';
    } else if (status === 'ACTIVE' || status === 'PENDING') {
      body.billing_action = 'IMMEDIATE_CHARGE_AND_RESET_CYCLE';
      body.default_proration_mode = 'PRORATED';
    } else {
      return jsonResponse({
        code: 400,
        msg: `Cannot change plan while subscription status is ${status || 'unknown'}`,
      }, 400);
    }

    const { ok, status: apiStatus, data } = await airwallexApi(
      context.env,
      `/api/v1/subscriptions/${encodeURIComponent(subscriptionId)}/update`,
      { method: 'POST', body },
    );

    if (!ok) {
      return jsonResponse({
        code: apiStatus,
        msg: data?.message || data?.msg || 'Failed to change subscription plan',
        detail: data,
      }, httpStatus(apiStatus));
    }

    const merged = {
      ...sub,
      ...(data && typeof data === 'object' ? data : {}),
      metadata: body.metadata,
      items: data?.items ?? updateItems,
    };
    await activateMemberKv(context.env, uid, merged);

    return jsonResponse({
      code: 200,
      msg: 'Switched to monthly. $29.9 billed now; future renewals are monthly until you cancel.',
      planKey: 'monthly',
      data: merged,
    });
  } catch (e) {
    return errorResponse(e, 'Failed to change subscription plan');
  }
}
