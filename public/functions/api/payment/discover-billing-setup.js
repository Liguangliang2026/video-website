import { airwallexApi, errorResponse, isAirwallexConfigured, jsonResponse } from './airwallex.js';

function pickIds(items) {
  const accounts = [];
  for (const item of items || []) {
    const id = String(item?.id ?? '').trim();
    if (!id.startsWith('acct_')) continue;
    accounts.push({
      id,
      nickname: item.nickname || null,
      status: item.status || null,
      legal_entity_id: item.account_details?.legal_entity_id
        || item.legal_entity_id
        || null,
    });
  }
  return accounts;
}

function accountFromDetails(data) {
  const id = String(data?.id ?? '').trim();
  if (!id.startsWith('acct_')) return null;
  return {
    id,
    nickname: data.nickname || data.business_name || null,
    status: data.status || null,
    legal_entity_id: data.legal_entity_id
      || data.account_details?.legal_entity_id
      || null,
    source: 'GET /api/v1/account',
  };
}

/**
 * GET — 查询本商户的 acct_ / le_（用于填写 wrangler.toml）
 */
export async function onRequestGet(context) {
  try {
    if (!isAirwallexConfigured(context.env)) {
      return jsonResponse({
        code: 503,
        msg: 'Configure AIRWALLEX_CLIENT_ID and AIRWALLEX_API_KEY first.',
      }, 503);
    }

    const sources = [];
    let accounts = [];

    const own = await airwallexApi(context.env, '/api/v1/account');
    if (own.ok) {
      const one = accountFromDetails(own.data);
      if (one) {
        accounts.push(one);
        sources.push({ endpoint: '/api/v1/account', ok: true });
      } else {
        sources.push({
          endpoint: '/api/v1/account',
          ok: true,
          note: 'Response OK but no acct_ id in body — check Airwallex dashboard.',
        });
      }
    } else {
      sources.push({
        endpoint: '/api/v1/account',
        ok: false,
        status: own.status,
        message: own.data?.message,
      });
    }

    if (!accounts.length) {
      const list = await airwallexApi(context.env, '/api/v1/accounts?page_size=20');
      if (list.ok) {
        accounts = pickIds(list.data.items);
        sources.push({
          endpoint: '/api/v1/accounts',
          ok: true,
          item_count: list.data?.items?.length ?? 0,
          note: 'Only platform accounts see connected acct_ list; empty is normal for direct merchants.',
        });
      } else {
        sources.push({
          endpoint: '/api/v1/accounts',
          ok: false,
          status: list.status,
          message: list.data?.message,
        });
      }
    }

    const legalEntityIds = [...new Set(accounts.map((a) => a.legal_entity_id).filter(Boolean))];
    const primary = accounts[0];

    return jsonResponse({
      code: 200,
      msg: primary
        ? 'Copy values below into wrangler.toml, then npm run deploy'
        : 'Could not auto-detect acct_. Use Airwallex Settings → Account details or contact support.',
      accounts,
      legal_entity_ids: legalEntityIds,
      sources,
      wrangler_example: {
        AIRWALLEX_LINKED_PAYMENT_ACCOUNT_ID: primary?.id || 'acct_xxx',
        AIRWALLEX_LEGAL_ENTITY_ID: legalEntityIds[0] || '',
      },
      manual_steps: [
        'Airwallex 网页 → 设置 (Settings) → 账户详情 (Account details)',
        '在 Account information / 账户信息 区域找 Account ID（acct_ 开头）',
        '或：Billing → 开发者/API 文档里创建 Checkout 的示例 JSON 中的 linked_payment_account_id',
        '填入 wrangler.toml 后执行 npm run deploy',
      ],
    });
  } catch (e) {
    return errorResponse(e, 'Failed to discover billing setup');
  }
}
