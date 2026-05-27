/**
 * Weekly VIP billing anchor: every Sunday 00:00:00 in BILLING_TIMEZONE (default US Eastern).
 * First charge at the next upcoming anchor; renewals align to weekly cycles from that anchor.
 */

const DEFAULT_TZ = 'America/New_York';

export function billingTimeZone(env) {
  return String(env.BILLING_TIMEZONE ?? DEFAULT_TZ).trim() || DEFAULT_TZ;
}

function ymdInTz(ms, timeZone) {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone });
}

function weekdayInTz(ms, timeZone) {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(new Date(ms));
}

function hourMinuteInTz(ms, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date(ms));
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return { hour, minute };
}

/** UTC ms for local YYYY-MM-DD 00:00:00 in timeZone */
export function utcMsForLocalMidnight(ymd, timeZone) {
  const [y, m, d] = ymd.split('-').map(Number);
  for (let hourUtc = -2; hourUtc <= 26; hourUtc += 1) {
    const t = Date.UTC(y, m - 1, d, hourUtc, 0, 0);
    if (ymdInTz(t, timeZone) !== ymd) continue;
    const { hour, minute } = hourMinuteInTz(t, timeZone);
    if (hour === 0 && minute === 0) return t;
  }
  return Date.UTC(y, m - 1, d, 16, 0, 0);
}

/** Next Sunday 00:00 strictly after `now` in timeZone */
export function nextSundayMidnightUtcMs(now = Date.now(), timeZone = DEFAULT_TZ) {
  for (let addDays = 0; addDays < 14; addDays += 1) {
    const probe = now + addDays * 86400000;
    if (weekdayInTz(probe, timeZone) !== 'Sunday') continue;
    const ymd = ymdInTz(probe, timeZone);
    const midnight = utcMsForLocalMidnight(ymd, timeZone);
    if (midnight > now) return midnight;
  }
  return now + 7 * 86400000;
}

/** Airwallex: +0800 / +0000 (no colon in offset) */
function tzOffsetCompact(ms, timeZone) {
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  }).format(new Date(ms));
  const m = label.match(/([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return '+0000';
  const sign = m[1];
  const h = String(Number(m[2])).padStart(2, '0');
  const min = m[3] ?? '00';
  return `${sign}${h}${min}`;
}

/** Airwallex: YYYY-MM-DDTHH:mm:ss+0800 (see API examples: 2023-02-01T00:00:00+0000) */
export function formatAirwallexTimestamp(ms, timeZone = DEFAULT_TZ) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(new Date(ms));

  const pick = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  let hour = pick('hour');
  if (hour === '24') hour = '00';
  const offset = tzOffsetCompact(ms, timeZone);
  return `${pick('year')}-${pick('month')}-${pick('day')}T${hour}:${pick('minute')}:${pick('second')}${offset}`;
}

/** Next Sunday 00:00 billing anchor (strictly in the future) */
export function nextSundayBillingAnchor(env, now = Date.now()) {
  const tz = billingTimeZone(env);
  const anchorMs = nextSundayMidnightUtcMs(now, tz);
  const anchorAt = formatAirwallexTimestamp(anchorMs, tz);
  return {
    anchorMs,
    anchorAt,
    trialEndsAt: anchorAt,
    trialEndsAtMs: anchorMs,
    billingCycleAnchorAt: anchorAt,
    timeZone: tz,
  };
}

/** @deprecated alias */
export function nextWeeklyBillingTrialEndsAt(env) {
  return nextSundayBillingAnchor(env);
}

export function formatBillingDate(ms, timeZone = DEFAULT_TZ) {
  return new Date(ms).toLocaleDateString('en-US', {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
