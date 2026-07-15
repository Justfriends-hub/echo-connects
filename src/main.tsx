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

// Intercept same-origin link clicks and route via History API so
// links open inside the PWA/standalone app instead of launching Safari.
if (typeof window !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    // Only left-click without modifier keys
    if ((e as MouseEvent).button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const anchor = (e.target as Element).closest ? (e.target as Element).closest('a') as HTMLAnchorElement | null : null;
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    // Respect explicit targets and download links
    if (anchor.target && anchor.target !== '' && anchor.target !== '_self') return;
    if (anchor.hasAttribute('download')) return;
    try {
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return; // external link
      // Prevent full page navigation and use History API
      e.preventDefault();
      if (url.href !== window.location.href) {
        window.history.pushState({}, '', url.href);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch (err) {
      // If URL parsing fails, ignore and allow default
    }
  });
}

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
