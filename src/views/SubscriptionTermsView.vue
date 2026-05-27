<script setup>
import { RouterLink } from 'vue-router';
import '../assets/player.css';
</script>

<template>
  <main class="watch-page legal-page">
    <header class="watch-topbar">
      <RouterLink class="watch-top-link" to="/vip" aria-label="Back to VIP">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </RouterLink>
      <div class="watch-chip">Legal</div>
    </header>

    <article class="legal-page__body">
      <h1>Subscription Terms</h1>
      <p class="legal-page__updated">Last updated: May 2026</p>

      <section>
        <h2>1. Subscription service</h2>
        <p>
          TeamShort VIP is a recurring subscription that unlocks episodes 10 and later across all series.
          By subscribing, you authorize TeamShort to charge your payment method automatically at the
          billing interval you select (weekly or monthly) until you cancel.
        </p>
      </section>

      <section>
        <h2>2. Pricing &amp; billing</h2>
        <ul>
          <li>
            <strong>Weekly VIP:</strong> USD $0.01 to subscribe (no charge today; payment method saved).
            First charge <strong>USD $9.90</strong> on the next <strong>Sunday at 12:00 AM</strong>
            (US Eastern Time), then $9.90 each week on Sunday until cancelled.
          </li>
          <li><strong>Monthly VIP:</strong> USD $29.90 per month, billed every 30 days.</li>
        </ul>
        <p>
          Prices are shown before checkout. Taxes may apply where required.
        </p>
      </section>

      <section>
        <h2>3. Auto-renewal</h2>
        <p>
          Your subscription renews automatically at the end of each billing period. You will be charged
          the then-current plan price unless you cancel before the renewal date.
        </p>
      </section>

      <section>
        <h2>4. Renewal reminders</h2>
        <p>
          We send email reminders before each renewal: at least 7 days before monthly billing, and at
          least 2–3 days before weekly billing. Reminders include the renewal amount and a link to
          cancel.
        </p>
      </section>

      <section>
        <h2>5. Cancellation</h2>
        <p>
          You may cancel anytime from your account on the
          <RouterLink to="/vip">VIP page</RouterLink>
          while signed in. Cancellation stops future charges; access continues until the end of the
          current paid period unless otherwise required by law.
        </p>
      </section>

      <section>
        <h2>6. Payment failures</h2>
        <p>
          If a renewal payment fails, we may retry a limited number of times and notify you by email.
          Please update your payment method or contact support if charges continue to fail.
        </p>
      </section>

      <section>
        <h2>7. Contact</h2>
        <p>
          Questions or disputes:
          <a href="mailto:support@teamshort.net">support@teamshort.net</a>
        </p>
      </section>

      <p class="legal-page__links">
        <RouterLink to="/vip">← Back to VIP</RouterLink>
        ·
        <RouterLink to="/legal/privacy">Privacy</RouterLink>
      </p>
    </article>
  </main>
</template>

<style scoped>
.legal-page__body {
  max-width: 36rem;
  padding: 0.5rem 0 2rem;
  color: rgba(245, 249, 255, 0.88);
  line-height: 1.65;
  font-size: 0.9rem;
}

.legal-page__body h1 {
  margin: 0 0 0.35rem;
  font-family: "Syne", sans-serif;
  font-size: 1.5rem;
  color: #f4f4f8;
}

.legal-page__updated {
  margin: 0 0 1.25rem;
  font-size: 0.8rem;
  color: rgba(245, 249, 255, 0.45);
}

.legal-page__body section {
  margin-bottom: 1.15rem;
}

.legal-page__body h2 {
  margin: 0 0 0.45rem;
  font-size: 1rem;
  color: #e8c49a;
}

.legal-page__body ul {
  margin: 0.35rem 0;
  padding-left: 1.2rem;
}

.legal-page__body a {
  color: #e8c49a;
}

.legal-page__links {
  margin-top: 1.5rem;
  font-size: 0.85rem;
}

.legal-page__links a {
  color: #e8c49a;
  text-decoration: none;
}

.legal-page__links a:hover {
  text-decoration: underline;
}

a.watch-top-link {
  display: grid;
  place-items: center;
  color: inherit;
  text-decoration: none;
}
</style>
