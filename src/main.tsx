import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabase } from "./integrations/supabase/client";

// Expose supabase to console for debugging
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}

if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url;
    const shouldLog = url.includes(import.meta.env.VITE_SUPABASE_URL ?? '');
    if (shouldLog) {
      const headers = init?.headers || (typeof input !== 'string' ? input.headers : undefined);
      console.debug('[SupabaseFetch] request', {
        url,
        headers,
      });
    }

    const response = await originalFetch(input, init);

    if (shouldLog) {
      console.debug('[SupabaseFetch] response', {
        url,
        status: response.status,
        ok: response.ok,
      });
    }

    return response;
  };
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

// ─── Service Worker registration (production only) ──────────────────────────
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[SW] Registered:', reg.scope);
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
  });
}
