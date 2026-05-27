// MD5（与对接文档「拼接后 md5」一致，UTF-8 字节参与摘要）
export async function md5(str) {
  const utf8 = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('MD5', utf8);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 参与签名的 value 与最终 query 中 value 使用同一规则 */
function signParamStringValue(v) {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '';
    return String(Math.trunc(v));
  }
  return String(v).trim();
}

/**
 * 文档：非空参数按参数名字典序拼接，再 &app_secret=…，再 md5。sign 不参与。
 */
export async function makeSign(params, appSecret) {
  const secret = String(appSecret ?? '').trim();
  const valid = {};
  for (const k of Object.keys(params)) {
    if (k === 'sign') continue;
    const raw = params[k];
    if (raw == null || raw === '') continue;
    const val = signParamStringValue(raw);
    if (val === '') continue;
    valid[k] = val;
  }
  const keys = Object.keys(valid).sort();
  const str = `${keys.map((k) => `${k}=${valid[k]}`).join('&')}&app_secret=${secret}`;
  return await md5(str);
}

export async function aesDecrypt(encryptedBase64, keyStr, ivStr) {
  const key = new TextEncoder().encode(keyStr);
  const iv = new TextEncoder().encode(ivStr);
  const encrypted = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    await crypto.subtle.importKey('raw', key, 'AES-CBC', false, ['decrypt']),
    encrypted
  );
  return new TextDecoder('utf-8').decode(decrypted);
}

/** 请求公共参数 timestamp：秒级 Unix，须接近剧星服务器时间；不可用写死常量 */
export async function getServerTimestamp(_apiBaseUrl) {
  return Math.floor(Date.now() / 1000);
}

/**
 * 播放签名到期相对「本次请求 timestamp」的秒偏移。勿超过 3 天；默认 1 天与文档「不传默认 +1 天」一致。
 * 可用 Cloudflare 变量 DRAMA_EXPIRE_OFFSET_SEC 覆盖（整数秒，≤259200）。
 */
export const DRAMA_PLAYBACK_EXPIRE_OFFSET_SEC = 86400;

export function dramaPlaybackExpireFromNow(nowSec = Math.floor(Date.now() / 1000)) {
  return nowSec + DRAMA_PLAYBACK_EXPIRE_OFFSET_SEC;
}

/**
 * 组装剧星 GET query（含 sign），并校验 env。
 */
export async function makeSignedDramaQuery(env, extraFields = {}) {
  const appId = String(env.DRAMA_APP_ID ?? '').trim();
  const appSecret = String(env.DRAMA_APP_SECRET ?? '').trim();
  const base = String(env.DRAMA_BASE_URL ?? '').trim().replace(/\/$/, '');

  if (!appId || !appSecret || !base) {
    return {
      error: Response.json(
        {
          code: -1,
          msg: 'Server misconfiguration: set DRAMA_APP_ID, DRAMA_APP_SECRET, DRAMA_BASE_URL'
        },
        { status: 500 }
      )
    };
  }

  const ts = await getServerTimestamp(base);
  const signInput = {
    ...extraFields,
    app_id: appId,
    timestamp: ts
  };

  // expire_time 必须与参与签名的 timestamp 同源，否则剧星可能报 10028
  if (
    Object.prototype.hasOwnProperty.call(signInput, 'expire_time') &&
    signInput.expire_time != null &&
    signInput.expire_time !== ''
  ) {
    const rawOff = Number(env.DRAMA_EXPIRE_OFFSET_SEC);
    const off =
      Number.isFinite(rawOff) && rawOff > 0 && rawOff <= 3 * 86400
        ? Math.floor(rawOff)
        : DRAMA_PLAYBACK_EXPIRE_OFFSET_SEC;
    signInput.expire_time = ts + off;
  }

  const sign = await makeSign(signInput, appSecret);

  const usp = new URLSearchParams();
  for (const key of Object.keys(signInput).sort()) {
    const v = signInput[key];
    if (v == null || v === '') continue;
    usp.append(key, signParamStringValue(v));
  }
  usp.append('sign', sign);

  return { base, queryString: usp.toString() };
}

/** 是否在剧星请求中省略 expire_time（环境变量 1 / true / yes） */
export function dramaSkipExpireTime(env) {
  const v = String(env.DRAMA_SKIP_EXPIRE_TIME ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
