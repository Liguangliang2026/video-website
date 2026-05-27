<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import {
  fetchPaymentConfig,
  createSubscribe,
  cancelSubscribe,
  changePlan,
  fetchMemberStatus,
} from '../api/payment';
import { useVip } from '../composables/useVip';
import { useAccount } from '../composables/useAccount';
import '../assets/player.css';

const PLAN_CATALOG = [
  {
    key: 'weekly',
    title: 'Weekly',
    displayPrice: '$0.01',
    period: '/ week',
    note: 'Subscribe now · no charge today',
  },
  {
    key: 'monthly',
    title: 'Monthly',
    displayPrice: '$29.9',
    period: '/ month',
    note: 'Best value · save vs weekly',
    badge: 'Popular',
  },
];

const route = useRoute();
const router = useRouter();
const { syncMemberFromServer, isMember } = useVip();
const { isSignedIn, userId, openModal, afterSignIn } = useAccount();

const plans = ref({ weekly: '', monthly: '' });
const plansReady = ref(false);
const selectedPlan = ref('weekly');
const statusText = ref('');
const payError = ref('');
const loading = ref(false);
const cancelLoading = ref(false);
const switchPlanLoading = ref(false);
const consentAccepted = ref(false);
const memberExpireAt = ref(null);
const currentPlanKey = ref('');
const canUpgradeToMonthly = ref(false);

const returnStatus = computed(() => String(route.query.status ?? '').trim().toLowerCase());
const memberActive = computed(() => isSignedIn.value && isMember());
/** 月付用户始终走会员面板，不展示周付订阅/切换 */
const isMonthlySubscriber = computed(() => currentPlanKey.value === 'monthly');
const showMemberPanel = computed(
  () => memberActive.value || (isSignedIn.value && isMonthlySubscriber.value),
);
const subscribePlanCatalog = computed(() =>
  PLAN_CATALOG.filter((p) => !isMonthlySubscriber.value || p.key !== 'weekly'),
);

const selectedPlanMeta = computed(
  () => PLAN_CATALOG.find((p) => p.key === selectedPlan.value) ?? PLAN_CATALOG[1],
);

const selectedPlanConfigured = computed(() => Boolean(plans.value[selectedPlan.value]));

const anyPlanConfigured = computed(() =>
  PLAN_CATALOG.some((p) => Boolean(plans.value[p.key])),
);

const subscribePriceLabel = computed(() => {
  const p = selectedPlanMeta.value;
  return p.displayPrice ?? p.price ?? '';
});

const renewalDisclosure = computed(() => {
  const p = selectedPlanMeta.value;
  if (p.key === 'weekly') {
    return 'Subscribe for $0.01 today with no charge. Billing runs on a fixed schedule: every Sunday at 12:00 AM (US Eastern), until you cancel.';
  }
  return `You will be charged ${p.displayPrice || '$29.9'} every month. Your payment method will be charged automatically each month until you cancel.`;
});

const showMonthlyUpgrade = computed(() => memberActive.value && canUpgradeToMonthly.value);

const memberPlanLabel = computed(() => {
  if (currentPlanKey.value === 'weekly') return 'Weekly · $0.01 intro';
  if (currentPlanKey.value === 'monthly') return 'Monthly · $29.9';
  return '';
});

