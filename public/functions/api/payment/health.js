import { isAirwallexConfigured } from './airwallex.js';

/** GET — 检查支付环境是否就绪（不返回密钥内容） */
export async function onRequestGet(context) {
  const env = context.env;
  return Response.json({
    code: 200,
    airwallex: {
      configured: isAirwallexConfigured(env),
      hasClientId: Boolean(String(env.AIRWALLEX_CLIENT_ID ?? '').trim()),
      hasApiKey: Boolean(String(env.AIRWALLEX_API_KEY ?? '').trim()),
      hasWebhookSecret: Boolean(String(env.AIRWALLEX_WEBHOOK_SECRET ?? '').trim()),
      priceWeekly: Boolean(String(env.AIRWALLEX_PLAN_WEEKLY ?? '').trim()),
      priceMonthly: Boolean(String(env.AIRWALLEX_PLAN_MONTHLY ?? '').trim()),
    },
    kv: Boolean(env.USER_DB),
  });
}
