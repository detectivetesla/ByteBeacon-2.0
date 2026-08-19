import { authApi, LoginResponse } from '../api/auth.api.js';

declare global {
  interface Window {
    google?: any;
  }
}

let googleScriptLoaded = false;
let googleScriptLoadingPromise: Promise<void> | null = null;

export async function loadGoogleScript(): Promise<void> {
  if (googleScriptLoaded || window.google?.accounts) {
    googleScriptLoaded = true;
    return Promise.resolve();
  }

  if (googleScriptLoadingPromise) {
    return googleScriptLoadingPromise;
  }

  googleScriptLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      googleScriptLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      googleScriptLoaded = true;
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load Google Sign-In SDK'));
    };
    document.head.appendChild(script);
  });

  return googleScriptLoadingPromise;
}

export async function promptGoogleSignIn(): Promise<LoginResponse> {
  await loadGoogleScript();

  const clientId =
    (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
    '1088713214589-bytebeacon.apps.googleusercontent.com';

  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      // Fallback: prompt directly if popup is blocked or API unavailable
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
        clientId,
      )}&response_type=token&scope=openid%20email%20profile&redirect_uri=${encodeURIComponent(
        window.location.origin,
      )}`;

      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        authUrl,
        'google_login_popup',
        `width=${width},height=${height},left=${left},top=${top}`,
      );

      if (!popup) {
        reject(new Error('Unable to open Google Sign-In window. Please check popup permissions.'));
        return;
      }

      // Check popup url hash
      const interval = setInterval(async () => {
        try {
          if (popup.closed) {
            clearInterval(interval);
            reject(new Error('Google Sign-In was cancelled.'));
            return;
          }

          if (popup.location.href.includes(window.location.origin)) {
            const hash = popup.location.hash;
            popup.close();
            clearInterval(interval);

            const params = new URLSearchParams(hash.replace(/^#/, ''));
            const accessToken = params.get('access_token');
            if (accessToken) {
              const res = await authApi.loginWithGoogle({ accessToken });
              resolve(res);
            } else {
              reject(new Error('No access token received from Google.'));
            }
          }
        } catch {
          // Cross-origin access pending
        }
      }, 500);

      return;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: async (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }

          if (response.access_token) {
            try {
              const loginResult = await authApi.loginWithGoogle({
                accessToken: response.access_token,
              });
              resolve(loginResult);
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error('No access token received from Google.'));
          }
        },
      });

      client.requestAccessToken({ prompt: 'select_account' });
    } catch (err: any) {
      reject(err);
    }
  });
}
