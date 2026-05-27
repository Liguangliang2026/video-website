async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.code) {
    throw new Error(data.msg || `HTTP ${res.status}`);
  }
  return data;
}

export async function fetchPaymentConfig() {
  const res = await fetch('/api/payment/config');
  return parseJson(res);
}

export async function createPaymentCustomer({ userId, email, name }) {
  const res = await fetch('/api/payment/create-customer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, email, name }),
  });
  return parseJson(res);
}

export async function fetchMemberStatus(userId) {
  const res = await fetch('/api/member/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return res.json().catch(() => ({}));
}

/** 支付成功后从 Airwallex 拉取订阅并写入 KV（Webhook 未到时的兜底） */
export async function syncMemberAfterCheckout(userId) {
  const res = await fetch('/api/member/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return parseJson(res);
}

export async function createSubscribe(userId, planId, planKey) {
  const res = await fetch('/api/payment/create-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, plan_id: planId, plan_key: planKey }),
  });
  return parseJson(res);
}

export async function cancelSubscribe(userId) {
  const res = await fetch('/api/payment/cancel-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return parseJson(res);
}

/** 已有订阅时切换套餐（如周付 → 月付，立即生效） */
export async function changePlan(userId, planKey) {
  const res = await fetch('/api/payment/change-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, plan_key: planKey }),
  });
  return parseJson(res);
}
