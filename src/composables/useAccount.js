import { ref, computed } from 'vue';
import {
  sendEmailVerificationCode,
  verifyEmailCode,
  fetchAuthConfig,
  loginWithGoogleCredential,
} from '../api/auth';
import { createPaymentCustomer } from '../api/payment';
import { syncMemberFromServer, clearMember } from './useVip';

export const ACCOUNT_STORAGE_KEY = 'watch_player_user';

const user = ref(null);
const modalOpen = ref(false);
const emailError = ref('');
/** @type {import('vue').Ref<'choose'|'email'|'verify'>} */
const authStep = ref('choose');
const pendingEmail = ref('');
const loading = ref(false);
const authConfig = ref({
  googleClientId: '',
  facebookAppId: '',
  providers: { google: false, facebook: false, email: true },
});

function readUser() {
  try {
    const raw = localStorage.getItem(ACCOUNT_STORAGE_KEY);
    user.value = raw ? JSON.parse(raw) : null;
  } catch {
    user.value = null;
  }
}

readUser();

const avatarUrl = computed(() => {
  const pic = user.value?.picture;
  return typeof pic === 'string' && pic.trim() ? pic.trim() : '';
});

const hasPhoto = computed(() => Boolean(avatarUrl.value));

const isSignedIn = computed(() => Boolean(user.value?.email));

const displayEmail = computed(() => user.value?.email ?? '');

const displayName = computed(() => user.value?.name ?? '');

const userId = computed(() => String(user.value?.userId ?? '').trim());

const googleEnabled = computed(() => Boolean(authConfig.value.providers?.google));

function saveUser(next) {
  user.value = next;
  localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(next));
}

async function afterSignIn() {
  const u = user.value;
  if (!u?.userId || !u?.email) return;
  try {
    await createPaymentCustomer({
      userId: u.userId,
      email: u.email,
      name: u.name || u.email,
    });
  } catch {
    /* billing profile optional until subscribe */
  }
  await syncMemberFromServer(u.userId);
}

export function isValidEmail(email) {
  const trimmed = String(email ?? '').trim().toLowerCase();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function resetAuthFlow() {
  authStep.value = 'choose';
  pendingEmail.value = '';
  emailError.value = '';
  loading.value = false;
}

export function useAccount() {
  async function loadAuthConfig() {
    try {
      const res = await fetchAuthConfig();
      if (res.code === 200) {
        authConfig.value = {
          googleClientId: res.googleClientId || '',
          facebookAppId: res.facebookAppId || '',
          providers: res.providers || { google: false, facebook: false, email: true },
        };
      }
    } catch {
      /* keep defaults */
    }
  }

  function syncAvatar() {
    readUser();
  }

  function openModal() {
    if (!isSignedIn.value) resetAuthFlow();
    emailError.value = '';
    modalOpen.value = true;
    void loadAuthConfig();
  }

  function closeModal() {
    modalOpen.value = false;
    if (!isSignedIn.value) resetAuthFlow();
    else emailError.value = '';
  }

  function toggleModal() {
    if (modalOpen.value) closeModal();
    else openModal();
  }

  function goToEmailStep() {
    authStep.value = 'email';
    emailError.value = '';
  }

  function backToChooseStep() {
    authStep.value = 'choose';
    emailError.value = '';
  }

  function backToEmailStep() {
    authStep.value = 'email';
    emailError.value = '';
  }

  async function requestEmailCode(email) {
    const trimmed = String(email ?? '').trim().toLowerCase();
    emailError.value = '';

    if (!trimmed) {
      emailError.value = 'Email is required';
      return false;
    }
    if (!isValidEmail(trimmed)) {
      emailError.value = 'Please enter a valid email address';
      return false;
    }

    loading.value = true;
    try {
      const res = await sendEmailVerificationCode(trimmed);
      if (res.code !== 200) {
        emailError.value = res.msg || 'Failed to send verification code';
        return false;
      }
      pendingEmail.value = trimmed;
      authStep.value = 'verify';
      return true;
    } catch (e) {
      emailError.value = e?.message || 'Network error. Try again.';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function completeEmailSignIn(email, code) {
    const trimmedEmail = String(email ?? pendingEmail.value).trim().toLowerCase();
    const trimmedCode = String(code ?? '').trim();
    emailError.value = '';

    if (!trimmedEmail) {
      emailError.value = 'Email is required';
      return false;
    }
    if (!isValidEmail(trimmedEmail)) {
      emailError.value = 'Please enter a valid email address';
      return false;
    }
    if (!trimmedCode) {
      emailError.value = 'Verification code is required';
      return false;
    }
    if (!/^\d{6}$/.test(trimmedCode)) {
      emailError.value = 'Enter the 6-digit code from your email';
      return false;
    }

    loading.value = true;
    try {
      const res = await verifyEmailCode(trimmedEmail, trimmedCode);
      if (res.code !== 200 || !res.user) {
        emailError.value = res.msg || 'Verification failed';
        return false;
      }
      saveUser(res.user);
      await afterSignIn();
      resetAuthFlow();
      closeModal();
      return true;
    } catch (e) {
      emailError.value = e?.message || 'Network error. Try again.';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function signInWithGoogle(credential) {
    emailError.value = '';
    loading.value = true;
    try {
      const res = await loginWithGoogleCredential(credential);
      if (res.code !== 200 || !res.user) {
        emailError.value = res.msg || 'Google sign-in failed';
        return false;
      }
      saveUser(res.user);
      await afterSignIn();
      resetAuthFlow();
      closeModal();
      return true;
    } catch (e) {
      emailError.value = e?.message || 'Google sign-in failed';
      return false;
    } finally {
      loading.value = false;
    }
  }

  function signOut() {
    user.value = null;
    try {
      localStorage.removeItem(ACCOUNT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    clearMember();
    resetAuthFlow();
    closeModal();
  }

  return {
    user,
    modalOpen,
    emailError,
    authStep,
    pendingEmail,
    loading,
    authConfig,
    googleEnabled,
    avatarUrl,
    hasPhoto,
    isSignedIn,
    displayEmail,
    displayName,
    userId,
    syncAvatar,
    afterSignIn,
    openModal,
    closeModal,
    toggleModal,
    goToEmailStep,
    backToChooseStep,
    backToEmailStep,
    requestEmailCode,
    completeEmailSignIn,
    signInWithGoogle,
    signOut,
    loadAuthConfig,
  };
}
