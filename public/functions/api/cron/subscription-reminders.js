import { runRenewalReminders } from '../payment/subscription-mail.js';

function authorizeCron(request, env) {
  const secret = String(env.CRON_SECRET ?? '').trim();
  if (!secret) return false;
  const auth = request.headers.get('Authorization') || '';
  if (auth === `Bearer ${secret}`) return true;
  if (request.headers.get('x-cron-secret') === secret) return true;
  return new URL(request.url).searchParams.get('secret') === secret;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!authorizeCron(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!env.USER_DB) {
    return Response.json({ code: 500, msg: 'USER_DB not configured' }, { status: 500 });
  }

  const results = await runRenewalReminders(env, env.USER_DB);
  return Response.json({ code: 200, ...results });
}

export async function onRequestPost(context) {
  return onRequestGet(context);
}
