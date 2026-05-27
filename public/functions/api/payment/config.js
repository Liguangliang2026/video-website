import { jsonResponse } from '../auth/utils.js';
import { billingCheckoutIds } from './airwallex.js';
import {
  billingTimeZone,
  formatBillingDate,
  nextSundayBillingAnchor,
} from './billing-schedule.js';

export async function onRequestGet(context) {
  const siteBaseUrl = String(context.env.SITE_BASE_URL ?? 'https://teamshort.net').replace(/\/$/, '');
  const weekly = String(context.env.AIRWALLEX_PLAN_WEEKLY ?? '').trim();
  const monthly = String(context.env.AIRWALLEX_PLAN_MONTHLY ?? '').trim();
  const { legalEntityId, linkedPaymentAccountId } = billingCheckoutIds(context.env);
  const tz = billingTimeZone(context.env);
  const weeklyAnchor = nextSundayBillingAnchor(context.env);

  return jsonResponse({
    code: 200,
    siteBaseUrl,
    plans: {
      weekly,
      monthly,
    },
    weeklyBilling: {
      displayPrice: '$0.01',
      recurringPrice: '$9.9',
      noChargeOnSignup: true,
      billingAnchor: 'Every Sunday 12:00 AM',
      firstChargeAt: formatBillingDate(weeklyAnchor.anchorMs, tz),
      trialEndsAt: weeklyAnchor.trialEndsAt,
      timeZone: tz,
    },
    configured: Boolean((weekly || monthly) && linkedPaymentAccountId),
    billing: {
      legalEntityConfigured: Boolean(legalEntityId),
      linkedAccountConfigured: Boolean(linkedPaymentAccountId),
    },
  });
}
