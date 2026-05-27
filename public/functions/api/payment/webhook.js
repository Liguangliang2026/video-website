import { createHmac } from 'crypto';
import { handleSubscriptionWebhookEmail } from './subscription-mail.js';
import {
  activateMemberKv,
  memberTtlSeconds,
  resolveUserId,
} from './member-kv.js';

/** Airwallex Billing 用 name；旧版可能是 type */
function eventName(body) {
  return String(body?.name ?? body?.type ?? '').trim();
}

function payloadData(body) {
  const d = body?.data;
  if (!d) return {};
  return d.object ?? d;
}

const ACTIVATE_EVENTS = new Set([
  'subscription.active',
  'subscription.activated',
  'subscription.created',
  'subscription.in_trial',
  'subscription.trialing',
  'billing_checkout.completed',
  'billing_checkout.succeeded',
  'invoice.payment.paid',
  'invoice.paid',
]);

const DEACTIVATE_EVENTS = new Set([
  'subscription.cancelled',
  'subscription.canceled',
  'subscription.expired',
  'subscription.unpaid',
]);

const EMAIL_EVENTS = new Set([
  ...ACTIVATE_EVENTS,
  ...DEACTIVATE_EVENTS,
  'invoice.payment.failed',
  'invoice.payment_failed',
  'invoice.failed',
]);

export async function onRequestPost(context) {
  const { request, env } = context;
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers);

  const signature = headers['x-signature'];
  const timestamp = headers['x-timestamp'];
  if (!signature || !timestamp) return new Response('Forbidden', { status: 403 });

  const secret = String(env.AIRWALLEX_WEBHOOK_SECRET ?? '').trim();
  if (!secret) return new Response('Webhook secret not configured', { status: 500 });

  const valueToDigest = `${timestamp}.${rawBody}`;
  const hmac = createHmac('sha256', secret)
    .update(valueToDigest)
    .digest('hex');
  if (hmac !== signature) return new Response('Invalid signature', { status: 403 });

  const now = Date.now();
  if (Math.abs(now - parseInt(timestamp, 10)) > 5 * 60 * 1000) {
    return new Response('Expired', { status: 403 });
  }

  if (!env.USER_DB) return new Response('USER_DB not configured', { status: 500 });

  const body = JSON.parse(rawBody);
  const name = eventName(body);
  const data = payloadData(body);
  const userId = await resolveUserId(env, data, body);
  const ttl = memberTtlSeconds(data);

  if (ACTIVATE_EVENTS.has(name) && userId) {
    await activateMemberKv(env, userId, data);
  }

  if (DEACTIVATE_EVENTS.has(name) && userId) {
    if (name === 'subscription.expired') {
      await env.USER_DB.delete(`member:${userId}`);
      await env.USER_DB.delete(`sub:${userId}`);
      await env.USER_DB.delete(`submeta:${userId}`);
    } else if (name === 'subscription.cancelled' || name === 'subscription.canceled') {
      const subRaw = await env.USER_DB.get(`sub:${userId}`);
      if (subRaw) {
        try {
          const merged = { ...JSON.parse(subRaw), ...data, cancel_at_period_end: true };
          await env.USER_DB.put(`sub:${userId}`, JSON.stringify(merged), { expirationTtl: ttl });
        } catch {
          /* ignore */
        }
      }
    }
  }

  if (userId && EMAIL_EVENTS.has(name)) {
    context.waitUntil(
      handleSubscriptionWebhookEmail(env, env.USER_DB, name, data, userId, ttl).catch(() => {}),
    );
  }

  return new Response('OK', { status: 200 });
}
