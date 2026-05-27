import { objPeriodEnd } from '../payment/member-kv.js';
import { resolvePlanKey } from '../payment/plan-utils.js';

/** POST — 查询会员状态 */
export async function onRequestPost(context) {
  const { userId } = await context.request.json().catch(() => ({}));
  const uid = String(userId ?? '').trim();
  if (!uid) {
    return Response.json({ code: 400, msg: 'userId is required', isMember: false }, { status: 400 });
  }

  const status = await context.env.USER_DB.get(`member:${uid}`);
  const subStr = await context.env.USER_DB.get(`sub:${uid}`);
  let expireAt = null;
  let currentPlanKey = '';
  let cancelAtPeriodEnd = false;
  if (subStr) {
    try {
      const sub = JSON.parse(subStr);
      const end = objPeriodEnd(sub);
      if (end) expireAt = new Date(end).toISOString();
      currentPlanKey = resolvePlanKey(sub, context.env);
      cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);
    } catch {
      /* ignore */
    }
  }

  const { weekly, monthly } = {
    weekly: String(context.env.AIRWALLEX_PLAN_WEEKLY ?? '').trim(),
    monthly: String(context.env.AIRWALLEX_PLAN_MONTHLY ?? '').trim(),
  };

  return Response.json({
    code: 200,
    isMember: status === 'active',
    expireAt,
    currentPlanKey,
    cancelAtPeriodEnd,
    canUpgradeToMonthly: status === 'active' && currentPlanKey !== 'monthly' && Boolean(monthly),
    plans: { weekly, monthly },
  });
}
