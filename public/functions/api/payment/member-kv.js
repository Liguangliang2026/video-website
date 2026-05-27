/** Shared KV helpers for VIP membership (webhook + sync) */

export function objPeriodEnd(obj) {
  const raw =
    obj?.current_period_end_at
    ?? obj?.current_period_end
    ?? obj?.trial_ends_at
    ?? obj?.trial_end_at;
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

export function memberTtlSeconds(data) {
  const end = objPeriodEnd(data);
  if (end) {
    const sec = Math.ceil((end - Date.now()) / 1000) + 86400;
    if (sec > 3600) return sec;
  }
  return 400 * 86400;
}

const ACTIVE_SUB_STATUSES = new Set([
  'ACTIVE',
  'IN_TRIAL',
  'TRIALING',
  'PENDING',
]);

export function isActiveSubscriptionStatus(status) {
  return ACTIVE_SUB_STATUSES.has(String(status ?? '').toUpperCase());
}

export async function activateMemberKv(env, userId, subscriptionLike) {
  const uid = String(userId ?? '').trim();
  if (!uid || !env?.USER_DB) return false;
  const ttl = memberTtlSeconds(subscriptionLike);
  await env.USER_DB.put(`member:${uid}`, 'active', { expirationTtl: ttl });
  await env.USER_DB.put(`sub:${uid}`, JSON.stringify(subscriptionLike), { expirationTtl: ttl });
  const subId = String(subscriptionLike?.id ?? '').trim();
  if (subId) {
    await env.USER_DB.put(`subscription:${subId}`, uid, { expirationTtl: ttl });
  }
  return true;
}

/** Resolve TeamShort userId from Airwallex webhook payload */
export async function resolveUserId(env, data, body) {
  const obj = data ?? {};
  const direct = [
    obj.metadata?.user_id,
    obj.metadata?.userId,
    body?.data?.metadata?.user_id,
    obj.subscription?.metadata?.user_id,
    obj.billing_customer?.metadata?.user_id,
    obj.customer?.merchant_customer_id,
  ];
  for (const v of direct) {
    const uid = String(v ?? '').trim();
    if (uid && uid.startsWith('usr_')) return uid;
  }

  if (!env?.USER_DB) return '';

  const checkoutId =
    String(obj.checkout_id ?? '').trim()
    || (String(obj.id ?? '').startsWith('bco_') ? String(obj.id) : '');
  if (checkoutId) {
    const uid = await env.USER_DB.get(`checkout:${checkoutId}`);
    if (uid) return String(uid).trim();
  }

  const subId =
    String(obj.subscription_id ?? '').trim()
    || (String(obj.id ?? '').startsWith('sub_') ? String(obj.id) : '');
  if (subId) {
    const uid = await env.USER_DB.get(`subscription:${subId}`);
    if (uid) return String(uid).trim();
  }

  return '';
}

export async function linkCheckoutToUser(env, checkoutId, userId) {
  const cid = String(checkoutId ?? '').trim();
  const uid = String(userId ?? '').trim();
  if (!cid || !uid || !env?.USER_DB) return;
  await env.USER_DB.put(`checkout:${cid}`, uid, { expirationTtl: 7 * 86400 });
}
