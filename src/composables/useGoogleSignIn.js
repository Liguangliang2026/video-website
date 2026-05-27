const GIS_SRC = 'https://accounts.google.com/gsi/client';

let scriptPromise = null;

function loadGoogleScript() {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-gis]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.googleGis = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function renderGoogleButton(container, clientId, onCredential) {
  if (!container || !clientId) return false;

  await loadGoogleScript();

  container.innerHTML = '';
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => {
      if (response?.credential) onCredential(response.credential);
    },
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  window.google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    width: Math.min(360, container.offsetWidth || 320),
  });

  return true;
}

export function cancelGooglePrompt() {
  try {
    window.google?.accounts?.id?.cancel();
  } catch {
    /* ignore */
  }
}
