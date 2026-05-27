/** Resolve weekly vs monthly from subscription metadata or price IDs */

export function configuredPlanIds(env) {
  return {
    weekly: String(env.AIRWALLEX_PLAN_WEEKLY ?? '').trim(),
    monthly: String(env.AIRWALLEX_PLAN_MONTHLY ?? '').trim(),
  };
}

export function priceIdFromSubscription(sub) {
  const items = sub?.items ?? sub?.subscription_items ?? [];
  for (const it of items) {
    const pid = String(it?.price_id ?? it?.price?.id ?? '').trim();
    if (pid) return pid;
  }
  return '';
}

export function resolvePlanKey(sub, env) {
  if (!sub || typeof sub !== 'object') return '';

  const meta = String(sub.metadata?.plan_key ?? '').trim().toLowerCase();
  if (meta === 'weekly' || meta === 'monthly') return meta;

  const { weekly, monthly } = configuredPlanIds(env);
  const priceId = priceIdFromSubscription(sub);
  if (priceId && weekly && priceId === weekly) return 'weekly';
  if (priceId && monthly && priceId === monthly) return 'monthly';

  const unit = String(sub.recurring?.period_unit ?? '').toUpperCase();
  if (unit === 'WEEK') return 'weekly';
  if (unit === 'MONTH') return 'monthly';

  return '';
}

export function targetPriceId(env, planKey) {
  const key = String(planKey ?? '').trim().toLowerCase();
  const ids = configuredPlanIds(env);
  return ids[key] ?? '';
}
