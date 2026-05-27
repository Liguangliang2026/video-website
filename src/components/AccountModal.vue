<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { RouterLink } from 'vue-router';
import { useAccount } from '../composables/useAccount';
import { useVip } from '../composables/useVip';
import { renderGoogleButton, cancelGooglePrompt } from '../composables/useGoogleSignIn';

const {
  modalOpen,
  avatarUrl,
  hasPhoto,
  isSignedIn,
  userId,
  displayEmail,
  displayName,
  emailError,
  authStep,
  pendingEmail,
  loading,
  authConfig,
  googleEnabled,
  toggleModal,
  closeModal,
  goToEmailStep,
  backToChooseStep,
  backToEmailStep,
  requestEmailCode,
  completeEmailSignIn,
  signInWithGoogle,
  signOut,
  loadAuthConfig,
} = useAccount();

const { isMember, syncMemberFromServer } = useVip();

const emailInput = ref('');
const codeInput = ref('');
const googleBtnHost = ref(null);

watch(modalOpen, (open) => {
  if (!open) {
    cancelGooglePrompt();
    return;
  }
  emailInput.value = isSignedIn.value ? displayEmail.value : '';
  codeInput.value = '';
  void loadAuthConfig();
  if (open && isSignedIn.value && userId.value) {
    void syncMemberFromServer(userId.value);
  }
});

watch(
  [modalOpen, authStep, () => authConfig.value.googleClientId],
  async ([open, step, clientId]) => {
    if (!open || step !== 'choose' || !clientId) return;
    await nextTick();
    if (!googleBtnHost.value) return;
    try {
      await renderGoogleButton(googleBtnHost.value, clientId, (credential) => {
        void signInWithGoogle(credential);
      });
    } catch {
      /* script load failed */
    }
  },
);

async function onEmailSubmit(e) {
  e.preventDefault();
  if (isSignedIn.value || loading.value) return;
  await requestEmailCode(emailInput.value);
}

async function onVerifySubmit(e) {
  e.preventDefault();
  if (isSignedIn.value || loading.value) return;
  await completeEmailSignIn(pendingEmail.value, codeInput.value);
}

async function onResendCode() {
  if (loading.value) return;
  await requestEmailCode(pendingEmail.value || emailInput.value);
}

function onKeydown(e) {
  if (e.key === 'Escape' && modalOpen.value) {
    e.preventDefault();
    closeModal();
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  cancelGooglePrompt();
});
</script>

<template>
  <button
    type="button"
    class="site-account-trigger"
    :class="{ 'has-photo': hasPhoto }"
    :aria-label="isSignedIn ? 'Account' : 'Sign in'"
    aria-haspopup="dialog"
    :aria-expanded="modalOpen"
    @click="toggleModal"
  >
    <img
      v-if="hasPhoto"
      class="site-account-trigger__img"
      :src="avatarUrl"
      :alt="displayName || displayEmail || 'Signed in'"
      width="44"
      height="44"
    />
    <span v-else class="site-account-trigger__placeholder" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </span>
  </button>

  <div
    class="account-modal"
    :class="{ 'is-open': modalOpen }"
    role="dialog"
    aria-labelledby="account-modal-title"
    aria-modal="true"
  >
    <div class="account-modal__backdrop" @click="closeModal" />
    <div class="account-modal__panel">
      <div class="account-modal__head">
        <h3 id="account-modal-title">{{ isSignedIn ? 'Account' : 'Sign in' }}</h3>
        <button type="button" class="account-modal__close" aria-label="Close" @click="closeModal">
          &times;
        </button>
      </div>

      <template v-if="isSignedIn">
        <p class="account-modal__sub">Signed in as</p>
        <p class="account-modal__username">{{ displayName }}</p>
        <p class="account-modal__email">{{ displayEmail }}</p>
        <p v-if="isMember()" class="account-modal__vip">VIP member · Episodes 10+ unlocked</p>
        <RouterLink v-else class="account-modal__vip-link" to="/vip" @click="closeModal">
          Subscribe to VIP
        </RouterLink>
        <RouterLink
          v-if="isMember()"
          class="account-membership-btn"
          to="/vip"
          @click="closeModal"
        >
          VIP membership
        </RouterLink>
        <button type="button" class="account-signout-btn" @click="signOut">Sign out</button>
      </template>

      <!-- 选择登录方式 -->
      <div v-else-if="authStep === 'choose'" class="account-auth-choose">
        <p class="account-modal__sub">Choose how you want to sign in.</p>

        <div class="account-login-list">
          <div
            v-if="googleEnabled"
            ref="googleBtnHost"
            class="account-google-host"
            :class="{ 'is-busy': loading }"
          />
          <p v-else class="account-login-hint">
            Google sign-in is not configured yet.
          </p>

          <button
            type="button"
            class="account-login-btn account-login-btn--facebook"
            disabled
            title="Coming soon"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
              />
            </svg>
            Continue with Facebook
            <span class="account-login-badge">Soon</span>
          </button>
        </div>

        <div class="account-login-divider" aria-hidden="true">
          <span>or</span>
        </div>

        <button
          type="button"
          class="account-login-btn account-login-btn--email"
          :disabled="loading"
          @click="goToEmailStep"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <path d="m22 6-10 7L2 6" />
          </svg>
          Continue with Email
        </button>

        <p v-if="emailError" class="account-email-error" role="alert">{{ emailError }}</p>
      </div>

      <form v-else-if="authStep === 'email'" class="account-email-form" novalidate @submit="onEmailSubmit">
        <button type="button" class="account-email-back" :disabled="loading" @click="backToChooseStep">
          &larr; All sign-in options
        </button>
        <p class="account-modal__sub">We will email you a 6-digit verification code.</p>
        <label class="account-email-label" for="account-email">Email</label>
        <input
          id="account-email"
          v-model="emailInput"
          type="email"
          name="email"
          class="account-email-input"
          placeholder="you@example.com"
          autocomplete="email"
          :disabled="loading"
        />
        <p v-if="emailError" class="account-email-error" role="alert">{{ emailError }}</p>
        <button type="submit" class="account-email-submit" :disabled="loading">
          {{ loading ? 'Sending…' : 'Send code' }}
        </button>
      </form>

      <form v-else class="account-email-form" novalidate @submit="onVerifySubmit">
        <button type="button" class="account-email-back" :disabled="loading" @click="backToEmailStep">
          &larr; Change email
        </button>
        <p class="account-modal__sub">
          Enter the code sent to
          <strong class="account-modal__email-inline">{{ pendingEmail }}</strong>
        </p>
        <label class="account-email-label" for="account-code">Verification code</label>
        <input
          id="account-code"
          v-model="codeInput"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="6"
          name="code"
          class="account-email-input account-email-input--code"
          placeholder="000000"
          autocomplete="one-time-code"
          :disabled="loading"
        />
        <p v-if="emailError" class="account-email-error" role="alert">{{ emailError }}</p>
        <button type="submit" class="account-email-submit" :disabled="loading">
          {{ loading ? 'Verifying…' : 'Verify & sign in' }}
        </button>
        <button type="button" class="account-email-resend" :disabled="loading" @click="onResendCode">
          Resend code
        </button>
      </form>
    </div>
  </div>
</template>
