const SUPPORT_EMAIL = 'support@teamshort.net';

function siteBase(env) {
  return String(env.SITE_BASE_URL ?? 'https://teamshort.net').replace(/\/$/, '');
}

function vipUrl(env) {
  return `${siteBase(env)}/vip`;
}

function legalUrl(env) {
  return `${siteBase(env)}/legal/subscription`;
}

function formatMoney(amount, currency = 'USD') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n / 100);
  } catch {
    return `${currency} ${(n / 100).toFixed(2)}`;
  }
}

function formatDate(isoOrMs) {
  const t = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs);
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function periodEndMs(data) {
  const raw = data?.current_period_end_at ?? data?.current_period_end;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

function inferInterval(data) {
  const raw =
    data?.recurring?.interval
    ?? data?.items?.[0]?.price?.recurring?.interval
    ?? data?.subscription_items?.[0]?.price?.recurring?.interval
    ?? data?.plan?.interval;
  const s = String(raw ?? '').toLowerCase();
  if (s.includes('week')) return 'week';
  if (s.includes('month')) return 'month';
  const start = Date.parse(data?.current_period_start_at ?? data?.current_period_start ?? '');
  const end = periodEndMs(data);
  if (start && end) {
    const days = (end - start) / 86400000;
    if (days <= 10) return 'week';
    if (days <= 45) return 'month';
  }
  return 'month';
}

function planLabel(interval, data) {
  if (interval === 'week') {
    const trial = data?.trial_ends_at ?? data?.trialEndsAt;
    if (trial) {
      return 'Weekly VIP ($0.01 signup · $9.90/week from trial end)';
    }
    return 'Weekly VIP ($9.90/week)';
  }
  return 'Monthly VIP ($29.90/month)';
}

function extractAmount(data) {
  const cents =
    data?.amount_due
    ?? data?.total_amount
    ?? data?.amount
    ?? data?.lines?.data?.[0]?.amount
    ?? data?.line_items?.[0]?.amount;
  const currency = data?.currency ?? data?.lines?.data?.[0]?.currency ?? 'USD';
  if (cents == null) return { label: null, currency };
  const label = formatMoney(cents, String(currency).toUpperCase());
  return { label, currency: String(currency).toUpperCase() };
}

export function buildSubMeta(userId, email, data) {
  const interval = inferInterval(data);
  const end = periodEndMs(data);
  const { label: amountLabel } = extractAmount(data);
  return {
    userId,
    email,
    subscriptionId: String(data?.id ?? data?.subscription_id ?? '').trim(),
    interval,
    planLabel: planLabel(interval, data),
    periodEnd: end,
    amountLabel,
    cancelAtPeriodEnd: Boolean(data?.cancel_at_period_end),
    updatedAt: Date.now(),
  };
}

export async function getUserById(kv, userId) {
  const raw = await kv.get(`user:id:${userId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function resolveUserEmail(kv, userId, data) {
  const fromData =
    data?.customer?.email
    ?? data?.billing_customer?.email
    ?? data?.customer_email;
  if (fromData) return String(fromData).trim().toLowerCase();

  const user = await getUserById(kv, userId);
  return user?.email ? String(user.email).trim().toLowerCase() : '';
}

async function sendResend(env, { to, subject, html }) {
  const apiKey = String(env.RESEND_API_KEY ?? '').trim();
  const from = String(env.AUTH_FROM_EMAIL ?? '').trim() || 'onboarding@resend.dev';
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY not configured' };
  if (!to) return { sent: false, reason: 'missing recipient' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: SUPPORT_EMAIL,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { sent: false, reason: detail || `Resend HTTP ${res.status}` };
  }
  return { sent: true };
}

function emailShell(title, bodyHtml, env) {
  const base = siteBase(env);
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.55;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">
  <p style="margin:0 0 8px;font-size:13px;color:#666">TeamShort</p>
  ${bodyHtml}
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
  <p style="font-size:12px;color:#888">
    <a href="${vipUrl(env)}">Manage subscription</a> ·
    <a href="${legalUrl(env)}">Subscription terms</a><br />
    Questions? <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a><br />
    ${base}
  </p>
</body>
</html>`;
}

export async function sendWelcomeEmail(env, kv, userId, meta) {
  const dedupeKey = `emailsent:welcome:${userId}`;
  if (await kv.get(dedupeKey)) return { sent: false, reason: 'already sent' };

  const to = meta.email;
  const endLabel = meta.periodEnd ? formatDate(meta.periodEnd) : 'the end of each billing period';
  const trialNote =
    meta.interval === 'week' && meta.periodEnd
      ? `<li>First charge <strong>$9.90</strong> on <strong>${formatDate(meta.periodEnd)}</strong> (Sunday 12:00 AM), then weekly</li>`
      : '';
  const html = emailShell('Welcome to TeamShort VIP', `
    <h1 style="font-size:20px;margin:0 0 12px">Your VIP subscription is active</h1>
    <p>Thank you for subscribing. You confirmed recurring billing for:</p>
    <ul>
      <li><strong>${meta.planLabel}</strong></li>
      ${trialNote}
      <li>Automatic renewal until you cancel</li>
      <li>Current period ends: <strong>${endLabel}</strong></li>
    </ul>
    <p>You unlocked episodes 10+ on all dramas. You may cancel anytime from your account:</p>
    <p><a href="${vipUrl(env)}" style="display:inline-block;padding:10px 18px;background:#b56a38;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Manage VIP</a></p>
    <p style="font-size:13px;color:#555">By subscribing you agreed to our subscription terms and authorized recurring charges.</p>
  `, env);

  const result = await sendResend(env, {
    to,
    subject: 'TeamShort VIP — subscription confirmed',
    html,
  });
  if (result.sent) {
    await kv.put(dedupeKey, '1', { expirationTtl: 400 * 86400 });
  }
  return result;
}

export async function sendPaymentSuccessEmail(env, kv, userId, meta, invoiceId) {
  const dedupeKey = `emailsent:invoice:${invoiceId || meta.periodEnd || userId}`;
  if (invoiceId && (await kv.get(dedupeKey))) return { sent: false, reason: 'already sent' };

  const amount = meta.amountLabel || 'See your receipt';
  const endLabel = meta.periodEnd ? formatDate(meta.periodEnd) : '';
  const html = emailShell('Payment received', `
    <h1 style="font-size:20px;margin:0 0 12px">Payment received</h1>
    <p>We received your VIP subscription payment.</p>
    <ul>
      <li>Plan: <strong>${meta.planLabel}</strong></li>
      <li>Amount: <strong>${amount}</strong></li>
      ${endLabel ? `<li>Current period ends: <strong>${endLabel}</strong></li>` : ''}
    </ul>
    <p>You authorized this recurring subscription. To cancel future charges:</p>
    <p><a href="${vipUrl(env)}" style="display:inline-block;padding:10px 18px;background:#b56a38;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Cancel or manage subscription</a></p>
  `, env);

  const result = await sendResend(env, {
    to: meta.email,
    subject: `TeamShort VIP — payment received (${amount})`,
    html,
  });
  if (result.sent && invoiceId) {
    await kv.put(dedupeKey, '1', { expirationTtl: 120 * 86400 });
  }
  return result;
}

export async function sendPaymentFailedEmail(env, kv, userId, meta, invoiceId) {
  const dedupeKey = `emailsent:fail:${invoiceId || userId}`;
  if (invoiceId && (await kv.get(dedupeKey))) return { sent: false, reason: 'already sent' };

  const html = emailShell('Payment failed', `
    <h1 style="font-size:20px;margin:0 0 12px">We could not process your renewal</h1>
    <p>Your TeamShort VIP renewal payment did not go through.</p>
    <ul>
      <li>Plan: <strong>${meta.planLabel}</strong></li>
      <li>We may retry a limited number of times before your access is affected.</li>
    </ul>
    <p>Please update your payment method or contact support:</p>
    <p><a href="${vipUrl(env)}" style="display:inline-block;padding:10px 18px;background:#b56a38;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Manage subscription</a></p>
    <p style="font-size:13px;color:#555">Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> if you need help.</p>
  `, env);

  const result = await sendResend(env, {
    to: meta.email,
    subject: 'TeamShort VIP — payment failed, action needed',
    html,
  });
  if (result.sent && invoiceId) {
    await kv.put(dedupeKey, '1', { expirationTtl: 30 * 86400 });
  }
  return result;
}

export async function sendRenewalReminderEmail(env, kv, meta) {
  const periodKey = meta.periodEnd || 'unknown';
  const dedupeKey = `emailsent:remind:${meta.userId}:${periodKey}`;
  if (await kv.get(dedupeKey)) return { sent: false, reason: 'already sent' };

  const endLabel = formatDate(meta.periodEnd);
  const days = meta.interval === 'week' ? '2–3 days' : '7 days';
  const html = emailShell('Upcoming renewal', `
    <h1 style="font-size:20px;margin:0 0 12px">Your VIP plan renews soon</h1>
    <p>This is a reminder that your TeamShort VIP subscription will renew in about ${days}.</p>
    <ul>
      <li>Plan: <strong>${meta.planLabel}</strong></li>
      <li>Next billing date: <strong>${endLabel}</strong></li>
      <li>Your saved payment method will be charged automatically unless you cancel.</li>
    </ul>
    <p>You can cancel anytime before the renewal date:</p>
    <p><a href="${vipUrl(env)}" style="display:inline-block;padding:10px 18px;background:#b56a38;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Cancel subscription</a></p>
  `, env);

  const result = await sendResend(env, {
    to: meta.email,
    subject: `TeamShort VIP — renews on ${endLabel}`,
    html,
  });
  if (result.sent) {
    await kv.put(dedupeKey, '1', { expirationTtl: 45 * 86400 });
  }
  return result;
}

export async function sendCancelledEmail(env, kv, userId, meta) {
  const dedupeKey = `emailsent:cancel:${userId}:${meta.subscriptionId || 'sub'}`;
  if (await kv.get(dedupeKey)) return { sent: false, reason: 'already sent' };

  const endLabel = meta.periodEnd ? formatDate(meta.periodEnd) : 'the end of your current period';
  const html = emailShell('Subscription cancelled', `
    <h1 style="font-size:20px;margin:0 0 12px">Subscription cancelled</h1>
    <p>Your TeamShort VIP subscription has been cancelled. You will not be charged again.</p>
    <p>VIP access remains active until <strong>${endLabel}</strong>, unless otherwise required by law.</p>
    <p><a href="${vipUrl(env)}">View membership status</a></p>
  `, env);

  const result = await sendResend(env, {
    to: meta.email,
    subject: 'TeamShort VIP — subscription cancelled',
    html,
  });
  if (result.sent) {
    await kv.put(dedupeKey, '1', { expirationTtl: 120 * 86400 });
  }
  return result;
}

export async function persistSubMeta(kv, meta, ttlSeconds) {
  const ttl = Math.max(3600, ttlSeconds || 35 * 86400);
  await kv.put(`submeta:${meta.userId}`, JSON.stringify(meta), { expirationTtl: ttl });
}

export async function handleSubscriptionWebhookEmail(env, kv, eventName, data, userId, ttlSeconds) {
  const email = await resolveUserEmail(kv, userId, data);
  if (!email) return { skipped: true, reason: 'no email' };

  const meta = buildSubMeta(userId, email, data);
  await persistSubMeta(kv, meta, ttlSeconds);

  const welcomeEvents = new Set(['billing_checkout.completed', 'subscription.active', 'subscription.activated']);
  const paidEvents = new Set(['invoice.payment.paid', 'invoice.paid']);
  const failEvents = new Set([
    'invoice.payment.failed',
    'invoice.payment_failed',
    'invoice.failed',
    'subscription.unpaid',
  ]);
  const cancelEvents = new Set(['subscription.cancelled', 'subscription.canceled']);

  const invoiceId = String(data?.id ?? data?.invoice_id ?? '').trim();

  if (welcomeEvents.has(eventName)) {
    await sendWelcomeEmail(env, kv, userId, meta);
  }
  if (paidEvents.has(eventName)) {
    await sendPaymentSuccessEmail(env, kv, userId, meta, invoiceId);
  }
  if (failEvents.has(eventName)) {
    await sendPaymentFailedEmail(env, kv, userId, meta, invoiceId);
  }
  if (cancelEvents.has(eventName)) {
    await sendCancelledEmail(env, kv, userId, meta);
  }

  return { ok: true };
}

/** Daily cron: send renewal reminders for weekly (2–3d) and monthly (7d) plans */
export async function runRenewalReminders(env, kv) {
  const list = await kv.list({ prefix: 'submeta:' });
  const results = { checked: 0, sent: 0, skipped: 0, errors: 0 };
  const now = Date.now();

  for (const { name } of list.keys) {
    results.checked += 1;
    const raw = await kv.get(name);
    if (!raw) continue;
    let meta;
    try {
      meta = JSON.parse(raw);
    } catch {
      results.errors += 1;
      continue;
    }
    if (!meta?.email || !meta?.periodEnd || meta.cancelAtPeriodEnd) {
      results.skipped += 1;
      continue;
    }

    const msUntil = meta.periodEnd - now;
    if (msUntil <= 0) {
      results.skipped += 1;
      continue;
    }

    const daysUntil = msUntil / 86400000;
    const isWeek = meta.interval === 'week';
    const inWindow = isWeek
      ? daysUntil >= 2 && daysUntil <= 4
      : daysUntil >= 6.5 && daysUntil <= 8.5;

    if (!inWindow) {
      results.skipped += 1;
      continue;
    }

    const r = await sendRenewalReminderEmail(env, kv, meta);
    if (r.sent) results.sent += 1;
    else results.skipped += 1;
  }

  return results;
}