const memberExpireLabel = computed(() => {
  if (!memberExpireAt.value) return '';
  const d = new Date(memberExpireAt.value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
});

const canSubscribe = computed(
  () =>
    consentAccepted.value
    && (!isSignedIn.value || !plansReady.value || selectedPlanConfigured.value),
);

function goBack() {
  const from = String(route.query.from ?? '').trim();
  if (from && from.startsWith('/') && !from.startsWith('//')) {
    router.push(from);
    return;
  }
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push('/');
}

function ensureMonthlyPlanSelected() {
  if (isMonthlySubscriber.value && selectedPlan.value === 'weekly') {
    selectedPlan.value = 'monthly';
  }
}

function pickPlan(key) {
  if (isMonthlySubscriber.value && key === 'weekly') return;
  if (plans.value[key]) {
    selectedPlan.value = key;
  }
}

async function loadPlans() {
  try {
    const res = await fetchPaymentConfig();
    if (res.code === 200) {
      plans.value = {
        weekly: res.plans?.weekly ?? '',
        monthly: res.plans?.monthly ?? '',
      };
      if (!plans.value[selectedPlan.value]) {
        const fallback = PLAN_CATALOG.find((p) => plans.value[p.key]);
        if (fallback) selectedPlan.value = fallback.key;
      }
    }
  } catch {
    plans.value = { weekly: '', monthly: '' };
  } finally {
    plansReady.value = true;
  }
}

async function refreshMember() {
  memberExpireAt.value = null;
  currentPlanKey.value = '';
  canUpgradeToMonthly.value = false;
  if (!isSignedIn.value || !userId.value) {
    statusText.value = '';
    return;
  }
  const active = await syncMemberFromServer(userId.value);
  try {
    const res = await fetchMemberStatus(userId.value);
    if (res.expireAt) memberExpireAt.value = res.expireAt;
    if (res.currentPlanKey) currentPlanKey.value = res.currentPlanKey;
    canUpgradeToMonthly.value = Boolean(res.canUpgradeToMonthly);
  } catch {
    /* optional */
  }
  if (currentPlanKey.value === 'monthly') {
    canUpgradeToMonthly.value = false;
    selectedPlan.value = 'monthly';
  }
  ensureMonthlyPlanSelected();
  if (active) {
    statusText.value = 'You are a VIP member. All episodes are unlocked.';
  } else if (returnStatus.value === 'success') {
    statusText.value = 'Payment received. Membership may take a moment to activate.';
  } else {
    statusText.value = '';
  }
}

async function switchToMonthly() {
  if (!userId.value || switchPlanLoading.value) return;
  const ok = window.confirm(
    'Switch to Monthly ($29.9/month)? Your saved payment method will be charged now. '
      + 'Future renewals will be monthly until you cancel.',
  );
  if (!ok) return;

  switchPlanLoading.value = true;
  payError.value = '';
  try {
    const res = await changePlan(userId.value, 'monthly');
    if (res.code !== 200) {
      payError.value = res.msg || 'Could not switch to monthly plan';
      return;
    }
    currentPlanKey.value = 'monthly';
    canUpgradeToMonthly.value = false;
    statusText.value = res.msg || 'You are now on the monthly plan.';
    await refreshMember();
  } catch (e) {
    payError.value = e?.message || 'Plan switch failed';
  } finally {
    switchPlanLoading.value = false;
  }
}

async function cancelMembership() {
  if (!userId.value || cancelLoading.value) return;
  const ok = window.confirm(
    'Cancel your VIP subscription? You will not be charged again. Access continues until the end of the current billing period.',
  );
  if (!ok) return;

  cancelLoading.value = true;
  payError.value = '';
  try {
    const res = await cancelSubscribe(userId.value);
    if (res.code !== 200) {
      payError.value = res.msg || 'Could not cancel subscription';
      return;
    }
    statusText.value = res.msg || 'Subscription cancelled. You keep access until the current period ends.';
    await refreshMember();
  } catch (e) {
    payError.value = e?.message || 'Cancellation failed';
  } finally {
    cancelLoading.value = false;
  }
}

async function subscribe() {
  payError.value = '';
  if (isMonthlySubscriber.value) {
    payError.value = 'You are on the monthly plan. Plan changes to weekly are not available.';
    return;
  }
  if (!consentAccepted.value) {
    payError.value = 'Please confirm the subscription terms before continuing.';
    return;
  }
  if (!isSignedIn.value) {
    openModal();
    return;
  }
  const planKey = selectedPlan.value;
  const planId = plans.value[planKey];
  if (!planId) {
    payError.value = `Plan is not configured. Set AIRWALLEX_PLAN_${planKey.toUpperCase()} in wrangler.toml.`;
    return;
  }

  loading.value = true;
  try {
    await afterSignIn();
    const res = await createSubscribe(userId.value, planId, planKey);
    if (res.code !== 200 || !res.checkout_url) {
      const detail = res.detail?.message || res.detail?.code;
      payError.value = [res.msg, detail].filter(Boolean).join(' — ') || 'Could not start checkout';
      return;
    }
    window.location.href = res.checkout_url;
  } catch (e) {
    payError.value = e?.message || 'Checkout failed';
  } finally {
    loading.value = false;
  }
}

async function pollMemberAfterPayment(maxAttempts = 15) {
  if (!userId.value || returnStatus.value !== 'success') return;
  statusText.value = 'Payment received. Activating membership…';
  for (let i = 0; i < maxAttempts; i += 1) {
    const trySync = i === 0 || i % 3 === 0;
    if (await syncMemberFromServer(userId.value, { tryAirwallexSync: trySync })) {
      statusText.value = 'You are a VIP member. All episodes are unlocked.';
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  statusText.value = 'Payment received. Membership may take a moment to activate — refresh shortly.';
}

onMounted(async () => {
  await loadPlans();
  await refreshMember();
  if (returnStatus.value === 'success') {
    void pollMemberAfterPayment();
  }
});

watch(selectedPlan, () => {
  consentAccepted.value = false;
});

watch(userId, () => void refreshMember());
watch(currentPlanKey, () => ensureMonthlyPlanSelected());
watch(
  () => route.query.status,
  (status) => {
    void refreshMember();
    if (String(status ?? '').toLowerCase() === 'success') {
      void pollMemberAfterPayment();
    }
  },
);
</script>

<template>
  <main class="watch-page vip-page">
    <header class="watch-topbar">
      <button type="button" class="watch-top-link" aria-label="Back" @click="goBack">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <div class="watch-chip">
        <span class="watch-chip__dot" aria-hidden="true" />
        VIP
      </div>
    </header>

    <div class="watch-page__body vip-page__body">
      <header class="vip-page__header">
        <h1 class="vip-page__title">VIP Membership</h1>
        <p class="vip-page__lead">
          Episodes 10 and later require VIP. Pick a plan to unlock every series on TeamShort.
        </p>
      </header>

      <p
        v-if="statusText"
        class="vip-page__status"
        :class="{ 'vip-page__status--success': showMemberPanel }"
      >
        {{ statusText }}
      </p>
      <p v-if="payError" class="vip-page__error" role="alert">{{ payError }}</p>

      <article v-if="showMemberPanel" class="vip-active-card">
        <span class="vip-active-card__badge">Active</span>
        <h2 class="vip-active-card__title">You're a VIP member</h2>
        <p class="vip-active-card__note">
          All episodes unlocked · 1080p streaming
          <template v-if="memberPlanLabel"> · {{ memberPlanLabel }}</template>
          <template v-if="memberExpireLabel"> · Renews / ends {{ memberExpireLabel }}</template>
        </p>
        <ul class="vip-perks">
          <li class="vip-perks__item">
            <span class="vip-perks__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M8 10h8M8 14h5" />
              </svg>
            </span>
            Unlimited viewing
          </li>
          <li class="vip-perks__item">
            <span class="vip-perks__hq" aria-hidden="true">1080</span>
            1080p high quality
          </li>
        </ul>
        <section v-if="showMonthlyUpgrade" class="vip-upgrade">
          <div class="vip-upgrade__head">
            <span class="vip-upgrade__badge">Upgrade</span>
            <h3 class="vip-upgrade__title">Switch to Monthly</h3>
          </div>
          <p class="vip-upgrade__price">
            <span class="vip-upgrade__amount">$29.988</span>
            <span class="vip-upgrade__period">/ month</span>
          </p>
          <p class="vip-upgrade__note">
            Takes effect immediately. Your card is charged now; future renewals follow the monthly plan until you cancel.
          </p>
          <button
            type="button"
            class="vip-upgrade__btn"
            :disabled="switchPlanLoading"
            @click="switchToMonthly"
          >
            {{ switchPlanLoading ? 'Switching…' : 'Switch to monthly · $29.9' }}
          </button>
        </section>

        <div class="vip-manage">
          <p class="vip-manage__hint">
            Cancel anytime online. No phone call required.
          </p>
          <button
            type="button"
            class="vip-manage__cancel"
            :disabled="cancelLoading"
            @click="cancelMembership"
          >
            {{ cancelLoading ? 'Cancelling…' : 'Cancel subscription' }}
          </button>
          <p class="vip-manage__support">
            Need help?
            <a href="mailto:support@teamshort.net">support@teamshort.net</a>
          </p>
        </div>
      </article>

      <template v-else>
        <div class="vip-plans" role="radiogroup" aria-label="Choose a VIP plan">
          <button
            v-for="plan in subscribePlanCatalog"
            :key="plan.key"
            type="button"
            class="vip-plan"
            :class="{
              'vip-plan--selected': selectedPlan === plan.key,
              'vip-plan--disabled': plansReady && !plans[plan.key],
            }"
            role="radio"
            :aria-checked="selectedPlan === plan.key"
            :disabled="plansReady && !plans[plan.key]"
            @click="pickPlan(plan.key)"
          >
            <span v-if="plan.badge" class="vip-plan__badge">{{ plan.badge }}</span>
            <span class="vip-plan__title">{{ plan.title }}</span>
            <span class="vip-plan__price-row">
              <span class="vip-plan__price">{{ plan.displayPrice ?? plan.price }}</span>
              <span class="vip-plan__period">{{ plan.period }}</span>
            </span>
            <span class="vip-plan__note">{{ plan.note }}</span>
            <span
              class="vip-plan__check"
              :class="{ 'vip-plan__check--on': selectedPlan === plan.key }"
              aria-hidden="true"
            >
              <svg
                v-if="selectedPlan === plan.key"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <path d="M5 12l5 5L20 7" />
              </svg>
            </span>
          </button>
        </div>

        <ul class="vip-perks vip-perks--panel">
          <li class="vip-perks__item">
            <span class="vip-perks__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M8 10h8M8 14h5" />
              </svg>
            </span>
            Unlimited viewing on all dramas
          </li>
          <li class="vip-perks__item">
            <span class="vip-perks__hq" aria-hidden="true">1080</span>
            1080p high quality streaming
          </li>
          <li class="vip-perks__item">
            <span class="vip-perks__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </span>
            Cancel anytime from your account
          </li>
        </ul>

        <section class="vip-disclosure" aria-labelledby="vip-disclosure-title">
          <h2 id="vip-disclosure-title" class="vip-disclosure__title">Before you subscribe</h2>
          <p class="vip-disclosure__text">{{ renewalDisclosure }}</p>
          <ul class="vip-disclosure__list">
            <li v-if="selectedPlanMeta.key === 'weekly'">
              Today: <strong>$0.01 · no charge</strong>
            </li>
            <li v-else>
              Recurring: <strong>{{ subscribePriceLabel }}{{ selectedPlanMeta.period }}</strong>
            </li>
            <li v-if="selectedPlanMeta.key === 'weekly'">
              Billing time: <strong>every Sunday 12:00 AM (US Eastern)</strong>
            </li>
            <li v-else>Auto-renew monthly until you cancel</li>
            <li>Cancel anytime from your account</li>
            <li>
              <RouterLink to="/legal/subscription" class="vip-page__link">Full subscription terms</RouterLink>
            </li>
          </ul>
        </section>

        <label class="vip-consent">
          <input
            v-model="consentAccepted"
            type="checkbox"
            class="vip-consent__input"
          />
          <span class="vip-consent__box" aria-hidden="true" />
          <span class="vip-consent__label">
            I agree to the
            <RouterLink to="/legal/subscription" class="vip-page__link" @click.stop>Subscription Terms</RouterLink>
            and authorize TeamShort to charge my payment method automatically for this recurring subscription until I cancel.
          </span>
        </label>

        <button
          type="button"
          class="vip-page__subscribe"
          :disabled="loading || !canSubscribe"
          @click="subscribe"
        >
          <span v-if="loading">Opening checkout…</span>
          <span v-else-if="!isSignedIn">Sign in &amp; subscribe · {{ subscribePriceLabel }}</span>
          <span v-else-if="selectedPlanMeta.key === 'weekly'">Subscribe · no charge today</span>
          <span v-else>Subscribe · {{ selectedPlanMeta.title }} {{ subscribePriceLabel }}</span>
        </button>

        <p v-if="!isSignedIn" class="vip-page__foot">
          Already have an account?
          <button type="button" class="vip-page__link" @click="openModal">Sign in</button>
        </p>
        <p v-else-if="plansReady && !anyPlanConfigured" class="vip-page__foot vip-page__foot--warn">
          Payment plans are not configured yet.
        </p>
        <p v-else class="vip-page__foot">
          Support:
          <a href="mailto:support@teamshort.net" class="vip-page__link">support@teamshort.net</a>
        </p>
      </template>

      <RouterLink v-if="showMemberPanel" class="vip-page__subscribe vip-page__subscribe--ghost" to="/">
        Browse dramas
      </RouterLink>
    </div>
  </main>
</template>

<style scoped>
.vip-page__body {
  max-width: 32rem;
  padding-top: 0.5rem;
}

.vip-page__header {
  margin-bottom: 1.25rem;
}

.vip-page__title {
  margin: 0 0 0.5rem;
  font-family: "Syne", sans-serif;
  font-size: clamp(1.5rem, 5vw, 1.85rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #f4f4f8;
}

.vip-page__lead {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.65;
  color: rgba(245, 249, 255, 0.72);
}

.vip-page__status {
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.88rem;
  line-height: 1.5;
  color: rgba(245, 249, 255, 0.85);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--watch-line);
}

.vip-page__status--success {
  color: #b8e8ff;
  border-color: rgba(46, 166, 255, 0.35);
  background: rgba(46, 166, 255, 0.12);
}

.vip-page__error {
  margin: 0 0 1rem;
  font-size: 0.88rem;
  color: #ff9a8a;
}

/* Plan picker */
.vip-plans {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.vip-plan {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  padding: 1rem 0.85rem 0.9rem;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  color: #f4f4f8;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.22s ease,
    background 0.22s ease,
    box-shadow 0.22s ease,
    transform 0.18s ease;
}

.vip-plan:hover:not(:disabled):not(.vip-plan--selected) {
  border-color: rgba(232, 196, 154, 0.35);
  background: rgba(255, 248, 238, 0.05);
}

.vip-plan--selected {
  border-color: #e8c49a;
  background: linear-gradient(145deg, #fff8ee 0%, #ffe8cf 55%, #ffd4a8 100%);
  box-shadow:
    0 10px 28px rgba(0, 0, 0, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
  transform: translateY(-1px);
}

.vip-plan--selected .vip-plan__title {
  color: rgba(74, 44, 42, 0.75);
}

.vip-plan--selected .vip-plan__price {
  color: #4a2c2a;
  font-size: clamp(1rem, 3.8vw, 1.15rem);
}

.vip-plan--selected .vip-plan__period,
.vip-plan--selected .vip-plan__note {
  color: rgba(74, 44, 42, 0.62);
}

.vip-plan--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.vip-plan__badge {
  position: absolute;
  top: -0.45rem;
  right: 0.65rem;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #4a2c2a;
  background: linear-gradient(105deg, #ffe8cf, #ffd4a8);
}

.vip-plan__title {
  font-size: 0.82rem;
  font-weight: 600;
  color: rgba(245, 249, 255, 0.75);
}

.vip-plan__price-row {
  display: flex;
  align-items: baseline;
  gap: 0.2rem;
  margin-top: 0.15rem;
}

.vip-plan__price {
  font-size: clamp(1.05rem, 4vw, 1.25rem);
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.1;
  color: #fffaf3;
}

.vip-plan__period {
  font-size: 0.72rem;
  font-weight: 500;
  color: rgba(245, 249, 255, 0.5);
}

.vip-plan__note {
  font-size: 0.68rem;
  line-height: 1.35;
  color: rgba(245, 249, 255, 0.45);
}

.vip-plan__check {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  display: grid;
  place-items: center;
  width: 1.45rem;
  height: 1.45rem;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  color: transparent;
  transition:
    background 0.22s ease,
    border-color 0.22s ease,
    color 0.22s ease,
    box-shadow 0.22s ease;
}

.vip-plan__check--on {
  border-color: #8f4f2c;
  background: linear-gradient(145deg, #d4925a 0%, #b56a38 100%);
  color: #fffaf3;
  box-shadow: 0 2px 8px rgba(74, 44, 42, 0.35);
}

/* Shared perks */
.vip-perks {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.vip-perks--panel {
  padding: 0.85rem 1rem;
  margin-bottom: 0.25rem;
  border-radius: 12px;
  background: rgba(255, 248, 238, 0.06);
  border: 1px solid rgba(255, 220, 180, 0.12);
}

.vip-perks__item {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.82rem;
  font-weight: 500;
  color: rgba(245, 249, 255, 0.82);
}

.vip-perks__icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: #e8c49a;
}

.vip-perks__hq {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 1.65rem;
  height: 1.15rem;
  border-radius: 4px;
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #e8c49a;
  background: rgba(232, 196, 154, 0.15);
  border: 1px solid rgba(232, 196, 154, 0.28);
}

/* Active member card */
.vip-active-card {
  position: relative;
  padding: 1.35rem 1.25rem;
  border-radius: 14px;
  background: linear-gradient(105deg, #fff8ee 0%, #ffe8cf 52%, #ffd4a8 100%);
  color: #4a2c2a;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.38);
}

.vip-active-card__badge {
  display: inline-block;
  margin-bottom: 0.5rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #fffaf3;
  background: #8f4f2c;
}

.vip-active-card__title {
  margin: 0 0 0.35rem;
  font-family: "Syne", sans-serif;
  font-size: 1.25rem;
  font-weight: 800;
}

.vip-active-card__note {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  color: rgba(74, 44, 42, 0.72);
}

.vip-active-card .vip-perks__item {
  color: #4a2c2a;
}

.vip-active-card .vip-perks__icon {
  color: #5c3d38;
}

.vip-active-card .vip-perks__hq {
  color: #4a2c2a;
  background: rgba(74, 44, 42, 0.12);
  border-color: rgba(74, 44, 42, 0.22);
}

.vip-upgrade {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(74, 44, 42, 0.18);
}

.vip-upgrade__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.vip-upgrade__badge {
  display: inline-block;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #fffaf3;
  background: var(--accent, #ff6b35);
}

.vip-upgrade__title {
  margin: 0;
  font-family: "Syne", sans-serif;
  font-size: 1rem;
  font-weight: 800;
  color: #4a2c2a;
}

.vip-upgrade__price {
  margin: 0 0 0.35rem;
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.vip-upgrade__amount {
  font-size: 1.45rem;
  font-weight: 800;
  color: #4a2c2a;
}

.vip-upgrade__period {
  font-size: 0.88rem;
  color: rgba(74, 44, 42, 0.72);
}

.vip-upgrade__note {
  margin: 0 0 0.75rem;
  font-size: 0.78rem;
  line-height: 1.45;
  color: rgba(74, 44, 42, 0.72);
}

.vip-upgrade__btn {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 10px;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--accent, #ff6b35), var(--accent2, #ff8f4a));
  box-shadow: 0 8px 20px rgba(255, 107, 53, 0.28);
  cursor: pointer;
  transition: filter 0.18s, transform 0.18s;
}

.vip-upgrade__btn:hover:not(:disabled) {
  filter: brightness(1.06);
  transform: translateY(-1px);
}

.vip-upgrade__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.vip-manage {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(74, 44, 42, 0.15);
}

.vip-manage__hint {
  margin: 0 0 0.65rem;
  font-size: 0.8rem;
  color: rgba(74, 44, 42, 0.72);
}

.vip-manage__cancel {
  display: block;
  width: 100%;
  padding: 0.7rem 1rem;
  border: 1px solid rgba(74, 44, 42, 0.28);
  border-radius: 10px;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  color: #4a2c2a;
  background: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s;
}

.vip-manage__cancel:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.7);
  border-color: rgba(74, 44, 42, 0.4);
}

.vip-manage__cancel:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.vip-manage__support {
  margin: 0.65rem 0 0;
  font-size: 0.78rem;
  color: rgba(74, 44, 42, 0.65);
}

.vip-manage__support a {
  color: #6b3f2a;
  font-weight: 600;
}

.vip-disclosure {
  margin: 1rem 0 0.85rem;
  padding: 0.9rem 1rem;
  border-radius: 12px;
  background: rgba(255, 248, 238, 0.06);
  border: 1px solid rgba(255, 220, 180, 0.18);
}

.vip-disclosure__title {
  margin: 0 0 0.5rem;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #e8c49a;
}

.vip-disclosure__text {
  margin: 0 0 0.55rem;
  font-size: 0.84rem;
  line-height: 1.55;
  color: rgba(245, 249, 255, 0.82);
}

.vip-disclosure__list {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.8rem;
  line-height: 1.5;
  color: rgba(245, 249, 255, 0.65);
}

.vip-disclosure__list strong {
  color: #f4f4f8;
}

.vip-consent {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  margin-bottom: 0.25rem;
  cursor: pointer;
  user-select: none;
}

.vip-consent__input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.vip-consent__box {
  flex-shrink: 0;
  width: 1.15rem;
  height: 1.15rem;
  margin-top: 0.12rem;
  border-radius: 4px;
  border: 2px solid rgba(232, 196, 154, 0.55);
  background: transparent;
  transition: background 0.18s, border-color 0.18s;
}

.vip-consent__input:checked + .vip-consent__box {
  border-color: #e8c49a;
  background: linear-gradient(145deg, #d4925a, #b56a38);
  box-shadow: inset 0 0 0 2px #fffaf3;
}

.vip-consent__input:focus-visible + .vip-consent__box {
  outline: 2px solid #e8c49a;
  outline-offset: 2px;
}

.vip-consent__label {
  font-size: 0.8rem;
  line-height: 1.5;
  color: rgba(245, 249, 255, 0.72);
}

.vip-page__subscribe {
  display: block;
  width: 100%;
  margin-top: 1rem;
  padding: 0.95rem 1.1rem;
  border: 1px solid rgba(255, 220, 180, 0.22);
  border-radius: 12px;
  font: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  text-align: center;
  text-decoration: none;
  color: #fffaf3;
  cursor: pointer;
  background: linear-gradient(180deg, #d4925a 0%, #b56a38 52%, #8f4f2c 100%);
  box-shadow:
    0 10px 24px rgba(0, 0, 0, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
  transition: transform 0.18s, box-shadow 0.18s, opacity 0.18s, filter 0.18s;
}

.vip-page__subscribe:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.06);
  box-shadow:
    0 14px 30px rgba(0, 0, 0, 0.38),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);
}

.vip-page__subscribe:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.vip-page__subscribe--ghost {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--watch-line);
  box-shadow: none;
  color: #f4f4f8;
}

.vip-page__foot {
  margin: 0.85rem 0 0;
  font-size: 0.82rem;
  text-align: center;
  color: rgba(245, 249, 255, 0.5);
}

.vip-page__foot--warn {
  color: #ff9a8a;
}

.vip-page__link {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-weight: 600;
  color: #e8c49a;
  cursor: pointer;
}

.vip-page__link:hover {
  color: #f5dcc0;
}

button.watch-top-link {
  cursor: pointer;
  font: inherit;
  appearance: none;
}

@media (max-width: 360px) {
  .vip-plans {
    grid-template-columns: 1fr;
  }
}
</style>
