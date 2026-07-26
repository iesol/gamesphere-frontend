declare global {
  interface Window {
    __ENV__?: Record<string, string>;
  }
}

export const config = {
  googleClientId: window.__ENV__?.GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
};
