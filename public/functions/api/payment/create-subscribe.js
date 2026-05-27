import {
  airwallexApi,
  requireUserDb,
  newRequestId,
  requireBillingCheckoutIds,
  errorResponse,
  jsonResponse,
} from './airwallex.js';
import {
  billingTimeZone,
  formatBillingDate,
  nextSundayBillingAnchor,
} from './billing-schedule.js';
import { linkCheckoutToUser } from './member-kv.js';

function siteBase(env) {
  return String(env.SITE_BASE_URL ?? 'https://teamshort.net').replace(/\/$/, '');
}

function httpStatus(code) {
  const n = Number(code);
  return n >= 400 && n < 600 ? n : 502;
}

function buildSubscriptionData(env, planKey) {
  const base = {
    days_until_due: 0,
    default_invoice_template: {
      invoice_memo:
        'TeamShort VIP subscription. Recurring until cancelled at teamshort.net/vip',
    },
  };

  if (planKey === 'weekly') {
    const anchor = nextSundayBillingAnchor(env);
    return {
      data: {
        ...base,
        /* No charge until this instant; then $9.9/week on each Sunday 00:00 (billing TZ) */
        trial_ends_at: anchor.trialEndsAt,
        recurring: { period: 1, period_unit: 'WEEK' },
      },
      trialEndsAtMs: anchor.anchorMs,
      timeZone: anchor.timeZone,
      planKey,
    };
  }

  return { data: base, planKey };
}

export async function onRequestPost(context) {
  try {
    requireUserDb(context.env);

    const { userId, plan_id, plan_key } = await context.request.json().catch(() => ({}));
    const uid = String(userId ?? '').trim();
    const priceId = String(plan_id ?? '').trim();
    const planKey = String(plan_key ?? '').trim().toLowerCase() || 'monthly';

    if (!uid) {
      return jsonResponse({ code: 400, msg: 'userId is required' }, 400);
    }
    if (!priceId) {
      return jsonResponse({ code: 400, msg: 'plan_id (price_id) is required' }, 400);
    }

    const billingCustomerId = await context.env.USER_DB.get(`customer:${uid}`);
    if (!billingCustomerId) {
      return jsonResponse({
        code: 400,
        msg: 'Payment customer not found. Sign in again to register billing profile.',
      }, 400);
    }

    const billingIds = requireBillingCheckoutIds(context.env);
    const base = siteBase(context.env);
    const sub = buildSubscriptionData(context.env, planKey);

    const { ok, status, data } = await airwallexApi(context.env, '/api/v1/billing_checkouts/create', {
      method: 'POST',
      body: {
        request_id: newRequestId(),
        mode: 'SUBSCRIPTION',
        billing_customer_id: billingCustomerId,
        line_items: [{ price_id: priceId, quantity: 1 }],
        subscription_data: sub.data,
        success_url: `${base}/vip?status=success`,
        back_url: `${base}/vip?status=cancel`,
        metadata: { user_id: uid, plan_key: planKey },
        ...billingIds,
      },
    });

    if (!ok) {
      return jsonResponse({
        code: status,
        msg: data?.message || data?.msg || 'Failed to create billing checkout',
        detail: data,
      }, httpStatus(status));
    }

    const checkoutUrl = data.url;
    if (!checkoutUrl) {
      return jsonResponse({
        code: 502,
        msg: 'Airwallex returned no checkout url',
        detail: data,
      }, 502);
    }

    if (data.id) {
      await linkCheckoutToUser(context.env, data.id, uid);
    }

    const payload = {
      code: 200,
      checkout_id: data.id,
      checkout_url: checkoutUrl,
    };

    if (planKey === 'weekly' && sub.trialEndsAtMs) {
      payload.trial_ends_at = sub.data.trial_ends_at;
      payload.first_charge_at = formatBillingDate(sub.trialEndsAtMs, sub.timeZone);
      payload.billing_timezone = sub.timeZone || billingTimeZone(context.env);
    }

    return jsonResponse(payload);
  } catch (e) {
    return errorResponse(e, 'Failed to create subscription checkout');
  }
}
